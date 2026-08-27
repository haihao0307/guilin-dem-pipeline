param(
    [ValidateSet('Auto','Token','ChromeSession')]
    [string]$AuthMode = 'Auto',
    [switch]$PlanOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sharedRoot = Join-Path $repoRoot 'DEM-Map-Pipeline\guilin-zhenbaoding-yangshuo-pingle'
$common = Join-Path $sharedRoot 'local_tools\Common.ps1'
$downloader = Join-Path $sharedRoot 'scripts\asf_download_stdlib.py'
$mosaic = Join-Path $sharedRoot 'scripts\mosaic_dem.py'
$requirements = Join-Path $sharedRoot 'requirements.txt'
$chromeDownloader = Join-Path $repoRoot 'tools\asf-local\InvokeChromeSessionDownload.ps1'

foreach ($required in @($common, $downloader, $mosaic, $requirements, $chromeDownloader)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Required pipeline file was not found: $required"
    }
}

. $common

$workRoot = if ($env:KUNMING_DEM_WORK_ROOT) {
    $env:KUNMING_DEM_WORK_ROOT
}
else {
    'C:\HaihaoDEM\Kunming_Cuihu_20000km2_12_5m'
}

$projectFiles = @{
    'config\task_config.json' = 'config\task_config.json'
    'config\existing_five_manifest.json' = 'config\existing_five_manifest.json'
    'metadata\resolved_aoi.json' = 'metadata\resolved_aoi.json'
    'metadata\resolved_aoi.geojson' = 'metadata\resolved_aoi.geojson'
    'metadata\runtime_source.json' = 'metadata\runtime_source.json'
    'aoi\kunming_cuihu_20000km2_square.geojson' = 'aoi\kunming_cuihu_20000km2_square.geojson'
}

foreach ($directory in @(
    $workRoot,
    (Join-Path $workRoot 'aoi'),
    (Join-Path $workRoot 'config'),
    (Join-Path $workRoot 'metadata'),
    (Join-Path $workRoot 'reports'),
    (Join-Path $workRoot 'outputs'),
    (Join-Path $workRoot 'logs'),
    (Join-Path $workRoot 'data\raw\dem'),
    (Join-Path $workRoot 'data\raw\archives'),
    (Join-Path $workRoot 'data\raw\metadata'),
    (Join-Path $workRoot 'data\work')
)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
}

foreach ($relative in $projectFiles.Keys) {
    $source = Join-Path $projectRoot $relative
    if (-not (Test-Path -LiteralPath $source)) {
        throw "Required Kunming project file was not found: $source"
    }
    $destination = Join-Path $workRoot $projectFiles[$relative]
    Copy-Item -LiteralPath $source -Destination $destination -Force
}
Copy-Item -LiteralPath $requirements -Destination (Join-Path $workRoot 'requirements.txt') -Force

$runtimeConfig = Join-Path $workRoot 'config\task_config.json'
$planPath = Join-Path $workRoot 'metadata\selected_products.json'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$log = Join-Path $workRoot ("logs\KUNMING_ASF_12_5M_{0}.log" -f $stamp)
$summary = Join-Path $workRoot 'logs\LAST_KUNMING_ASF_12_5M.txt'
$transcriptStarted = $false
$exitCode = 0
$credentialSource = 'none'
$token = $null

function Get-SavedEarthdataToken {
    if ($env:EARTHDATA_TOKEN -and $env:EARTHDATA_TOKEN.Trim()) {
        return [pscustomobject]@{ Value = $env:EARTHDATA_TOKEN.Trim(); Source = 'environment' }
    }
    try {
        $saved = Load-EarthdataToken
        if ($saved -and $saved.Trim()) {
            return [pscustomobject]@{ Value = $saved.Trim(); Source = 'windows-dpapi' }
        }
    }
    catch {
        Write-Host ("Saved DPAPI token is unavailable: {0}" -f $_.Exception.Message) -ForegroundColor DarkYellow
    }
    return $null
}

try {
    Start-Transcript -Path $log -Append | Out-Null
    $transcriptStarted = $true
    $env:PYTHONUTF8 = '1'
    $env:PYTHONIOENCODING = 'utf-8'

    Write-Host ''
    Write-Host 'Kunming Cuihu 20000 km2 ASF RTC reference DEM build' -ForegroundColor Cyan
    Write-Host ("Work directory: {0}" -f $workRoot)
    Write-Host ("Authentication mode: {0}" -f $AuthMode)
    Write-Host ''

    $basePython = Ensure-Python
    $python = Ensure-Venv -BasePython $basePython -WorkRoot $workRoot

    Invoke-Python -Python $python -Arguments @(
        $downloader,
        '--config', $runtimeConfig,
        '--root', $workRoot,
        '--plan-only'
    )

    if (-not (Test-Path -LiteralPath $planPath)) {
        throw "ASF selected-product plan was not created: $planPath"
    }

    $plan = Get-Content -Raw -LiteralPath $planPath | ConvertFrom-Json
    $selectedCount = @($plan.selectedNewProducts).Count
    $selectedCoverage = [double]$plan.searchDiagnostics.selectedCoverageFraction
    Write-Host ("Selected products: {0}" -f $selectedCount)
    Write-Host ("Planned coverage: {0:P5}" -f $selectedCoverage)

    if ($PlanOnly) {
        @(
            'STATUS=PLAN_COMPLETE',
            'PROJECT=KUNMING_CUIHU_20000KM2',
            ("SELECTED_PRODUCTS={0}" -f $selectedCount),
            ("PLANNED_COVERAGE={0}" -f $selectedCoverage),
            ("PLAN={0}" -f $planPath),
            ("WORK_ROOT={0}" -f $workRoot),
            ("LOG={0}" -f $log)
        ) | Set-Content -LiteralPath $summary -Encoding UTF8
        Write-Host ("ASF plan completed: {0}" -f $planPath) -ForegroundColor Green
        return
    }

    $saved = Get-SavedEarthdataToken
    if ($AuthMode -eq 'Token' -and $null -eq $saved) {
        throw 'Token mode was requested, but EARTHDATA_TOKEN and the Windows DPAPI token are unavailable.'
    }

    if ($AuthMode -ne 'ChromeSession' -and $null -ne $saved) {
        $token = $saved.Value
        $credentialSource = $saved.Source
        $env:EARTHDATA_TOKEN = $token
        Invoke-Python -Python $python -Arguments @(
            $downloader,
            '--config', $runtimeConfig,
            '--root', $workRoot
        )
    }
    else {
        $credentialSource = 'existing-authenticated-chrome-session'
        & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $chromeDownloader `
            -PlanPath $planPath `
            -WorkRoot $workRoot `
            -ProjectId 'kunming-cuihu-20000km2'
        if ($LASTEXITCODE -ne 0) {
            throw "Authenticated Chrome session download stopped with exit code $LASTEXITCODE"
        }
    }

    $demFiles = @(Get-ChildItem -LiteralPath (Join-Path $workRoot 'data\raw\dem') -File -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -match '(?i)(\.dem\.tif|_dem\.tif)$' -and $_.Length -gt 16
    })
    if (@($demFiles).Count -eq 0) {
        throw 'Authenticated ASF transfer completed without any usable *.dem.tif source file.'
    }

    Invoke-Python -Python $python -Arguments @(
        $mosaic,
        '--config', $runtimeConfig,
        '--root', $workRoot
    )

    $finalDem = Join-Path $workRoot 'outputs\KUNMING_CUIHU_20000KM2_ASF_RTC_12_5M_COG.tif'
    $sourceCount = Join-Path $workRoot 'outputs\KUNMING_CUIHU_source_count_COG.tif'
    $fillClass = Join-Path $workRoot 'outputs\KUNMING_CUIHU_fill_class_COG.tif'
    $qa = Join-Path $workRoot 'reports\QA_REPORT.json'
    foreach ($required in @($finalDem, $sourceCount, $fillClass, $qa)) {
        if (-not (Test-Path -LiteralPath $required)) {
            throw "Required Kunming output was not created: $required"
        }
    }

    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $finalDem).Hash.ToLowerInvariant()
    @(
        'STATUS=SUCCESS',
        'PROJECT=KUNMING_CUIHU_20000KM2',
        'PRODUCT_LABEL=12.5m output-grid ASF RTC reference DEM',
        'NATIVE_12_5M_SURVEY_CLAIM=false',
        ("AUTH_SOURCE={0}" -f $credentialSource),
        ("SOURCE_DEM_COUNT={0}" -f @($demFiles).Count),
        ("FINAL_DEM={0}" -f $finalDem),
        ("FINAL_DEM_BYTES={0}" -f (Get-Item -LiteralPath $finalDem).Length),
        ("FINAL_DEM_SHA256={0}" -f $hash),
        ("SOURCE_COUNT={0}" -f $sourceCount),
        ("FILL_CLASS={0}" -f $fillClass),
        ("QA={0}" -f $qa),
        ("WORK_ROOT={0}" -f $workRoot),
        ("LOG={0}" -f $log)
    ) | Set-Content -LiteralPath $summary -Encoding UTF8

    Write-Host ''
    Write-Host 'Kunming ASF DEM download and mosaic completed.' -ForegroundColor Green
    Write-Host ("Source DEM files: {0}" -f @($demFiles).Count) -ForegroundColor Green
    Write-Host ("Final DEM: {0}" -f $finalDem) -ForegroundColor Green
    Write-Host ("SHA-256: {0}" -f $hash) -ForegroundColor Green
    Start-Process explorer.exe -ArgumentList (Join-Path $workRoot 'outputs')
}
catch {
    $exitCode = 1
    @(
        'STATUS=FAILED',
        'PROJECT=KUNMING_CUIHU_20000KM2',
        ("MESSAGE={0}" -f $_.Exception.Message),
        ("AUTH_SOURCE={0}" -f $credentialSource),
        ("WORK_ROOT={0}" -f $workRoot),
        ("LOG={0}" -f $log)
    ) | Set-Content -LiteralPath $summary -Encoding UTF8
    Write-Host ''
    Write-Host 'Kunming ASF DEM build stopped.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ("Log: {0}" -f $log) -ForegroundColor Yellow
}
finally {
    Remove-Item Env:\EARTHDATA_TOKEN -ErrorAction SilentlyContinue
    Remove-Item Env:\PYTHONUTF8 -ErrorAction SilentlyContinue
    Remove-Item Env:\PYTHONIOENCODING -ErrorAction SilentlyContinue
    $token = $null
    if ($transcriptStarted) {
        try { Stop-Transcript | Out-Null } catch {}
    }
}

exit $exitCode
