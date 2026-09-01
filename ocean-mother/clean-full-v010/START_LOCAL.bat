@echo off
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -B tools\serve.py
  goto done
)
where python >nul 2>nul
if not errorlevel 1 (
  python -B tools\serve.py
  goto done
)
echo Python 3 is required for the local HTTP server.
echo The online workbench is available in START_HERE.md.
:done
pause
