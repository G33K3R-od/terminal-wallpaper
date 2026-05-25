# Removes logon autostart for Terminal Dashboard stats.

$ErrorActionPreference = 'SilentlyContinue'
$taskName = 'TerminalDashboardStats'
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Remove-Item (Join-Path $PSScriptRoot '.stats-autostart-installed') -Force -ErrorAction SilentlyContinue
Write-Host "Removed task: $taskName" -ForegroundColor Yellow
