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
    [switch]$DeployRules
)

$ErrorActionPreference = "Stop"

Write-Host "Starting Wishboard Kiosk Deployment to ${AdminUsername}@${HostName} (Mode: $Mode)..." -ForegroundColor Cyan
if ($DeployRules) {
    Write-Host "DeployRules flag specified. Baseline rules will overwrite any customized rules on the device." -ForegroundColor Yellow
}

$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $ProjectRoot

Write-Host "1. Creating code archive using tar..." -ForegroundColor Yellow
# Exclude runtime data (DB, logs) and build outputs
$ExcludeArgs = @(
    "--exclude=node_modules",
    "--exclude=.git",
    "--exclude=dist",
    "--exclude=data/*.db",
    "--exclude=data/*.sqlite",
    "--exclude=data/*.sqlite-shm",
    "--exclude=data/*.sqlite-wal",
    "--exclude=data/logs",
    "--exclude=wishboard.tar.gz"
)

# By default, don't deploy rules unless explicitly asked, to avoid wiping out customized rules on the target
if (-not $DeployRules) {
    $ExcludeArgs += "--exclude=data/rules.yaml"
}

$TarArgs = @("-czf", "wishboard.tar.gz") + $ExcludeArgs + @(".")
& tar.exe @TarArgs

try {
    Write-Host "2. Uploading setup script, build script, and code archive..." -ForegroundColor Yellow
    scp "scripts\setup-kiosk.sh" "${AdminUsername}@${HostName}:/tmp/setup-kiosk.sh"
    scp "scripts\build-kiosk.sh" "${AdminUsername}@${HostName}:/tmp/build-kiosk.sh"
    scp "wishboard.tar.gz" "${AdminUsername}@${HostName}:/tmp/wishboard.tar.gz"

    Write-Host "3. Executing setup script (creating user and configs)..." -ForegroundColor Yellow
    # Ensure DOS line endings don't break bash execution by stripping \r using sed
    ssh "${AdminUsername}@${HostName}" "sed -i 's/\r$//' /tmp/setup-kiosk.sh && sudo bash /tmp/setup-kiosk.sh $Mode $DomainName"
    if ($LASTEXITCODE -ne 0) {
        throw "Setup script failed on the target device."
    }

    Write-Host "4. Extracting codebase and building..." -ForegroundColor Yellow
    # Execute the remote build script
    ssh "${AdminUsername}@${HostName}" "sed -i 's/\r$//' /tmp/build-kiosk.sh && sudo bash /tmp/build-kiosk.sh $Mode $DomainName"

    if ($LASTEXITCODE -ne 0) {
        throw "Deployment failed on the target device. Check the logs above."
    }

    Write-Host "Deployment complete!" -ForegroundColor Green
}
finally {
    # Cleanup local archive
    if (Test-Path "wishboard.tar.gz") {
        Remove-Item "wishboard.tar.gz"
    }
}
