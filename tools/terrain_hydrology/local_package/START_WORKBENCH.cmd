@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title 三地区真实地貌与水系工作台

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 start_workbench.py
  goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
  python start_workbench.py
  goto :end
)

echo 未找到 Python 3。
echo 请安装 Python 3，安装时勾选 Add Python to PATH，然后再次双击本文件。
pause

:end
if not %errorlevel%==0 pause
endlocal
