@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-autostart.ps1" -Quiet
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0collect-stats.ps1"
pause
