<#
.SYNOPSIS
    Tears down the GitHub Actions OIDC Authentication stack and cleans up repo secrets.

.DESCRIPTION
    Deletes the CloudFormation stack containing the OIDC role, then uses the
    GitHub CLI to automatically remove repository secrets/variables.

.PARAMETER Org
    GitHub organization or username. If omitted, parsed from git remote origin.

.PARAMETER Repo
    GitHub repository name. If omitted, parsed from git remote origin.

.PARAMETER Region
    AWS region for OIDC template deployment. Defaults to "us-east-1".
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

if (-not $Org -or -not $Repo) {
    try {
        $gitUrl = git remote get-url origin 2>$null
        if ($gitUrl -and ($gitUrl -match "github\.com[:/]([^/]+)/([^/\.]+)(?:\.git)?")) {
            if (-not $Org) { $Org = $Matches[1] }
            if (-not $Repo) { $Repo = $Matches[2] }
        }
    } catch {}
    if (-not $Org) { $Org = "plthomasva" }
    if (-not $Repo) { $Repo = "wishboard" }
}

$stackName = "$Repo-github-oidc-setup"

Show-Step "Deleting CloudFormation stack: $stackName..."
aws cloudformation delete-stack --stack-name $stackName --region $Region
aws cloudformation wait stack-delete-complete --stack-name $stackName --region $Region
Show-Info "Stack deleted successfully."

Show-Step "Cleaning up GitHub Repository settings..."
if (Get-Command gh -ErrorAction SilentlyContinue) {
    gh auth status *>$null
    if ($LASTEXITCODE -eq 0) {
        gh secret delete AWS_ROLE_TO_ASSUME *>$null
        Show-Info "Deleted secret: AWS_ROLE_TO_ASSUME"
        
        gh variable delete AWS_REGION *>$null
        Show-Info "Deleted variable: AWS_REGION"
        
        gh variable delete AWS_STACK_NAME *>$null
        Show-Info "Deleted variable: AWS_STACK_NAME"
    } else {
        Show-Warn "GitHub CLI (gh) is installed but not authenticated. Skipping secrets cleanup."
    }
} else {
    Show-Info "GitHub CLI (gh) not detected. Please manually remove AWS_ROLE_TO_ASSUME, AWS_REGION, and AWS_STACK_NAME from your GitHub repo settings."
}

Write-Host "OIDC Teardown Complete!" -ForegroundColor Green
