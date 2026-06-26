<#
.SYNOPSIS
    Build and deploy (or update) the Wishboard AWS serverless stack.

.DESCRIPTION
    Performs every step required to deploy the serverless target:
      1. Builds the React frontend (vite -> dist/)
      2. Bundles the backend with `sam build`
      3. Copies the libSQL native binary into the build artifacts (post-build.js)
      4. Deploys the CloudFormation stack with `sam deploy`
         (guided on first run / when no samconfig.toml exists, otherwise reuses it)
      5. Uploads the built frontend assets to the S3 frontend bucket
      6. Invalidates the CloudFront cache

    AWS credentials are resolved the standard way. Pass -Profile to use a named
    profile (e.g. a dedicated Wishboard account); omit it to use your default
    credentials / environment variables.

.PARAMETER Profile
    Named AWS CLI profile to use for sam + aws commands. If omitted, the script
    falls back to the `profile` saved in aws-serverless/samconfig.toml, then to
    your default AWS credentials.

.PARAMETER StackName
    CloudFormation stack name. Defaults to the value in samconfig.toml, then to
    "wishboard-serverless".

.PARAMETER Region
    AWS region. Defaults to the value in samconfig.toml, then to your AWS config.

.PARAMETER Guided
    Force `sam deploy --guided` (the interactive first-time configuration), even
    if a samconfig.toml already exists.

.PARAMETER FrontendOnly
    Skip the backend build/deploy; only rebuild the frontend, upload it, and
    invalidate CloudFront. Requires an already-deployed stack.

.PARAMETER SkipFrontendUpload
    Deploy the backend only; skip the S3 upload and CloudFront invalidation.

.EXAMPLE
    ./scripts/deploy-serverless.ps1 -Profile wishboard

.EXAMPLE
    ./scripts/deploy-serverless.ps1            # uses default AWS credentials

.EXAMPLE
    ./scripts/deploy-serverless.ps1 -Guided    # first-time interactive setup

.EXAMPLE
    ./scripts/deploy-serverless.ps1 -Profile wishboard -FrontendOnly
#>
param(
    [string]$Profile = "",
    [string]$StackName = "",
    [string]$Region = "",
    [switch]$Guided,
    [switch]$FrontendOnly,
    [switch]$SkipFrontendUpload
)

$ErrorActionPreference = "Stop"

$ProjectRoot   = Resolve-Path "$PSScriptRoot\.."
$ServerlessDir = Join-Path $ProjectRoot "aws-serverless"
$SamConfig     = Join-Path $ServerlessDir "samconfig.toml"
$DistDir       = Join-Path $ProjectRoot "dist"

function Write-Step($message) { Write-Host "==> $message" -ForegroundColor Cyan }
function Write-Info($message) { Write-Host "    $message" -ForegroundColor DarkGray }

function Assert-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Required command '$name' was not found in PATH. Please install it and retry."
    }
}

# Read a value (e.g. stack_name, region, profile) from samconfig.toml.
function Get-TomlValue($key) {
    if (-not (Test-Path $SamConfig)) { return "" }
    foreach ($line in Get-Content $SamConfig) {
        if ($line -match "^\s*$key\s*=\s*(.+?)\s*$") {
            return $Matches[1].Trim().Trim('"')
        }
    }
    return ""
}

# --- Resolve configuration (CLI args win, then samconfig.toml, then defaults) ---
if (-not $StackName) { $StackName = Get-TomlValue "stack_name" }
if (-not $StackName) { $StackName = "wishboard-serverless" }
if (-not $Region)    { $Region   = Get-TomlValue "region" }
if (-not $Profile)   { $Profile  = Get-TomlValue "profile" }

# Common --profile / --region args shared by sam and aws invocations.
function Get-AwsCommon {
    $common = @()
    if ($Profile) { $common += @("--profile", $Profile) }
    if ($Region)  { $common += @("--region", $Region) }
    return ,$common
}

Write-Host ""
Write-Host "Wishboard serverless deployment" -ForegroundColor Green
Write-Info "Stack:   $StackName"
Write-Info "Profile: $(if ($Profile) { $Profile } else { '(default credentials)' })"
Write-Info "Region:  $(if ($Region) { $Region } else { '(from AWS config)' })"
Write-Host ""

# --- Preflight ---
Write-Step "Checking prerequisites..."
Assert-Command "node"
Assert-Command "npm"
Assert-Command "aws"
if (-not $FrontendOnly) { Assert-Command "sam" }

$awsCommon = Get-AwsCommon
$account = aws sts get-caller-identity @awsCommon --query "Account" --output text
if ($LASTEXITCODE -ne 0 -or -not $account -or $account -eq "None") {
    throw "Unable to authenticate to AWS. Check your credentials / -Profile value."
}
Write-Info "Authenticated to AWS account $account"

try {
    # --- 1. Frontend build ---
    Write-Step "[1/6] Building frontend (npm run build)..."
    Push-Location $ProjectRoot
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }
    Pop-Location

    if (-not $FrontendOnly) {
        Push-Location $ServerlessDir
        try {
            # --- 2. Backend bundle ---
            Write-Step "[2/6] Bundling backend (sam build)..."
            sam build
            if ($LASTEXITCODE -ne 0) { throw "sam build failed." }

            # --- 3. Native binary post-build ---
            Write-Step "[3/6] Copying libSQL native binary into artifacts (post-build.js)..."
            node post-build.js
            if ($LASTEXITCODE -ne 0) { throw "post-build.js failed." }

            # --- 4. Deploy stack ---
            $useGuided = $Guided -or (-not (Test-Path $SamConfig))
            if ($useGuided) {
                Write-Step "[4/6] Deploying stack (sam deploy --guided)..."
                Write-Info "No samconfig.toml found or -Guided specified; starting interactive setup."
            }
            else {
                Write-Step "[4/6] Deploying stack (sam deploy)..."
            }

            $deployArgs = @("deploy")
            if ($useGuided) {
                $deployArgs += "--guided"
            }
            else {
                $deployArgs += @(
                    "--no-confirm-changeset",
                    "--no-fail-on-empty-changeset",
                    "--capabilities", "CAPABILITY_IAM"
                )
            }
            $deployArgs += @("--stack-name", $StackName)
            $deployArgs += $awsCommon
            sam @deployArgs
            if ($LASTEXITCODE -ne 0) { throw "sam deploy failed." }
        }
        finally {
            Pop-Location
        }

        # Guided mode may have just written/updated samconfig.toml; pick up any
        # values the user chose so the output lookups below use them.
        if (-not $Region)  { $Region  = Get-TomlValue "region" }
        if (-not $Profile) { $Profile = Get-TomlValue "profile" }
        $tomlStack = Get-TomlValue "stack_name"
        if ($tomlStack) { $StackName = $tomlStack }
        $awsCommon = Get-AwsCommon
    }

    # --- 5. Read stack outputs ---
    Write-Step "[5/6] Reading stack outputs..."
    function Get-StackOutput($key) {
        $v = aws cloudformation describe-stacks --stack-name $StackName @awsCommon `
            --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue | [0]" --output text
        if ($LASTEXITCODE -ne 0) { throw "Failed to read stack outputs for '$StackName'." }
        if ($v -eq "None") { return "" }
        return $v
    }
    $frontendBucket = Get-StackOutput "FrontendBucketName"
    $distId         = Get-StackOutput "CloudFrontDistributionId"
    $cfUrl          = Get-StackOutput "CloudFrontUrl"
    $customUrl      = Get-StackOutput "CustomDomainUrl"

    if (-not $frontendBucket) {
        throw "FrontendBucketName output not found. Did the stack deploy successfully?"
    }
    Write-Info "Frontend bucket: $frontendBucket"

    # --- 6. Upload frontend + invalidate CloudFront ---
    if ($SkipFrontendUpload) {
        Write-Step "[6/6] Skipping frontend upload (-SkipFrontendUpload)."
    }
    else {
        if (-not (Test-Path $DistDir)) { throw "Build output not found at $DistDir." }

        Write-Step "[6/6] Uploading frontend to s3://$frontendBucket ..."
        aws s3 sync $DistDir "s3://$frontendBucket" --delete @awsCommon
        if ($LASTEXITCODE -ne 0) { throw "Frontend upload to S3 failed." }

        if ($distId) {
            Write-Info "Invalidating CloudFront cache ($distId)..."
            aws cloudfront create-invalidation --distribution-id $distId --paths "/*" @awsCommon | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "CloudFront invalidation failed." }
        }
    }

    Write-Host ""
    Write-Host "Deployment complete!" -ForegroundColor Green
    if ($cfUrl)     { Write-Host "  CloudFront URL: $cfUrl" -ForegroundColor Green }
    if ($customUrl) { Write-Host "  Custom domain:  $customUrl" -ForegroundColor Green }
    Write-Host ""
}
catch {
    Write-Host ""
    Write-Error $_.Exception.Message
    exit 1
}
