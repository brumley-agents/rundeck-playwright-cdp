## Builds the rundeck-org-info skill package as a distributable zip file.
## Usage: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-skill-zip.ps1

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputZip = Join-Path $projectRoot "rundeck-org-info.zip"

if (Test-Path $outputZip) {
    Remove-Item $outputZip -Force
}

$includeFiles = @(
    "SKILL.md",
    "SETUP.md",
    "README.md",
    "package.json",
    "package-lock.json",
    "playwright.config.ts",
    "tsconfig.json",
    ".env.example"
)

$includeDirs = @(
    "src",
    "scripts"
)

$tempDir = Join-Path $env:TEMP "rundeck-org-info-build"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}

$destDir = Join-Path $tempDir "rundeck-org-info"
New-Item -ItemType Directory -Path $destDir -Force | Out-Null

foreach ($file in $includeFiles) {
    $src = Join-Path $projectRoot $file
    if (Test-Path $src) {
        Copy-Item $src -Destination $destDir
    }
}

foreach ($dir in $includeDirs) {
    $src = Join-Path $projectRoot $dir
    if (Test-Path $src) {
        Copy-Item $src -Destination (Join-Path $destDir $dir) -Recurse
    }
}

# Remove the build script itself from the zip to avoid confusion
$buildScript = Join-Path $destDir "scripts\build-skill-zip.ps1"
if (Test-Path $buildScript) {
    Remove-Item $buildScript -Force
}

Compress-Archive -Path $destDir -DestinationPath $outputZip -Force

Remove-Item $tempDir -Recurse -Force

Write-Host "Built skill package: $outputZip"
$size = [math]::Round((Get-Item $outputZip).Length / 1KB, 1)
Write-Host "Size: ${size} KB"
