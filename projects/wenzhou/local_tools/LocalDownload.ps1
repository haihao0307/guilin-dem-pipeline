param(
    [ValidateSet('Auto','Token','ChromeSession')]
    [string]$AuthMode = 'Auto'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-SavedEarthdataToken {
    if ($env:EARTHDATA_TOKEN -and $env:EARTHDATA_TOKEN.Trim()) {
        return [pscustomobject]@{ Value = $env:EARTHDATA_TOKEN.Trim(); Source = 'environment' }
    }
    $tokenFile = Join-Path $env:APPDATA 'HaihaoDEM\earthdata-token.dpapi'
    if (-not (Test-Path -LiteralPath $tokenFile)) {
        return $null
    }
    try {
        $encrypted = (Get-Content -Raw -LiteralPath $tokenFile).Trim()
        if (-not $encrypted) { return $null }
        $secure = $encrypted | ConvertTo-SecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try {
            $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        }
        finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
        if ($value -and $value.Trim()) {
            return [pscustomobject]@{ Value = $value.Trim(); Source = 'windows-dpapi' }
        }
    }
    catch {
        Write-Host ("Saved DPAPI token is unavailable: {0}" -f $_.Exception.Message) -ForegroundColor DarkYellow
    }
    return $null
}

function Find-Python {
    $preferred = @(
        'C:\HaihaoDEM\ASF_v104_local\.venv\Scripts\python.exe',
        'C:\HaihaoDEM\Guilin_Extended_DEM_Full_v2_0\.venv\Scripts\python.exe'
    )
    foreach ($path in $preferred) {
        if (Test-Path -LiteralPath $path) {
            return [pscustomobject]@{ Exe = $path; Prefix = @() }
        }
    }

    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($py) {
        foreach ($version in @('-3.13','-3.12','-3.11','-3.10','-3')) {
            & $py.Source $version -c 'import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 2)' 2>$null
            if ($LASTEXITCODE -eq 0) {
                return [pscustomobject]@{ Exe = $py.Source; Prefix = @($version) }
            }
        }
    }

    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($python) {
        & $python.Source -c 'import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 2)' 2>$null
        if ($LASTEXITCODE -eq 0) {
            return [pscustomobject]@{ Exe = $python.Source; Prefix = @() }
        }
    }

    throw 'Python 3.10 or newer was not found.'
}

function Invoke-PythonCommand {
    param([pscustomobject]$Python, [string[]]$Arguments)
    $all = @()
    if (@($Python.Prefix).Count -gt 0) { $all += @($Python.Prefix) }
    $all += @($Arguments)
    & $Python.Exe @all
    if ($LASTEXITCODE -ne 0) {
        throw "Python command stopped with exit code $LASTEXITCODE"
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$workRoot = if ($env:WENZHOU_DEM_WORK_ROOT) {
    $env:WENZHOU_DEM_WORK_ROOT
}
else {
    'C:\HaihaoDEM\Wenzhou_Qingjiang_22000km2_12_5m'
}

$downloader = Join-Path $repoRoot 'DEM-Map-Pipeline\guilin-zhenbaoding-yangshuo-pingle\scripts\asf_download_stdlib.py'
$chromeDownloader = Join-Path $repoRoot 'tools\asf-local\InvokeChromeSessionDownload.ps1'
$config = Join-Path $sourceRoot 'config\asf_download_config.json'
$fixture = Join-Path $sourceRoot 'metadata\asf_search_results_jsonlite2.json'
$resolvedAoi = Join-Path $sourceRoot 'metadata\resolved_aoi.json'
$existingManifest = Join-Path $sourceRoot 'config\existing_five_manifest.json'

foreach ($required in @($downloader, $chromeDownloader, $config, $fixture, $resolvedAoi, $existingManifest)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Required file was not found: $required"
    }
}

foreach ($directory in @(
    $workRoot,
    (Join-Path $workRoot 'config'),
    (Join-Path $workRoot 'metadata'),
    (Join-Path $workRoot 'reports'),
    (Join-Path $workRoot 'logs'),
    (Join-Path $workRoot 'data\raw\dem'),
    (Join-Path $workRoot 'data\raw\archives'),
    (Join-Path $workRoot 'data\raw\metadata')
)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
}

Copy-Item -LiteralPath $config -Destination (Join-Path $workRoot 'config\asf_download_config.json') -Force
Copy-Item -LiteralPath $existingManifest -Destination (Join-Path $workRoot 'config\existing_five_manifest.json') -Force
Copy-Item -LiteralPath $resolvedAoi -Destination (Join-Path $workRoot 'metadata\resolved_aoi.json') -Force
Copy-Item -LiteralPath $fixture -Destination (Join-Path $workRoot 'metadata\asf_search_results_jsonlite2.json') -Force

$runtimeConfig = Join-Path $workRoot 'config\asf_download_config.json'
$runtimeFixture = Join-Path $workRoot 'metadata\asf_search_results_jsonlite2.json'
$planPath = Join-Path $workRoot 'metadata\selected_products.json'
$python = Find-Python
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$log = Join-Path $workRoot ("logs\WENZHOU_12_5M_DOWNLOAD_{0}.log" -f $stamp)
$summary = Join-Path $workRoot 'logs\LAST_WENZHOU_12_5M_DOWNLOAD.txt'
$transcriptStarted = $false
$exitCode = 0
$credentialSource = 'none'
$token = $null

try {
    Start-Transcript -Path $log -Append | Out-Null
    $transcriptStarted = $true
    $env:PYTHONUTF8 = '1'
    $env:PYTHONIOENCODING = 'utf-8'

    Write-Host ''
    Write-Host 'Wenzhou Qingjiang 22000 km2 ASF RTC reference DEM download' -ForegroundColor Cyan
    Write-Host ("Work directory: {0}" -f $workRoot)
    Write-Host ("Authentication mode: {0}" -f $AuthMode)
    Write-Host ''

    Invoke-PythonCommand -Python $python -Arguments @(
        $downloader,
        '--config', $runtimeConfig,
        '--root', $workRoot,
        '--search-fixture', $runtimeFixture,
        '--plan-only'
    )

    if (-not (Test-Path -LiteralPath $planPath)) {
        throw "ASF selected-product plan was not created: $planPath"
    }
    $plan = Get-Content -Raw -LiteralPath $planPath | ConvertFrom-Json
    $selectedCount = @($plan.selectedNewProducts).Count
    Write-Host ("Selected products: {0}" -f $selectedCount)

    $saved = Get-SavedEarthdataToken
    if ($AuthMode -eq 'Token' -and $null -eq $saved) {
        throw 'Token mode was requested, but EARTHDATA_TOKEN and the Windows DPAPI token are unavailable.'
    }

    if ($AuthMode -ne 'ChromeSession' -and $null -ne $saved) {
        $token = $saved.Value
        $credentialSource = $saved.Source
        $env:EARTHDATA_TOKEN = $token
        Invoke-PythonCommand -Python $python -Arguments @(
            $downloader,
            '--config', $runtimeConfig,
            '--root', $workRoot,
            '--search-fixture', $runtimeFixture
        )
    }
    else {
        $credentialSource = 'existing-authenticated-chrome-session'
        & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $chromeDownloader `
            -PlanPath $planPath `
            -WorkRoot $workRoot `
            -ProjectId 'wenzhou-qingjiang-22000km2'
        if ($LASTEXITCODE -ne 0) {
            throw "Authenticated Chrome session download stopped with exit code $LASTEXITCODE"
        }
    }

    $demFiles = @(Get-ChildItem -LiteralPath (Join-Path $workRoot 'data\raw\dem') -File -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -match '(?i)(\.dem\.tif|_dem\.tif)$' -and $_.Length -gt 16
    })
    $archiveFiles = @(Get-ChildItem -LiteralPath (Join-Path $workRoot 'data\raw\archives') -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 16 })
    if (@($demFiles).Count -eq 0) {
        throw 'Authenticated ASF transfer completed without any usable *.dem.tif source file.'
    }

    @(
        'STATUS=SUCCESS',
        'PRODUCT_LABEL=12.5m output-grid ASF RTC reference DEM',
        'NATIVE_12_5M_SURVEY_CLAIM=false',
        ("AUTH_SOURCE={0}" -f $credentialSource),
        ("SELECTED_PRODUCT_COUNT={0}" -f $selectedCount),
        ("DEM_FILE_COUNT={0}" -f @($demFiles).Count),
        ("ARCHIVE_FILE_COUNT={0}" -f @($archiveFiles).Count),
        ("WORK_ROOT={0}" -f $workRoot),
        ("LOG={0}" -f $log)
    ) | Set-Content -LiteralPath $summary -Encoding UTF8

    Write-Host ''
    Write-Host 'Wenzhou ASF source download completed.' -ForegroundColor Green
    Write-Host ("DEM files: {0}" -f @($demFiles).Count) -ForegroundColor Green
    Start-Process explorer.exe -ArgumentList (Join-Path $workRoot 'data\raw\dem')
}
catch {
    $exitCode = 1
    @(
        'STATUS=FAILED',
        ("MESSAGE={0}" -f $_.Exception.Message),
        ("AUTH_SOURCE={0}" -f $credentialSource),
        ("WORK_ROOT={0}" -f $workRoot),
        ("LOG={0}" -f $log)
    ) | Set-Content -LiteralPath $summary -Encoding UTF8
    Write-Host ''
    Write-Host 'Wenzhou ASF source download stopped.' -ForegroundColor Red
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
