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

$hostName = if ($env:RUNDECK_CDP_HOST) { $env:RUNDECK_CDP_HOST } else { "127.0.0.1" }
$port = if ($env:RUNDECK_CDP_PORT) { $env:RUNDECK_CDP_PORT } else { "9222" }
$versionUrl = "http://$hostName`:$port/json/version"

try {
  $response = Invoke-RestMethod -Uri $versionUrl -TimeoutSec 3
  Write-Host "CDP reachable at $versionUrl"
  Write-Host "Browser: $($response.Browser)"
  Write-Host "WebSocket: $($response.webSocketDebuggerUrl)"
} catch {
  Write-Error "CDP not reachable at $versionUrl"
  exit 1
}
