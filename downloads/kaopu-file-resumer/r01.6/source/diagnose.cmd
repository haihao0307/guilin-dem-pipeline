@echo off
cd /d "%~dp0"
echo Kaopu File Resumer r01.3 startup check
py -3.12 bootstrap.pyw
if exist startup.log type startup.log
echo.
echo Please share this output or startup.log if the window did not open.
pause
