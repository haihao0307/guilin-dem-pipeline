@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\wenzhou-v200\UploadWenzhou17TileCogToGithubLfs.ps1" %*
set EXITCODE=%ERRORLEVEL%
echo.
if not "%EXITCODE%"=="0" (
  echo 上传未完成，错误代码 %EXITCODE%。请查看上方错误信息。
) else (
  echo 本地上传步骤完成，等待 GitHub Actions fresh clone 验证。
)
pause
exit /b %EXITCODE%
