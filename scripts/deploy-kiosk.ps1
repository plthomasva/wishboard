param (
    [Parameter(Mandatory = $false)]
    [string]$AdminUsername = "pi",

    [Parameter(Mandatory = $false)]
    [string]$HostName = "raspberrypi.local",

    [Parameter(Mandatory = $false)]
    [ValidateSet("prod", "dev", "dual")]
    [string]$Mode = "dev",

    [Parameter(Mandatory = $false)]
    [string]$DomainName = "wishboard.painless-computing.com",

    [Parameter(Mandatory = $false)]
    [switch]$DeployRules,

    [Parameter(Mandatory = $false)]
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"

Write-Host "Starting Wishboard Kiosk Docker Deployment to ${AdminUsername}@${HostName} (Mode: $Mode)..." -ForegroundColor Cyan
if ($DeployRules) {
    Write-Host "DeployRules flag specified. The Docker named volume will be reset to the baseline rules." -ForegroundColor Yellow
}

$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $ProjectRoot

# Read the current version to deploy a specific tag instead of 'latest'
$AppVersion = "latest"
if ($Version) {
    $AppVersion = $Version
}
elseif (Test-Path "package.json") {
    $PackageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $AppVersion = $PackageJson.version
}
Write-Host "Target Version: $AppVersion" -ForegroundColor Cyan

try {
    Write-Host "1. Uploading setup script, build script, and docker-compose.yml..." -ForegroundColor Yellow
    scp "scripts\setup-kiosk.sh" "${AdminUsername}@${HostName}:/tmp/setup-kiosk.sh"
    scp "scripts\build-kiosk.sh" "${AdminUsername}@${HostName}:/tmp/build-kiosk.sh"
    
    # Ensure the target directory exists on the Pi for docker-compose.yml
    ssh "${AdminUsername}@${HostName}" "mkdir -p /home/wishboard/wishboard"
    scp "docker-compose.yml" "${AdminUsername}@${HostName}:/home/wishboard/wishboard/docker-compose.yml"

    Write-Host "2. Executing setup script (configuring kiosk and Docker)..." -ForegroundColor Yellow
    # Ensure DOS line endings don't break bash execution by stripping \r using sed
    ssh "${AdminUsername}@${HostName}" "sed -i 's/\r$//' /tmp/setup-kiosk.sh && sudo bash /tmp/setup-kiosk.sh $Mode $DomainName"
    if ($LASTEXITCODE -ne 0) {
        throw "Setup script failed on the target device."
    }

    Write-Host "3. Deploying Docker container (Version: $AppVersion)..." -ForegroundColor Yellow

    $DeployRulesArg = if ($DeployRules) { "reset" } else { "keep" }

    # Execute the remote deployment script
    ssh "${AdminUsername}@${HostName}" "sed -i 's/\r$//' /tmp/build-kiosk.sh && sudo bash /tmp/build-kiosk.sh $Mode $DomainName $DeployRulesArg $AppVersion"

    if ($LASTEXITCODE -ne 0) {
        throw "Deployment failed on the target device. Check the logs above."
    }

    Write-Host "Deployment complete!" -ForegroundColor Green
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
