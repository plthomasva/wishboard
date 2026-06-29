<#
.SYNOPSIS
    Set up GitHub Actions OIDC Authentication with AWS and configure repo secrets.

.DESCRIPTION
    Deploys a CloudFormation template to create the OIDC role with minimum required
    permissions, then uses the GitHub CLI to automatically register repository secrets.

.PARAMETER Org
    GitHub organization or username. If omitted, parsed from git remote origin.

.PARAMETER Repo
    GitHub repository name. If omitted, parsed from git remote origin.

.PARAMETER Region
    AWS region for OIDC template deployment. Defaults to "us-east-1".

.EXAMPLE
    .\scripts\setup-oidc.ps1 -Region us-east-1
#>
param(
    [string]$Org = "",
    [string]$Repo = "",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

function Show-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Show-Info($msg) { Write-Host "    $msg" -ForegroundColor DarkGray }
function Show-Warn($msg) { Write-Host "WARNING: $msg" -ForegroundColor Yellow }
function Show-Error($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red }

# Resolve Git remote repo info
if (-not $Org -or -not $Repo) {
    Show-Step "Detecting GitHub repository info from Git remote..."
    try {
        $gitUrl = git remote get-url origin 2>$null
        if ($gitUrl -and ($gitUrl -match "github\.com[:/]([^/]+)/([^/\.]+)(?:\.git)?")) {
            $detectedOrg = $Matches[1]
            $detectedRepo = $Matches[2]
            if (-not $Org) { $Org = $detectedOrg }
            if (-not $Repo) { $Repo = $detectedRepo }
            Show-Info "Detected GitHub repository: $Org/$Repo"
        }
    }
    catch {
        # ignore git error, fall back to defaults
    }
    if (-not $Org) { $Org = "plthomasva" }
    if (-not $Repo) { $Repo = "wishboard" }
    if (-not $gitUrl) {
        Show-Warn "Could not detect GitHub repository from Git remote. Defaulting to $Org/$Repo"
    }
}

# Preflight checks
Show-Step "Performing preflight checks..."
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Show-Error "AWS CLI not found. Please install the AWS CLI."
    exit 1
}

try {
    $accountId = aws sts get-caller-identity --query Account --output text
}
catch {
    Show-Error "Unable to authenticate to AWS. Please run 'aws configure' or log in first."
    exit 1
}
if (-not $accountId -or $accountId -eq "None") {
    Show-Error "Unable to authenticate to AWS. Please run 'aws configure' or log in first."
    exit 1
}
Show-Info "Authenticated to AWS Account: $accountId"
Show-Info "Target Deployment Region: $Region"

# Deploy OIDC setup stack
$stackName = "$Repo-github-oidc-setup"

# Check if OIDC provider is already managed by this stack to avoid deleting it on updates
$managedByStack = $false
try {
    $physicalId = aws cloudformation describe-stack-resource --stack-name $stackName --logical-resource-id "GithubOidcProvider" --query "StackResourceDetail.PhysicalResourceId" --output text 2>$null
    if ($physicalId -and $physicalId -ne "None") {
        $managedByStack = $true
    }
} catch {}

# Check for existing OIDC provider in IAM to avoid duplicate error
Show-Step "Checking for existing GitHub OIDC Provider in AWS account..."
$oidcArn = aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?contains(Arn, 'token.actions.githubusercontent.com')].Arn | [0]" --output text
if ($oidcArn) { $oidcArn = $oidcArn.Trim() }

if ($managedByStack) {
    $oidcArn = ""
    Show-Info "GitHub OIDC provider is managed by this stack. Keeping it."
} elseif ($LASTEXITCODE -ne 0 -or -not $oidcArn -or $oidcArn -eq "None" -or $oidcArn -eq "") {
    $oidcArn = ""
    Show-Info "No existing GitHub OIDC provider found. It will be created."
} else {
    Show-Info "Found existing external GitHub OIDC provider: $oidcArn"
}
Show-Step "Deploying CloudFormation stack: $stackName..."

$parameters = @(
    "GitHubOrg=$Org",
    "GitHubRepo=$Repo",
    "OidcProviderArn=$oidcArn"
)

aws cloudformation deploy `
    --template-file aws-serverless/github-oidc-role.yaml `
    --stack-name $stackName `
    --parameter-overrides $parameters `
    --capabilities CAPABILITY_NAMED_IAM `
    --region $Region

if ($LASTEXITCODE -ne 0) {
    Show-Error "CloudFormation deployment failed."
    exit 1
}

# Extract Role ARN
Show-Step "Retrieving Role ARN output..."
$roleArn = aws cloudformation describe-stacks `
    --stack-name $stackName `
    --query "Stacks[0].Outputs[?OutputKey=='RoleArn'].OutputValue" `
    --output text `
    --region $Region

if ($LASTEXITCODE -ne 0 -or -not $roleArn -or $roleArn -eq "None") {
    Show-Error "Failed to retrieve RoleArn output from CloudFormation stack."
    exit 1
}

Show-Info "Deployment Role Created Successfully!"
Write-Host "Role ARN: $roleArn" -ForegroundColor Green
Write-Host ""

# Configure GitHub Secrets/Variables
Show-Step "Configuring GitHub Repository settings..."
$ghConfigured = $false

if (Get-Command gh -ErrorAction SilentlyContinue) {
    gh auth status *>$null
    if ($LASTEXITCODE -eq 0) {
        Show-Info "GitHub CLI (gh) detected and authenticated. Configuring repository settings..."
        
        # Set Secret
        gh secret set AWS_ROLE_TO_ASSUME --body "$roleArn"
        if ($LASTEXITCODE -eq 0) {
            Show-Info "Set secret: AWS_ROLE_TO_ASSUME"
        } else {
            Show-Warn "Failed to set secret AWS_ROLE_TO_ASSUME via GitHub CLI."
        }

        # Set Variables
        gh variable set AWS_REGION --body "$Region"
        if ($LASTEXITCODE -eq 0) {
            Show-Info "Set variable: AWS_REGION = $Region"
        } else {
            Show-Warn "Failed to set variable AWS_REGION."
        }

        gh variable set AWS_STACK_NAME --body "$Repo-serverless-dev"
        if ($LASTEXITCODE -eq 0) {
            Show-Info "Set variable: AWS_STACK_NAME = $Repo-serverless-dev"
        } else {
            Show-Warn "Failed to set variable AWS_STACK_NAME."
        }
        
        $ghConfigured = $true
    } else {
        Show-Warn "GitHub CLI (gh) is installed but not authenticated. Run 'gh auth login' to authenticate."
    }
} else {
    Show-Info "GitHub CLI (gh) not detected."
}

if (-not $ghConfigured) {
    Write-Host "Please manually set the following in your GitHub Repository settings (Settings -> Secrets and variables -> Actions):" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Repository Secrets:" -ForegroundColor Green
    Write-Host "    Name:  AWS_ROLE_TO_ASSUME" -ForegroundColor Cyan
    Write-Host "    Value: $roleArn"
    Write-Host ""
    Write-Host "  Repository Variables:" -ForegroundColor Green
    Write-Host "    Name:  AWS_REGION" -ForegroundColor Cyan
    Write-Host "    Value: $Region"
    Write-Host "    Name:  AWS_STACK_NAME" -ForegroundColor Cyan
    Write-Host "    Value: $Repo-serverless-dev"
    Write-Host ""
}

Write-Host "OIDC Setup Complete!" -ForegroundColor Green
