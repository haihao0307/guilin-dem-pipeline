@echo off
setlocal
cd /d "%~dp0"
set "PACKAGE=%~1"
if "%PACKAGE%"=="" set "PACKAGE=C:\HaihaoDEM\KUNMING_DEM_DATA_ONLY_12P5M_UNCOMPRESSED_V001.zip"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Publish-KunmingDemRelease.ps1" -PackagePath "%PACKAGE%"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if "%EXIT_CODE%"=="0" echo Kunming DEM GitHub Release upload and verification completed.
if not "%EXIT_CODE%"=="0" echo Kunming DEM GitHub Release upload stopped with exit code %EXIT_CODE%.
echo.
pause
exit /b %EXIT_CODE%
