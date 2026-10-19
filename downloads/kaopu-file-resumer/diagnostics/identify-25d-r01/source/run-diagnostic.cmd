@echo off
chcp 65001 >nul
py -3.12 "%~dp0check_chrome_downloads_25d.py"
pause
