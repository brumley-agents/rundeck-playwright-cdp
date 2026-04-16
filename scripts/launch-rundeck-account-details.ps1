Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stateDirectory = Join-Path $projectRoot "auth"
$statePath = Join-Path $stateDirectory "launcher-state.json"
$envPath = Join-Path $projectRoot ".env"
$launcherLogPath = Join-Path $stateDirectory "launcher.log"

function Set-ProcessEnvFromDotEnv {
  param(
    [string]$Path
  )

  if (-not (Test-Path $Path)) {
    return
  }

  Get-Content $Path | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') {
      return
    }

    $parts = $_ -split '=', 2
    if ($parts.Count -eq 2) {
      [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
  }
}

function Get-LauncherState {
  if (-not (Test-Path $statePath)) {
    return @{}
  }

  try {
    return (Get-Content $statePath -Raw | ConvertFrom-Json -AsHashtable)
  } catch {
    return @{}
  }
}

function Save-LauncherState {
  param(
    [string]$CloudOrg,
    [string]$TicketNumber
  )

  New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null

  @{
    cloudOrg = $CloudOrg
    ticketNumber = $TicketNumber
  } | ConvertTo-Json | Set-Content -Path $statePath
}

function Write-LauncherLog {
  param(
    [string]$Message
  )

  New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $launcherLogPath -Value "[$timestamp] $Message"
}

function Resolve-NodeCommand {
  $command = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($command -and $command.Source) {
    return $command.Source
  }

  $candidatePaths = @(
    "C:\Program Files\nodejs\node.exe",
    (Join-Path ${env:ProgramFiles(x86)} "nodejs\node.exe"),
    "C:\Program Files\sf\client\bin\node.exe"
  ) | Where-Object { $_ }

  foreach ($candidate in $candidatePaths) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw 'Could not find node.exe. Install Node.js or add node.exe to PATH.'
}

function Resolve-PlaywrightCliPath {
  $candidatePaths = @(
    (Join-Path $projectRoot "node_modules\playwright\cli.js"),
    (Join-Path $projectRoot "..\rundeck-playwright\node_modules\playwright\cli.js")
  )

  foreach ($candidate in $candidatePaths) {
    try {
      $resolved = (Resolve-Path $candidate -ErrorAction Stop).Path
      if (Test-Path $resolved) {
        return $resolved
      }
    } catch {
      continue
    }
  }

  throw "Playwright CLI not found. Checked: $($candidatePaths -join '; ')"
}

function New-LauncherProcess {
  param(
    [string]$FileName,
    [string]$Arguments
  )

  $processInfo = New-Object System.Diagnostics.ProcessStartInfo
  $processInfo.FileName = $FileName
  $processInfo.Arguments = $Arguments
  $processInfo.WorkingDirectory = $projectRoot
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true

  return New-Object System.Diagnostics.Process -Property @{
    StartInfo = $processInfo
    EnableRaisingEvents = $true
  }
}

function New-PlaywrightProcess {
  param(
    [string]$CloudOrg,
    [string]$TicketNumber
  )

  $nodeCommand = Resolve-NodeCommand
  $playwrightCliPath = Resolve-PlaywrightCliPath
  $runnerScriptPath = Join-Path $projectRoot "scripts\run-playwright-job.ps1"

  $outputPath = Join-Path $stateDirectory ("launcher-{0}.combined.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
  $arguments = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$runnerScriptPath`"",
    "-NodePath", "`"$nodeCommand`"",
    "-PlaywrightCliPath", "`"$playwrightCliPath`"",
    "-CloudOrg", "`"$($CloudOrg.Replace('"', '\"'))`"",
    "-TicketNumber", "`"$($TicketNumber.Replace('"', '\"'))`"",
    "-OutputPath", "`"$outputPath`""
  ) -join " "

  $process = New-LauncherProcess -FileName "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -Arguments $arguments
  $process | Add-Member -NotePropertyName CombinedOutputPath -NotePropertyValue $outputPath
  return $process
}

function New-ScriptProcess {
  param(
    [string]$ScriptPath,
    [string]$ScriptArguments
  )

  $powershellPath = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
  if (-not (Test-Path $powershellPath)) {
    $powershellPath = "powershell.exe"
  }

  $arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" {1}' -f $ScriptPath, $ScriptArguments
  return New-LauncherProcess -FileName $powershellPath -Arguments $arguments
}

Set-ProcessEnvFromDotEnv -Path $envPath
$launcherState = Get-LauncherState

$initialCloudOrg = if ($launcherState.cloudOrg) {
  [string]$launcherState.cloudOrg
} elseif ($env:RUNDECK_CLOUD_ORG) {
  [string]$env:RUNDECK_CLOUD_ORG
} else {
  ""
}

$initialTicketNumber = if ($launcherState.ticketNumber) {
  [string]$launcherState.ticketNumber
} elseif ($env:RUNDECK_TICKET_NUMBER) {
  [string]$env:RUNDECK_TICKET_NUMBER
} else {
  ""
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "Rundeck Account Details Launcher"
$form.Size = New-Object System.Drawing.Size(920, 720)
$form.StartPosition = "CenterScreen"
$form.MinimumSize = New-Object System.Drawing.Size(920, 720)

$labelCloudOrg = New-Object System.Windows.Forms.Label
$labelCloudOrg.Location = New-Object System.Drawing.Point(16, 18)
$labelCloudOrg.Size = New-Object System.Drawing.Size(180, 20)
$labelCloudOrg.Text = "Cloud URL / Cloud Org"

$textCloudOrg = New-Object System.Windows.Forms.TextBox
$textCloudOrg.Location = New-Object System.Drawing.Point(16, 40)
$textCloudOrg.Size = New-Object System.Drawing.Size(870, 28)
$textCloudOrg.Text = $initialCloudOrg

$labelTicket = New-Object System.Windows.Forms.Label
$labelTicket.Location = New-Object System.Drawing.Point(16, 78)
$labelTicket.Size = New-Object System.Drawing.Size(180, 20)
$labelTicket.Text = "Ticket Number"

$textTicket = New-Object System.Windows.Forms.TextBox
$textTicket.Location = New-Object System.Drawing.Point(16, 100)
$textTicket.Size = New-Object System.Drawing.Size(300, 28)
$textTicket.Text = $initialTicketNumber

$buttonRun = New-Object System.Windows.Forms.Button
$buttonRun.Location = New-Object System.Drawing.Point(16, 144)
$buttonRun.Size = New-Object System.Drawing.Size(150, 34)
$buttonRun.Text = "Run Job"

$buttonStartEdge = New-Object System.Windows.Forms.Button
$buttonStartEdge.Location = New-Object System.Drawing.Point(176, 144)
$buttonStartEdge.Size = New-Object System.Drawing.Size(150, 34)
$buttonStartEdge.Text = "Start Edge CDP"

$buttonCheckCdp = New-Object System.Windows.Forms.Button
$buttonCheckCdp.Location = New-Object System.Drawing.Point(336, 144)
$buttonCheckCdp.Size = New-Object System.Drawing.Size(150, 34)
$buttonCheckCdp.Text = "Check CDP"

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Location = New-Object System.Drawing.Point(16, 188)
$statusLabel.Size = New-Object System.Drawing.Size(870, 20)
$statusLabel.Text = "Ready"

$outputBox = New-Object System.Windows.Forms.TextBox
$outputBox.Location = New-Object System.Drawing.Point(16, 214)
$outputBox.Size = New-Object System.Drawing.Size(870, 452)
$outputBox.Multiline = $true
$outputBox.ScrollBars = "Vertical"
$outputBox.ReadOnly = $true
$outputBox.Font = New-Object System.Drawing.Font("Consolas", 10)

$form.Controls.AddRange(@(
  $labelCloudOrg,
  $textCloudOrg,
  $labelTicket,
  $textTicket,
  $buttonRun,
  $buttonStartEdge,
  $buttonCheckCdp,
  $statusLabel,
  $outputBox
))

$activeProcess = $null
$outputPollTimer = New-Object System.Windows.Forms.Timer
$outputPollTimer.Interval = 750
$activeStdoutPath = $null
$activeStderrPath = $null
$lastRenderedOutput = ""

function Append-Output {
  param(
    [string]$Text
  )

  if ([string]::IsNullOrEmpty($Text)) {
    return
  }

  Write-LauncherLog $Text

  $appendAction = [System.Action]{
    $outputBox.AppendText($Text + [Environment]::NewLine)
  }

  $null = $outputBox.BeginInvoke($appendAction)
}

function Render-ActiveProcessOutput {
  $combinedOutput = @()

  if ($script:activeStdoutPath -and (Test-Path $script:activeStdoutPath)) {
    $combinedOutput += Get-Content $script:activeStdoutPath -Raw
  }

  if ($script:activeStderrPath -and (Test-Path $script:activeStderrPath)) {
    $stderrText = Get-Content $script:activeStderrPath -Raw
    if ($stderrText) {
      $combinedOutput += $stderrText
    }
  }

  $text = ($combinedOutput -join [Environment]::NewLine).TrimEnd()
  if ($text -eq $script:lastRenderedOutput) {
    return
  }

  $script:lastRenderedOutput = $text
  $outputBox.Text = if ($text) { $text } else { "" }
  $outputBox.SelectionStart = $outputBox.TextLength
  $outputBox.ScrollToCaret()
}

function Set-Status {
  param(
    [string]$Text
  )

  $statusAction = [System.Action]{
    $statusLabel.Text = $Text
  }

  Write-LauncherLog "STATUS: $Text"
  $null = $statusLabel.BeginInvoke($statusAction)
}

function Set-ControlsEnabled {
  param(
    [bool]$Enabled
  )

  $updateAction = [System.Action]{
    $buttonRun.Enabled = $Enabled
    $buttonStartEdge.Enabled = $Enabled
    $buttonCheckCdp.Enabled = $Enabled
  }

  $null = $form.BeginInvoke($updateAction)
}

function Start-TrackedProcess {
  param(
    [System.Diagnostics.Process]$Process,
    [string]$StatusText
  )

  New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
  $combinedPath = $Process.PSObject.Properties["CombinedOutputPath"].Value

  $script:activeProcess = $Process
  $script:activeStdoutPath = $combinedPath
  $script:activeStderrPath = $null
  $script:lastRenderedOutput = ""
  $outputBox.Clear()
  Append-Output "Project: $projectRoot"
  Append-Output "Log: $launcherLogPath"
  if ($combinedPath) {
    Append-Output "Output: $combinedPath"
  }
  Append-Output "Command: $($Process.StartInfo.FileName) $($Process.StartInfo.Arguments)"
  Set-Status $StatusText
  Set-ControlsEnabled -Enabled $false

  try {
    $null = $Process.Start()
    $outputPollTimer.Start()
  } catch {
    Append-Output ""
    Append-Output $_.Exception.Message
    Set-Status "Failed to start process"
    Set-ControlsEnabled -Enabled $true
    $script:activeProcess = $null
  }
}

$outputPollTimer.Add_Tick({
  if (-not $script:activeProcess) {
    $outputPollTimer.Stop()
    return
  }

  try {
    Render-ActiveProcessOutput

    if ($script:activeProcess.HasExited) {
      $outputPollTimer.Stop()
      $exitCode = $script:activeProcess.ExitCode
      $summaryText = if ($exitCode -eq 0) {
        "Completed successfully"
      } else {
        "Exited with code $exitCode"
      }

      Append-Output ""
      Append-Output $summaryText
      Set-Status $summaryText
      Set-ControlsEnabled -Enabled $true
      $script:activeProcess = $null
    }
  } catch {
    Write-LauncherLog "Poll timer error: $($_.Exception.Message)"
    $outputPollTimer.Stop()
    Set-Status "Launcher polling failed"
    Set-ControlsEnabled -Enabled $true
    $script:activeProcess = $null
  }
})

$buttonRun.Add_Click({
  $cloudOrg = $textCloudOrg.Text.Trim()
  $ticketNumber = $textTicket.Text.Trim()

  if (-not $cloudOrg) {
    [System.Windows.Forms.MessageBox]::Show(
      "Enter a cloud URL or cloud org value.",
      "Missing Input",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
    return
  }

  if (-not $ticketNumber) {
    [System.Windows.Forms.MessageBox]::Show(
      "Enter a ticket number.",
      "Missing Input",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
    return
  }

  try {
    Save-LauncherState -CloudOrg $cloudOrg -TicketNumber $ticketNumber
    $process = New-PlaywrightProcess -CloudOrg $cloudOrg -TicketNumber $ticketNumber
    Start-TrackedProcess -Process $process -StatusText "Running Rundeck account details job..."
  } catch {
    [System.Windows.Forms.MessageBox]::Show(
      $_.Exception.Message,
      "Launcher Error",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  }
})

$buttonStartEdge.Add_Click({
  try {
    Save-LauncherState -CloudOrg $textCloudOrg.Text.Trim() -TicketNumber $textTicket.Text.Trim()
    $scriptPath = Join-Path $projectRoot "scripts\start-browser.ps1"
    $process = New-ScriptProcess -ScriptPath $scriptPath -ScriptArguments '-Browser edge'
    Start-TrackedProcess -Process $process -StatusText "Starting Edge with CDP enabled..."
  } catch {
    [System.Windows.Forms.MessageBox]::Show(
      $_.Exception.Message,
      "Launcher Error",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  }
})

$buttonCheckCdp.Add_Click({
  try {
    $scriptPath = Join-Path $projectRoot "scripts\browser-status.ps1"
    $process = New-ScriptProcess -ScriptPath $scriptPath -ScriptArguments ''
    Start-TrackedProcess -Process $process -StatusText "Checking CDP endpoint..."
  } catch {
    [System.Windows.Forms.MessageBox]::Show(
      $_.Exception.Message,
      "Launcher Error",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  }
})

$form.Add_FormClosing({
  if ($script:activeProcess -and -not $script:activeProcess.HasExited) {
    $result = [System.Windows.Forms.MessageBox]::Show(
      "A command is still running. Close the launcher anyway?",
      "Process Running",
      [System.Windows.Forms.MessageBoxButtons]::YesNo,
      [System.Windows.Forms.MessageBoxIcon]::Question
    )

    if ($result -ne [System.Windows.Forms.DialogResult]::Yes) {
      $_.Cancel = $true
      return
    }
  }
})

[void]$form.ShowDialog()
