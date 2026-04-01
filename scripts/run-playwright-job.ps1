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

$env:RUNDECK_CLOUD_ORG = $CloudOrg
$env:RUNDECK_TICKET_NUMBER = $TicketNumber

$argsList = @(
  $PlaywrightCliPath,
  "test",
  "src/runAcloudGetAccountDetails.ts"
)

"Command: $NodePath $($argsList -join ' ') (RUNDECK_CLOUD_ORG=$CloudOrg, RUNDECK_TICKET_NUMBER=$TicketNumber)" | Tee-Object -FilePath $OutputPath -Append

try {
  & $NodePath @argsList 2>&1 | Tee-Object -FilePath $OutputPath -Append
  exit $LASTEXITCODE
} catch {
  $_ | Out-String | Tee-Object -FilePath $OutputPath -Append
  exit 1
}
