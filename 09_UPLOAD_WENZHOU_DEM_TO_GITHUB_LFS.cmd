@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\wenzhou-archive\UploadWenzhouCogToGithubLfs.ps1" %*
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo Upload stopped with error code %RC%.
) else (
  echo Upload command completed.
)
pause
exit /b %RC%
