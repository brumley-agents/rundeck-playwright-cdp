param(
  [Parameter(Mandatory = $true)]
  [string]$NodePath,

  [Parameter(Mandatory = $true)]
  [string]$PlaywrightCliPath,

  [Parameter(Mandatory = $true)]
  [string]$CloudOrg,

  [Parameter(Mandatory = $true)]
  [string]$TicketNumber,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $projectRoot

$argsList = @(
  $PlaywrightCliPath,
  "test",
  "src/runAcloudGetAccountDetails.ts",
  "--",
  "--cloud-org",
  $CloudOrg,
  "--ticket",
  $TicketNumber
)

"Command: $NodePath $($argsList -join ' ')" | Tee-Object -FilePath $OutputPath -Append

try {
  & $NodePath @argsList 2>&1 | Tee-Object -FilePath $OutputPath -Append
  exit $LASTEXITCODE
} catch {
  $_ | Out-String | Tee-Object -FilePath $OutputPath -Append
  exit 1
}
