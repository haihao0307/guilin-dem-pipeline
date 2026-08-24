@echo off
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0RepairChromeSessionDownloader.ps1" -Apply
set EXIT_CODE=%ERRORLEVEL%
echo.
if not "%EXIT_CODE%"=="0" echo ASF Chrome Count repair stopped with exit code %EXIT_CODE%.
if "%EXIT_CODE%"=="0" echo ASF Chrome Count repair completed.
echo.
pause
exit /b %EXIT_CODE%
