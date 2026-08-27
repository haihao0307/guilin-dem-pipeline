@echo off
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0LocalBuild.ps1" -AuthMode Auto
set EXIT_CODE=%ERRORLEVEL%
echo.
if not "%EXIT_CODE%"=="0" echo Kunming ASF build stopped with exit code %EXIT_CODE%.
if "%EXIT_CODE%"=="0" echo Kunming ASF build completed.
echo.
pause
exit /b %EXIT_CODE%
