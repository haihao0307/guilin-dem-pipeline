@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."
title Guilin DEM GitHub Push
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0PushToGitHub.ps1"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (echo GitHub task completed.) else (echo GitHub task stopped with error code %RC%.)
echo This window stays open. Type exit to close it.
endlocal & exit /b %RC%
