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
$chromeRepair = Join-Path $repoRoot 'tools\asf-local\RepairChromeSessionDownloader.ps1'

foreach ($required in @($common, $downloader, $mosaic, $requirements)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Required shared pipeline file was not found: $required"
    }
}

. $common

$workRoot = if ($env:KUNMING_DEM_WORK_ROOT) {
    $env:KUNMING_DEM_WORK_ROOT
}
else {
    'C:\HaihaoDEM\Kunming_Cuihu_20000km2_12_5m'
}

$sourceConfig = Join-Path $projectRoot 'config\task_config.json'
$sourceManifest = Join-Path $projectRoot 'config\existing_five_manifest.json'
$sourceResolvedJson = Join-Path $projectRoot 'metadata\resolved_aoi.json'
$sourceResolvedGeoJson = Join-Path $projectRoot 'metadata\resolved_aoi.geojson'
$sourceAoi = Join-Path $projectRoot 'aoi\kunming_cuihu_20000km2_square.geojson'

foreach ($required in @($sourceConfig, $sourceManifest, $sourceResolvedJson, $sourceResolvedGeoJson, $sourceAoi)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Required Kunming project file was not found: $required"
    }
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

Copy-Item -LiteralPath $sourceConfig -Destination (Join-Path $workRoot 'config\task_config.json') -Force
Copy-Item -LiteralPath $sourceManifest -Destination (Join-Path $workRoot 'config\existing_five_manifest.json') -Force
Copy-Item -LiteralPath $sourceResolvedJson -Destination (Join-Path $workRoot 'metadata\resolved_aoi.json') -Force
Copy-Item -LiteralPath $sourceResolvedGeoJson -Destination (Join-Path $workRoot 'metadata\resolved_aoi.geojson') -Force
Copy-Item -LiteralPath $sourceAoi -Destination (Join-Path $workRoot 'aoi\kunming_cuihu_20000km2_square.geojson') -Force
Copy-Item -LiteralPath $requirements -Destination (Join-Path $workRoot 'requirements.txt') -Force

$runtimeConfig = Join-Path $workRoot 'config\task_config.json'
$planPath = Join-Path $workRoot 'metadata\selected_products.json'
$chromeTaskPath = Join-Path $workRoot 'metadata\chrome_session_tasks.json'
$chromeSessionScript = 'C:\HaihaoDEM\ASF_v104_local\scripts\run_chrome_session_download.ps1'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$log = Join-Path $workRoot ("logs\KUNMING_ASF_12_5M_{0}.log" -f $stamp)
$summary = Join-Path $workRoot 'logs\LAST_KUNMING_ASF_12_5M.txt'
$transcriptStarted = $false
$exitCode = 0
$credentialSource = 'none'
$token = $null

function Get-SavedToken {
    if ($env:EARTHDATA_TOKEN -and $env:EARTHDATA_TOKEN.Trim()) {
        return [pscustomobject]@{ Value = $env:EARTHDATA_TOKEN.Trim(); Source = 'environment' }
    }
    $saved = Load-EarthdataToken
    if ($saved -and $saved.Trim()) {
        return [pscustomobject]@{ Value = $saved.Trim(); Source = 'windows-dpapi' }
    }
    return $null
}

function Write-ChromeTaskFile {
    param([string]$PlanFile, [string]$OutputFile)
    $plan = Get-Content -Raw -LiteralPath $PlanFile | ConvertFrom-Json
    $tasks = @()
    foreach ($product in @($plan.selectedNewProducts)) {
        $url = $null
        if (@($product.directDemUrls).Count -gt 0) {
            $url = @($product.directDemUrls)[0]
        }
        elseif ($product.archiveUrl) {
            $url = [string]$product.archiveUrl
        }
        if (-not $url) { continue }
        $uri = [Uri]$url
        $fileName = [IO.Path]::GetFileName($uri.AbsolutePath)
        if (-not $fileName) { $fileName = ([string]$product.granuleName + '.zip') }
        $tasks += [pscustomobject]@{
            granuleName = [string]$product.granuleName
            fileName = $fileName
            url = $url
            outputRoot = $workRoot
        }
    }
    @($tasks) | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputFile -Encoding UTF8
    return @($tasks).Count
}

function Import-ChromeDownloadedDem {
    param([string]$PlanFile)
    $plan = Get-Content -Raw -LiteralPath $PlanFile | ConvertFrom-Json
    $granules = @($plan.selectedNewProducts | ForEach-Object { [string]$_.granuleName })
    $searchRoots = @(
        'C:\HaihaoDEM\ASF_v104_local\data\raw\dem',
        'C:\HaihaoDEM\ASF_v104_local\downloads',
        (Join-Path $env:USERPROFILE 'Downloads')
    ) | Where-Object { Test-Path -LiteralPath $_ }
    $targetRoot = Join-Path $workRoot 'data\raw\dem'
    $copied = 0
    foreach ($root in $searchRoots) {
        Get-ChildItem -LiteralPath $root -File -Recurse -ErrorAction SilentlyContinue | Where-Object {
            $name = $_.Name
            ($name -match '(?i)(\.dem\.tif|_dem\.tif)$') -and
            (@($granules | Where-Object { $name -like ("*{0}*" -f $_) }).Count -gt 0)
        } | ForEach-Object {
            $target = Join-Path $targetRoot $_.Name
            Copy-Item -LiteralPath $_.FullName -Destination $target -Force
            $copied += 1
        }
    }
    return $copied
}

try {
    Start-Transcript -Path $log -Append | Out-Null
    $transcriptStarted = $true

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

    if ($PlanOnly) {
        @(
            'STATUS=PLAN_COMPLETE',
            'PROJECT=KUNMING_CUIHU_20000KM2',
            'PRODUCT_LABEL=12.5m output-grid ASF RTC reference DEM',
            ("PLAN={0}" -f $planPath),
            ("WORK_ROOT={0}" -f $workRoot),
            ("LOG={0}" -f $log)
        ) | Set-Content -LiteralPath $summary -Encoding UTF8
        Write-Host ("ASF plan completed: {0}" -f $planPath) -ForegroundColor Green
        return
    }

    $saved = Get-SavedToken
    if ($AuthMode -eq 'Token' -and $null -eq $saved) {
        throw 'No Earthdata token is available in EARTHDATA_TOKEN or the Windows DPAPI token file.'
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
        if (-not (Test-Path -LiteralPath $chromeSessionScript)) {
            throw "Authenticated Chrome session downloader was not found: $chromeSessionScript"
        }
        $taskCount = Write-ChromeTaskFile -PlanFile $planPath -OutputFile $chromeTaskPath
        if ($taskCount -le 0) {
            throw 'The ASF plan contains no Chrome-downloadable DEM or archive URL.'
        }
        $credentialSource = 'authenticated-chrome-session'
        $env:ASF_CHROME_TASK_FILE = $chromeTaskPath
        $env:ASF_PROJECT_WORK_ROOT = $workRoot
        $env:ASF_PROJECT_ID = 'kunming-cuihu-20000km2'

        if (Test-Path -LiteralPath $chromeRepair) {
            & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $chromeRepair -Path $chromeSessionScript -Apply
            if ($LASTEXITCODE -ne 0) {
                throw "ASF Chrome session Count repair stopped with exit code $LASTEXITCODE"
            }
        }

        $command = Get-Command -Name $chromeSessionScript
        $chromeArguments = @()
        if ($command.Parameters.ContainsKey('TaskFile')) {
            $chromeArguments += @('-TaskFile', $chromeTaskPath)
        }
        if ($command.Parameters.ContainsKey('OutputRoot')) {
            $chromeArguments += @('-OutputRoot', $workRoot)
        }
        & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $chromeSessionScript @chromeArguments
        if ($LASTEXITCODE -ne 0) {
            throw "ASF Chrome session downloader stopped with exit code $LASTEXITCODE. Check C:\HaihaoDEM\ASF_v104_local\logs\chrome-session-download.log"
        }
        $copied = Import-ChromeDownloadedDem -PlanFile $planPath
        if ($copied -le 0) {
            throw 'Chrome session finished without any selected Kunming *.dem.tif being imported into the project work directory.'
        }
    }

    Invoke-Python -Python $python -Arguments @(
        $mosaic,
        '--config', $runtimeConfig,
        '--root', $workRoot
    )

    $finalDem = Join-Path $workRoot 'outputs\KUNMING_CUIHU_20000KM2_ASF_RTC_12_5M_COG.tif'
    $qa = Join-Path $workRoot 'reports\QA_REPORT.json'
    if (-not (Test-Path -LiteralPath $finalDem)) {
        throw "Final Kunming DEM was not created: $finalDem"
    }
    if (-not (Test-Path -LiteralPath $qa)) {
        throw "Kunming QA report was not created: $qa"
    }

    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $finalDem).Hash.ToLowerInvariant()
    @(
        'STATUS=SUCCESS',
        'PROJECT=KUNMING_CUIHU_20000KM2',
        'PRODUCT_LABEL=12.5m output-grid ASF RTC reference DEM',
        'NATIVE_12_5M_SURVEY_CLAIM=false',
        ("AUTH_SOURCE={0}" -f $credentialSource),
        ("FINAL_DEM={0}" -f $finalDem),
        ("FINAL_DEM_BYTES={0}" -f (Get-Item -LiteralPath $finalDem).Length),
        ("FINAL_DEM_SHA256={0}" -f $hash),
        ("QA={0}" -f $qa),
        ("WORK_ROOT={0}" -f $workRoot),
        ("LOG={0}" -f $log)
    ) | Set-Content -LiteralPath $summary -Encoding UTF8

    Write-Host ''
    Write-Host 'Kunming ASF DEM download and mosaic completed.' -ForegroundColor Green
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
    Remove-Item Env:\ASF_CHROME_TASK_FILE -ErrorAction SilentlyContinue
    Remove-Item Env:\ASF_PROJECT_WORK_ROOT -ErrorAction SilentlyContinue
    Remove-Item Env:\ASF_PROJECT_ID -ErrorAction SilentlyContinue
    $token = $null
    if ($transcriptStarted) {
        try { Stop-Transcript | Out-Null } catch {}
    }
}

exit $exitCode
