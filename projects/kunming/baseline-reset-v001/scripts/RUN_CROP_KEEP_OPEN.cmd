@echo off
setlocal
cd /d "%~dp0\.."
set "INPUT=%~1"
if "%INPUT%"=="" set "INPUT=C:\HaihaoDEM\Kunming\KUNMING_ASF_11TILES_RECT_12P5M_COG.tif"
set "OUTPUT=%~2"
if "%OUTPUT%"=="" set "OUTPUT=C:\HaihaoDEM\Kunming_Reset\KUNMING_BASELINE_RESET_CROP_12P5M_COG.tif"
python scripts\crop_authoritative_dem.py "%INPUT%" "%OUTPUT%" --report "C:\HaihaoDEM\Kunming_Reset\KUNMING_BASELINE_RESET_CROP_QA.json"
echo.
echo Exit code: %ERRORLEVEL%
pause
