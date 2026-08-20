@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Guilin DEM Local Tool
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0SetEarthdataToken.ps1" 
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (echo Completed.) else (echo Stopped with error code %RC%.)
echo This window stays open. Type exit to close it.
endlocal & exit /b %RC%
