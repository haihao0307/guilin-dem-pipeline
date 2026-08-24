@echo off
cd /d "%~dp0"
cmd.exe /d /k powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0projects\wenzhou\local_tools\LocalDownload.ps1"
