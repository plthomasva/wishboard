<#
.SYNOPSIS
    Tears down the Wishboard AWS serverless stack cleanly.

.DESCRIPTION
    Checks for S3 buckets created by the stack and empties them, then
    deletes the CloudFormation stack via `sam delete`.

.PARAMETER AwsProfile
    Named AWS CLI profile to use.

.PARAMETER StackName
    CloudFormation stack name. Defaults to the value in samconfig.toml.

.PARAMETER Region
    AWS region. Defaults to the value in samconfig.toml.

.PARAMETER Force
    Must be provided to delete the production stack to prevent accidental data loss.
#>
param(
    [string]$AwsProfile = "",
    [string]$StackName = "",
    [string]$Region = "",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$ProjectRoot   = Resolve-Path "$PSScriptRoot\.."
$ServerlessDir = Join-Path $ProjectRoot "aws-serverless"
$SamConfig     = Join-Path $ServerlessDir "samconfig.toml"

function Show-Step($message) { Write-Host "==> $message" -ForegroundColor Cyan }
function Show-Info($message) { Write-Host "    $message" -ForegroundColor DarkGray }

function Get-TomlValue($key) {
    if (-not (Test-Path $SamConfig)) { return "" }
    foreach ($line in Get-Content $SamConfig) {
        if ($line -match "^\s*$key\s*=\s*(.+?)\s*$") {
            return $Matches[1].Trim().Trim('"')
        }
    }
    return ""
}

if (-not $StackName) { $StackName = Get-TomlValue "stack_name" }
if (-not $StackName) { $StackName = "wishboard-serverless" }
if (-not $Region)    { $Region   = Get-TomlValue "region" }
if (-not $AwsProfile)   { $AwsProfile  = Get-TomlValue "profile" }

function Get-AwsCommon {
    $common = @()
    if ($AwsProfile) { $common += @("--profile", $AwsProfile) }
    if ($Region)  { $common += @("--region", $Region) }
    return ,$common
}
$awsCommon = Get-AwsCommon

# Force check for prod
if ($StackName -notmatch "dev" -and -not $Force) {
    Write-Host "ERROR: Attempting to delete a production stack '$StackName'. You must supply the -Force flag to acknowledge deletion of all images and databases." -ForegroundColor Red
    exit 1
}

Show-Step "Checking for existing stack '$StackName'..."
try {
    $stackStatus = aws cloudformation describe-stacks --stack-name $StackName @awsCommon --query "Stacks[0].StackStatus" --output text 2>$null
} catch {}

if (-not $stackStatus -or $stackStatus -eq "None") {
    Show-Info "Stack '$StackName' does not exist or is already deleted."
    exit 0
}

Show-Step "Emptying S3 buckets for stack '$StackName'..."
function Empty-BucketIfOutput($key) {
    try {
        $bucketName = aws cloudformation describe-stacks --stack-name $StackName @awsCommon --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue | [0]" --output text 2>$null
        if ($bucketName -and $bucketName -ne "None") {
            Show-Info "Emptying s3://$bucketName..."
            aws s3 rm "s3://$bucketName" --recursive @awsCommon | Out-Null
        }
    } catch {}
}

Empty-BucketIfOutput "FrontendBucketName"
Empty-BucketIfOutput "ImagesBucketName"

Show-Step "Deleting CloudFormation stack '$StackName'..."
$deleteArgs = @("delete", "--stack-name", $StackName, "--no-prompts")
$deleteArgs += $awsCommon
sam @deleteArgs
if ($LASTEXITCODE -ne 0) {
    throw "sam delete failed."
}

Write-Host ""
Write-Host "Successfully destroyed serverless stack: $StackName" -ForegroundColor Green
