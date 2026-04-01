param(
  [ValidateSet("edge", "chrome")]
  [string]$Browser = "edge"
)

$envPath = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') {
      return
    }

    $parts = $_ -split '=', 2
    if ($parts.Count -eq 2) {
      [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
  }
}

$port = if ($env:RUNDECK_CDP_PORT) { $env:RUNDECK_CDP_PORT } else { "9222" }
$profileDirectory = if ($env:RUNDECK_BROWSER_PROFILE_DIRECTORY) { $env:RUNDECK_BROWSER_PROFILE_DIRECTORY } else { "Default" }
$startUrl = if ($env:RUNDECK_BASE_URL) { $env:RUNDECK_BASE_URL } else { "https://rundeck.uipath.com" }
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$authDir = Join-Path $projectRoot "auth"
New-Item -ItemType Directory -Path $authDir -Force | Out-Null

if ($Browser -eq "chrome") {
  $executablePath = if ($env:RUNDECK_CHROME_EXECUTABLE_PATH) { $env:RUNDECK_CHROME_EXECUTABLE_PATH } else { "C:\Program Files\Google\Chrome\Application\chrome.exe" }
  $userDataDir = if ($env:RUNDECK_CHROME_USER_DATA_DIR) { $env:RUNDECK_CHROME_USER_DATA_DIR } else { (Join-Path $authDir "chrome-cdp-user-data") }
} else {
  $executablePath = if ($env:RUNDECK_EDGE_EXECUTABLE_PATH) { $env:RUNDECK_EDGE_EXECUTABLE_PATH } else { "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" }
  $userDataDir = if ($env:RUNDECK_EDGE_USER_DATA_DIR) { $env:RUNDECK_EDGE_USER_DATA_DIR } else { (Join-Path $authDir "edge-cdp-user-data") }
}

New-Item -ItemType Directory -Path $userDataDir -Force | Out-Null

if (-not (Test-Path $executablePath)) {
  throw "Browser executable not found: $executablePath"
}

$arguments = @(
  "--remote-debugging-port=$port",
  "--user-data-dir=$userDataDir",
  "--profile-directory=$profileDirectory",
  "--new-window",
  $startUrl
)

Start-Process -FilePath $executablePath -ArgumentList $arguments
Write-Host "Started $Browser with CDP on port $port"
