# install-extensions.ps1
# Attempts to install BOB helper extensions into Antigravity

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$resourcesDir = Join-Path (Split-Path -Parent $scriptDir) "resources"

# Find Antigravity CLI (similar path to VS Code)
$antigravityPaths = @(
    "$env:LOCALAPPDATA\Programs\antigravity\bin\antigravity.cmd",
    "$env:LOCALAPPDATA\Programs\Antigravity\bin\antigravity.cmd",
    "$env:PROGRAMFILES\Antigravity\bin\antigravity.cmd",
    "C:\Program Files\Antigravity\bin\antigravity.cmd"
)

$antigravityCli = $null
foreach ($path in $antigravityPaths) {
    if (Test-Path $path) {
        $antigravityCli = $path
        break
    }
}

if (-not $antigravityCli) {
    Write-Host "Antigravity CLI not found. Extensions must be installed manually."
    Write-Host "Use 'Extensions: Install from VSIX' in Antigravity to install:"
    Write-Host "  - $resourcesDir\bob-helper.vsix"
    Write-Host "  - $resourcesDir\bob-autoclicker.vsix"
    exit 1
}

Write-Host "Found Antigravity CLI at: $antigravityCli"

# Install bob-helper extension
$helperVsix = Join-Path $resourcesDir "bob-helper.vsix"
if (Test-Path $helperVsix) {
    Write-Host "Installing bob-helper extension..."
    & $antigravityCli --install-extension $helperVsix --force
}

# Install bob-autoclicker extension
$autoclickerVsix = Join-Path $resourcesDir "bob-autoclicker.vsix"
if (Test-Path $autoclickerVsix) {
    Write-Host "Installing bob-autoclicker extension..."
    & $antigravityCli --install-extension $autoclickerVsix --force
}

Write-Host "Extension installation complete!"
