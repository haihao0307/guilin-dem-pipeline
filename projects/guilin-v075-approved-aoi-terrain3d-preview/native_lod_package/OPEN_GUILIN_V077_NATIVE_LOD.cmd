@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 open_native_lod_viewer.py
  exit /b %errorlevel%
)
where python >nul 2>nul
if %errorlevel%==0 (
  python open_native_lod_viewer.py
  exit /b %errorlevel%
)
echo.
echo 未找到 Python。请安装 Python 3，然后重新双击本文件。
echo.
pause
exit /b 1
