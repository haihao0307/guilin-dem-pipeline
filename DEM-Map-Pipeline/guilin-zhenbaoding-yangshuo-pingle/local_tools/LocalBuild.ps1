param(
    [ValidateSet('auto','asf','fallback')]
    [string]$Mode = 'auto'
)

. (Join-Path $PSScriptRoot 'Common.ps1')
$packageRoot = Get-PackageRoot
$sourceRoot = Get-ProjectSourceRoot
$workRoot = Get-WorkRoot
$packageLogs = Join-Path $packageRoot 'logs'
New-Item -ItemType Directory -Force -Path $packageLogs | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$logFile = Join-Path $packageLogs ("LOCAL_BUILD_{0}_{1}.log" -f $Mode,$stamp)
$lastSummary = Join-Path $packageLogs 'LAST_LOCAL_BUILD.txt'
$transcript = $false
$exitCode = 0

try {
    Start-Transcript -Path $logFile -Append | Out-Null
    $transcript = $true
    Write-Host ''
    Write-Host 'Guilin extended DEM full local build' -ForegroundColor Cyan
    Write-Host ("Mode: {0}" -f $Mode)
    Write-Host ("Source: {0}" -f $sourceRoot)
    Write-Host ("Work: {0}" -f $workRoot)
    Write-Host ''

    Sync-SourceToWork -SourceRoot $sourceRoot -WorkRoot $workRoot
    $basePython = Ensure-Python
    $python = Ensure-Venv -BasePython $basePython -WorkRoot $workRoot

    $env:DEM_DATA_MODE = $Mode
    $token = Load-EarthdataToken
    if ($token) { $env:EARTHDATA_TOKEN = $token }
    elseif ($Mode -eq 'asf') {
        throw 'ASF mode requires a saved Earthdata token. Run root 07_SET_EARTHDATA_TOKEN_NO_FLASH.cmd or project 06_SET_EARTHDATA_TOKEN_NO_FLASH.cmd first.'
    }

    Invoke-Python -Python $python -Arguments @((Join-Path $workRoot 'scripts\run_cloud_pipeline.py'),'--root',$workRoot)

    $web = Join-Path $workRoot 'web\index.html'
    $output = Join-Path $workRoot 'outputs'
    @(
        'STATUS=SUCCESS',
        ("MODE={0}" -f $Mode),
        ("WORK_ROOT={0}" -f $workRoot),
        ("WEB={0}" -f $web),
        ("OUTPUTS={0}" -f $output),
        ("LOG={0}" -f $logFile)
    ) | Set-Content -LiteralPath $lastSummary -Encoding UTF8

    Write-Host ''
    Write-Host 'Build completed.' -ForegroundColor Green
    Write-Host ("Outputs: {0}" -f $output) -ForegroundColor Green
    Write-Host ("Web: {0}" -f $web) -ForegroundColor Green
    Start-Process explorer.exe -ArgumentList $output
    & (Join-Path $PSScriptRoot 'OpenLocalWeb.ps1') -WorkRoot $workRoot
}
catch {
    $exitCode = 1
    @(
        'STATUS=FAILED',
        ("MODE={0}" -f $Mode),
        ("MESSAGE={0}" -f $_.Exception.Message),
        ("LOG={0}" -f $logFile)
    ) | Set-Content -LiteralPath $lastSummary -Encoding UTF8
    Write-Host ''
    Write-Host 'Build stopped.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ("Log: {0}" -f $logFile) -ForegroundColor Yellow
}
finally {
    Remove-Item Env:\EARTHDATA_TOKEN -ErrorAction SilentlyContinue
    Remove-Item Env:\DEM_DATA_MODE -ErrorAction SilentlyContinue
    if ($transcript) { try { Stop-Transcript | Out-Null } catch {} }
}
exit $exitCode
