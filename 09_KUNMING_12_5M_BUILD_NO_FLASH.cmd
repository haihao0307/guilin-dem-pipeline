@echo off
cd /d "%~dp0"
cmd.exe /d /k powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0projects\kunming\local_tools\LocalBuild.ps1" -AuthMode Auto
