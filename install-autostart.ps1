# Registers logon autostart for collect-stats.ps1 (current user, no admin).
# Safe to run multiple times. Use -Quiet to suppress output.

param([switch]$Quiet)

$ErrorActionPreference = 'Stop'
$taskName = 'TerminalDashboardStats'
$root = $PSScriptRoot
$ps1 = Join-Path $root 'collect-stats.ps1'
$marker = Join-Path $root '.stats-autostart-installed'

if (-not (Test-Path $ps1)) {
    if (-not $Quiet) { Write-Host "collect-stats.ps1 not found in $root" -ForegroundColor Red }
    exit 1
}

$arg = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$ps1`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -RestartCount 999

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Set-Content -Path $marker -Value (Get-Date -Format 'o') -Encoding UTF8

function Start-StatsCollectorIfNeeded {
    $running = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -eq 'powershell.exe' -and $_.CommandLine -and
            ($_.CommandLine -like "*collect-stats.ps1*") -and
            ($_.CommandLine -like "*terminal-wallpaper*")
        }
    if ($running) { return }
    Start-Process -FilePath 'powershell.exe' `
        -ArgumentList $arg `
        -WorkingDirectory $root `
        -WindowStyle Hidden
}

try {
    Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
} catch {
    Start-StatsCollectorIfNeeded
}
Start-StatsCollectorIfNeeded

if (-not $Quiet) {
    Write-Host 'Terminal Dashboard: autostart installed.' -ForegroundColor Green
    Write-Host "Task: $taskName (at logon)"
    Write-Host "Stats collector started in background."
}
