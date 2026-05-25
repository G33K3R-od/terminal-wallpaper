@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Terminal Dashboard — установка автозапуска
echo.
echo  Установка автозапуска сбора статистики...
echo  (один раз — дальше при каждом входе в Windows)
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-autostart.ps1"
echo.
echo  Готово. Можно применять обои в Wallpaper Engine.
echo.
pause
