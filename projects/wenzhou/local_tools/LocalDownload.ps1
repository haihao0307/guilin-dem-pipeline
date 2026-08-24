Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Load-EarthdataToken {
    $tokenFile = Join-Path $env:APPDATA 'HaihaoDEM\earthdata-token.dpapi'
    if (-not (Test-Path -LiteralPath $tokenFile)) {
        throw "Earthdata token file was not found: $tokenFile"
    }
    $encrypted = (Get-Content -Raw -LiteralPath $tokenFile).Trim()
    if (-not $encrypted) {
        throw "Earthdata token file is empty: $tokenFile"
    }
    $secure = $encrypted | ConvertTo-SecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
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

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$workRoot = if ($env:WENZHOU_DEM_WORK_ROOT) {
    $env:WENZHOU_DEM_WORK_ROOT
}
else {
    'C:\HaihaoDEM\Wenzhou_Qingjiang_22000km2_12_5m'
}

$downloader = Join-Path $repoRoot 'DEM-Map-Pipeline\guilin-zhenbaoding-yangshuo-pingle\scripts\asf_download_stdlib.py'
$config = Join-Path $sourceRoot 'config\asf_download_config.json'
$fixture = Join-Path $sourceRoot 'metadata\asf_search_results_jsonlite2.json'
$resolvedAoi = Join-Path $sourceRoot 'metadata\resolved_aoi.json'
$existingManifest = Join-Path $sourceRoot 'config\existing_five_manifest.json'

foreach ($required in @($downloader, $config, $fixture, $resolvedAoi, $existingManifest)) {
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
$python = Find-Python
$token = Load-EarthdataToken
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$log = Join-Path $workRoot ("logs\WENZHOU_12_5M_DOWNLOAD_{0}.log" -f $stamp)
$summary = Join-Path $workRoot 'logs\LAST_WENZHOU_12_5M_DOWNLOAD.txt'
$transcriptStarted = $false
$exitCode = 0

try {
    Start-Transcript -Path $log -Append | Out-Null
    $transcriptStarted = $true
    $env:EARTHDATA_TOKEN = $token

    Write-Host ''
    Write-Host 'Wenzhou Qingjiang 22000 km2 12.5 m ASF DEM download' -ForegroundColor Cyan
    Write-Host ("Work directory: {0}" -f $workRoot)
    Write-Host 'Selected products: 11'
    Write-Host ''

    $arguments = @()
    if ($python.Prefix) { $arguments += $python.Prefix }
    $arguments += @(
        $downloader,
        '--config', $runtimeConfig,
        '--root', $workRoot,
        '--search-fixture', $runtimeFixture
    )
    & $python.Exe @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "ASF downloader stopped with exit code $LASTEXITCODE"
    }

    $demFiles = @(Get-ChildItem -LiteralPath (Join-Path $workRoot 'data\raw\dem') -File -ErrorAction SilentlyContinue)
    $archiveFiles = @(Get-ChildItem -LiteralPath (Join-Path $workRoot 'data\raw\archives') -File -ErrorAction SilentlyContinue)
    @(
        'STATUS=SUCCESS',
        'RESOLUTION_METERS=12.5',
        ("DEM_FILE_COUNT={0}" -f $demFiles.Count),
        ("ARCHIVE_FILE_COUNT={0}" -f $archiveFiles.Count),
        ("WORK_ROOT={0}" -f $workRoot),
        ("LOG={0}" -f $log)
    ) | Set-Content -LiteralPath $summary -Encoding UTF8

    Write-Host ''
    Write-Host '12.5 m source download completed.' -ForegroundColor Green
    Write-Host ("DEM files: {0}" -f $demFiles.Count) -ForegroundColor Green
    Start-Process explorer.exe -ArgumentList (Join-Path $workRoot 'data\raw\dem')
}
catch {
    $exitCode = 1
    @(
        'STATUS=FAILED',
        'RESOLUTION_METERS=12.5',
        ("MESSAGE={0}" -f $_.Exception.Message),
        ("WORK_ROOT={0}" -f $workRoot),
        ("LOG={0}" -f $log)
    ) | Set-Content -LiteralPath $summary -Encoding UTF8
    Write-Host ''
    Write-Host '12.5 m source download stopped.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ("Log: {0}" -f $log) -ForegroundColor Yellow
}
finally {
    Remove-Item Env:\EARTHDATA_TOKEN -ErrorAction SilentlyContinue
    $token = $null
    if ($transcriptStarted) {
        try { Stop-Transcript | Out-Null } catch {}
    }
}

exit $exitCode
