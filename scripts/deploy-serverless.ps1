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

.PARAMETER AwsProfile
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
    ./scripts/deploy-serverless.ps1 -AwsProfile wishboard

.EXAMPLE
    ./scripts/deploy-serverless.ps1            # uses default AWS credentials

.EXAMPLE
    ./scripts/deploy-serverless.ps1 -Guided    # first-time interactive setup

.EXAMPLE
    ./scripts/deploy-serverless.ps1 -AwsProfile wishboard -FrontendOnly
#>
param(
    [string]$AwsProfile = "",
    [string]$StackName = "",
    [string]$Region = "",
    [ValidateSet("prod", "dev")]
    [string]$Mode = "prod",
    [switch]$Guided,
    [switch]$FrontendOnly,
    [switch]$SkipFrontendUpload
)

$ErrorActionPreference = "Stop"

$ProjectRoot   = Resolve-Path "$PSScriptRoot\.."
$ServerlessDir = Join-Path $ProjectRoot "aws-serverless"
$SamConfig     = Join-Path $ServerlessDir "samconfig.toml"
$DistDir       = Join-Path $ProjectRoot "dist"

function Show-Step($message) { Write-Host "==> $message" -ForegroundColor Cyan }
function Show-Info($message) { Write-Host "    $message" -ForegroundColor DarkGray }

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

# Extract a key's value from a space-separated Key="Value" string.
function Get-OverrideValue($key, $overrides) {
    if ($overrides -match "$key=`"([^`"]*)`"") {
        return $Matches[1]
    }
    return ""
}

# --- Resolve configuration (CLI args win, then samconfig.toml, then defaults) ---
if (-not $StackName) { $StackName = Get-TomlValue "stack_name" }
if (-not $StackName) { $StackName = "wishboard-serverless" }
if (-not $Region)    { $Region   = Get-TomlValue "region" }
if (-not $AwsProfile)   { $AwsProfile  = Get-TomlValue "profile" }

# Common --profile / --region args shared by sam and aws invocations.
function Get-AwsCommon {
    $common = @()
    if ($AwsProfile) { $common += @("--profile", $AwsProfile) }
    if ($Region)  { $common += @("--region", $Region) }
    return ,$common
}

Write-Host ""
Write-Host "Wishboard serverless deployment" -ForegroundColor Green
Show-Info "Stack:   $StackName"
Show-Info "Profile: $(if ($AwsProfile) { $AwsProfile } else { '(default credentials)' })"
Show-Info "Region:  $(if ($Region) { $Region } else { '(from AWS config)' })"
Write-Host ""

# --- Preflight ---
Show-Step "Checking prerequisites..."
Assert-Command "node"
Assert-Command "npm"
Assert-Command "aws"
if (-not $FrontendOnly) { Assert-Command "sam" }

$awsCommon = Get-AwsCommon
$account = aws sts get-caller-identity @awsCommon --query "Account" --output text
if ($LASTEXITCODE -ne 0 -or -not $account -or $account -eq "None") {
    throw "Unable to authenticate to AWS. Check your credentials / -AwsProfile value."
}
Show-Info "Authenticated to AWS account $account"

try {
    # --- 1. Frontend build ---
    Show-Step "[1/6] Building frontend (npm run build)..."
    Push-Location $ProjectRoot
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }
    Pop-Location

    if (-not $FrontendOnly) {
        Push-Location $ServerlessDir
        try {
            # --- 2. Backend bundle ---
            Show-Step "[2/6] Bundling backend (sam build)..."
            sam build
            if ($LASTEXITCODE -ne 0) { throw "sam build failed." }

            # --- 3. Native binary post-build ---
            Show-Step "[3/6] Copying libSQL native binary into artifacts (post-build.js)..."
            node post-build.js
            if ($LASTEXITCODE -ne 0) { throw "post-build.js failed." }

            # --- 4. Deploy stack ---
            $useGuided = $Guided -or (-not (Test-Path $SamConfig))
            if ($env:CI) {
                $useGuided = $false
            }
            if ($useGuided) {
                Show-Step "[4/6] Deploying stack (sam deploy --guided)..."
                Show-Info "No samconfig.toml found or -Guided specified; starting interactive setup."
            }
            else {
                Show-Step "[4/6] Deploying stack (sam deploy)..."
            }

            $deployArgs = @("deploy", "--stack-name", $StackName)
            if ($useGuided) {
                $deployArgs += "--guided"
            }
            else {
                $deployArgs += @(
                    "--no-confirm-changeset",
                    "--no-fail-on-empty-changeset",
                    "--capabilities", "CAPABILITY_IAM",
                    "--resolve-s3"
                )
            }
            $deployArgs += $awsCommon

            $nodeEnvValue = if ($Mode -eq "dev") { "development" } else { "production" }

            $tomlOverrides = Get-TomlValue "parameter_overrides"
            $projectName = $env:PROJECT_NAME
            if (-not $projectName) { $projectName = Get-OverrideValue "ProjectName" $tomlOverrides }
            if (-not $projectName) { $projectName = "wishboard" }
            if ($Mode -eq "dev" -and $projectName -eq "wishboard") {
                $projectName = "wishboard-dev"
            }

            $domainName = $env:DOMAIN_NAME
            if (-not $domainName) { $domainName = Get-OverrideValue "DomainName" $tomlOverrides }
            $hostedZoneId = $env:HOSTED_ZONE_ID
            if (-not $hostedZoneId) { $hostedZoneId = Get-OverrideValue "HostedZoneId" $tomlOverrides }
            $acmCertificateArn = $env:ACM_CERTIFICATE_ARN
            if (-not $acmCertificateArn) { $acmCertificateArn = Get-OverrideValue "AcmCertificateArn" $tomlOverrides }

            $mergedOverrides = "ProjectName='$projectName' DomainName='$domainName' HostedZoneId='$hostedZoneId' AcmCertificateArn='$acmCertificateArn' NodeEnv='$nodeEnvValue'"
            $deployArgs += @("--parameter-overrides", $mergedOverrides, "--tags", "Project=wishboard")

            # Let boto retry transient S3/network errors while uploading artifacts.
            $env:AWS_MAX_ATTEMPTS = "6"
            $env:AWS_RETRY_MODE = "adaptive"

            # Outer retry: artifact uploads to the managed bucket can drop the
            # connection mid-stream on flaky networks. Re-running sam deploy is
            # idempotent (already-uploaded artifacts are skipped). Don't retry a
            # guided run, which is interactive.
            $maxAttempts = if ($useGuided) { 1 } else { 4 }
            for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
                $outputLines = @()
                try {
                    sam @deployArgs *>&1 | ForEach-Object {
                        $outputLines += $_
                        Write-Host $_
                    }
                } catch {}
                
                if ($LASTEXITCODE -eq 0) { break }
                
                $outputString = $outputLines -join "`n"
                
                if ($outputString -match "ROLLBACK_COMPLETE" -or 
                    $outputString -match "ValidationError" -or 
                    $outputString -match "AccessDenied" -or 
                    $outputString -match "not authorized to perform") {
                    throw "sam deploy failed with a non-recoverable error. Aborting retries."
                }

                if ($attempt -ge $maxAttempts) { throw "sam deploy failed after $attempt attempt(s)." }
                Show-Info "sam deploy attempt $attempt failed (exit $LASTEXITCODE); likely a transient upload error. Retrying in 5s..."
                Start-Sleep -Seconds 5
            }
        }
        finally {
            Pop-Location
        }

        # Guided mode may have just written/updated samconfig.toml; pick up any
        # values the user chose so the output lookups below use them.
        if (-not $Region)  { $Region  = Get-TomlValue "region" }
        if (-not $AwsProfile) { $AwsProfile = Get-TomlValue "profile" }
        $tomlStack = Get-TomlValue "stack_name"
        if ($tomlStack) { $StackName = $tomlStack }
        $awsCommon = Get-AwsCommon
    }

    # --- 5. Read stack outputs ---
    Show-Step "[5/6] Reading stack outputs..."
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
    Show-Info "Frontend bucket: $frontendBucket"

    if ($distId) {
        Show-Step "Configuring CloudFront ID on ApiFunction environment variables..."
        try {
            $lambdaName = aws cloudformation describe-stack-resource --stack-name $StackName --logical-resource-id "ApiFunction" @awsCommon --query "StackResourceDetail.PhysicalResourceId" --output text
            if ($LASTEXITCODE -ne 0 -or -not $lambdaName -or $lambdaName -eq "None") {
                throw "Failed to resolve physical resource ID for ApiFunction"
            }
            $configJson = aws lambda get-function-configuration --function-name $lambdaName @awsCommon
            if ($LASTEXITCODE -eq 0 -and $configJson) {
                $configObj = $configJson | ConvertFrom-Json
                $vars = $configObj.Environment.Variables
                if (-not $vars) {
                    $vars = @{}
                }
                if ($vars.CLOUDFRONT_DISTRIBUTION_ID -ne $distId) {
                    $vars.CLOUDFRONT_DISTRIBUTION_ID = $distId
                    $newEnv = @{ Variables = $vars } | ConvertTo-Json -Depth 10 -Compress
                    aws lambda update-function-configuration --function-name $lambdaName --environment $newEnv @awsCommon | Out-Null
                    Show-Info "Successfully configured CLOUDFRONT_DISTRIBUTION_ID=$distId on $lambdaName"
                } else {
                    Show-Info "CLOUDFRONT_DISTRIBUTION_ID is already up to date ($distId)"
                }
            } else {
                throw "Failed to fetch Lambda function configuration"
            }
        }
        catch {
            Show-Info "Warning: Could not dynamically set CLOUDFRONT_DISTRIBUTION_ID on Lambda: $_"
        }
    }


    # --- 6. Upload frontend + invalidate CloudFront ---
    if ($SkipFrontendUpload) {
        Show-Step "[6/6] Skipping frontend upload (-SkipFrontendUpload)."
    }
    else {
        if (-not (Test-Path $DistDir)) { throw "Build output not found at $DistDir." }

        Show-Step "[6/6] Uploading frontend to s3://$frontendBucket ..."
        aws s3 sync $DistDir "s3://$frontendBucket" --delete @awsCommon
        if ($LASTEXITCODE -ne 0) { throw "Frontend upload to S3 failed." }

        if ($distId) {
            Show-Info "Invalidating CloudFront cache ($distId)..."
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
