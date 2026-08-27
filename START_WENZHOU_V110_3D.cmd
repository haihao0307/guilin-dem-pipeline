@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动小温的温州真实三维地图 V1.1...
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 tools\serve_wenzhou_v110.py
  goto :end
)
where python >nul 2>nul
if %errorlevel%==0 (
  python tools\serve_wenzhou_v110.py
  goto :end
)
echo.
echo 未找到 Python。请安装 Python 3 后重新双击本文件。
pause
:end
