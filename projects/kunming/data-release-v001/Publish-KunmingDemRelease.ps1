param(
    [string]$PackagePath = '/mnt/data/KUNMING_DEM_DATA_ONLY_12P5M_UNCOMPRESSED_V001.zip',
    [string]$Repository = 'haihao0307/guilin-dem-pipeline',
    [string]$Tag = 'kunming-dem-data-only-v001',
    [string]$TargetCommitish = 'project/kunming-dem-v001',
    [string]$ReportPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedPackageName = 'KUNMING_DEM_DATA_ONLY_12P5M_UNCOMPRESSED_V001.zip'
$ExpectedPackageBytes = 201350399L
$ExpectedPackageSha256 = 'ace84e8448869dc38ddca66bfb39dae25eca9434d5d9ea33e67d04e830dcd52a'
$ExpectedTifName = 'KUNMING_BASELINE_RESET_CROP_12P5M_FLOAT32_UNCOMPRESSED.tif'
$ExpectedTifBytes = 201333082L
$ExpectedTifSha256 = '9f672e16714d98b7bc7f002826cdf788379bcb54db84227a21f53539b083f3a2'
$ReleaseTitle = 'Kunming DEM data-only 12.5 m uncompressed V001'

function Assert-FileIdentity {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][long]$ExpectedBytes,
        [Parameter(Mandatory = $true)][string]$ExpectedSha256
    )
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Required file was not found: $Path"
    }
    $item = Get-Item -LiteralPath $Path
    if ($item.Length -ne $ExpectedBytes) {
        throw "File size mismatch for $Path. Expected $ExpectedBytes, found $($item.Length)."
    }
    $actualSha = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualSha -ne $ExpectedSha256) {
        throw "SHA-256 mismatch for $Path. Expected $ExpectedSha256, found $actualSha."
    }
    return [pscustomobject]@{
        path = $item.FullName
        bytes = $item.Length
        sha256 = $actualSha
    }
}

function Invoke-Gh {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    & gh @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "gh stopped with exit code $LASTEXITCODE: gh $($Arguments -join ' ')"
    }
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI gh is required and was not found.'
}
Invoke-Gh -Arguments @('auth', 'status')

$package = Assert-FileIdentity -Path $PackagePath -ExpectedBytes $ExpectedPackageBytes -ExpectedSha256 $ExpectedPackageSha256
if ([IO.Path]::GetFileName($package.path) -ne $ExpectedPackageName) {
    throw "Unexpected package file name: $($package.path)"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$workRoot = Join-Path ([IO.Path]::GetTempPath()) ('kunming-dem-release-' + [guid]::NewGuid().ToString('N'))
$extractRoot = Join-Path $workRoot 'extract'
$verifyRoot = Join-Path $workRoot 'verify-download'
New-Item -ItemType Directory -Force -Path $extractRoot, $verifyRoot | Out-Null

try {
    $archive = [IO.Compression.ZipFile]::OpenRead($package.path)
    try {
        $entries = @($archive.Entries)
        if (@($entries).Count -ne 6) {
            throw "Unexpected ZIP entry count. Expected 6, found $(@($entries).Count)."
        }
        foreach ($entry in $entries) {
            if ($entry.CompressedLength -ne $entry.Length) {
                throw "ZIP entry is compressed even though ZIP_STORED is required: $($entry.FullName)"
            }
        }
        $tifEntry = @($entries | Where-Object { [IO.Path]::GetFileName($_.FullName) -eq $ExpectedTifName })
        if (@($tifEntry).Count -ne 1) {
            throw "Expected exactly one $ExpectedTifName entry, found $(@($tifEntry).Count)."
        }
        $tifPath = Join-Path $extractRoot $ExpectedTifName
        [IO.Compression.ZipFileExtensions]::ExtractToFile(@($tifEntry)[0], $tifPath, $true)
    }
    finally {
        $archive.Dispose()
    }

    $tif = Assert-FileIdentity -Path $tifPath -ExpectedBytes $ExpectedTifBytes -ExpectedSha256 $ExpectedTifSha256

    $releaseExists = $true
    & gh release view $Tag --repo $Repository *> $null
    if ($LASTEXITCODE -ne 0) {
        $releaseExists = $false
    }

    $notes = @"
Clean data-only restart package for the Kunming DEM pipeline.

Authoritative source mosaic SHA-256:
af95c47f55ab8ff25d33ddc96d07c6d85fc1fcd4c2a2de9e2bef51a015860c50

Published assets:
1. $ExpectedPackageName
   SHA-256: $ExpectedPackageSha256
   ZIP method: STORE, no archive compression
2. $ExpectedTifName
   SHA-256: $ExpectedTifSha256
   float32, EPSG:32648, 12.5 m x 12.5 m, 5892 x 8095
   TIFF compression: NONE
   internal overviews: NONE

Crop area: 7452.459375 km2
"@

    if (-not $releaseExists) {
        Invoke-Gh -Arguments @(
            'release', 'create', $Tag,
            '--repo', $Repository,
            '--target', $TargetCommitish,
            '--title', $ReleaseTitle,
            '--notes', $notes,
            '--draft'
        )
    }
    else {
        Invoke-Gh -Arguments @(
            'release', 'edit', $Tag,
            '--repo', $Repository,
            '--title', $ReleaseTitle,
            '--notes', $notes,
            '--draft=true'
        )
    }

    Invoke-Gh -Arguments @(
        'release', 'upload', $Tag,
        $package.path,
        $tif.path,
        '--repo', $Repository,
        '--clobber'
    )

    $assetJson = & gh release view $Tag --repo $Repository --json url,isDraft,assets
    if ($LASTEXITCODE -ne 0) {
        throw 'Failed to read the uploaded release assets.'
    }
    $release = $assetJson | ConvertFrom-Json
    $assets = @($release.assets)
    foreach ($expected in @(
        [pscustomobject]@{ name = $ExpectedPackageName; bytes = $ExpectedPackageBytes },
        [pscustomobject]@{ name = $ExpectedTifName; bytes = $ExpectedTifBytes }
    )) {
        $matches = @($assets | Where-Object { $_.name -eq $expected.name })
        if (@($matches).Count -ne 1) {
            throw "Release asset missing or duplicated: $($expected.name)"
        }
        if ([long]@($matches)[0].size -ne [long]$expected.bytes) {
            throw "Release asset size mismatch for $($expected.name)."
        }
    }

    Invoke-Gh -Arguments @(
        'release', 'download', $Tag,
        '--repo', $Repository,
        '--pattern', $ExpectedPackageName,
        '--pattern', $ExpectedTifName,
        '--dir', $verifyRoot,
        '--clobber'
    )

    $downloadedPackage = Assert-FileIdentity -Path (Join-Path $verifyRoot $ExpectedPackageName) -ExpectedBytes $ExpectedPackageBytes -ExpectedSha256 $ExpectedPackageSha256
    $downloadedTif = Assert-FileIdentity -Path (Join-Path $verifyRoot $ExpectedTifName) -ExpectedBytes $ExpectedTifBytes -ExpectedSha256 $ExpectedTifSha256

    $report = [ordered]@{
        schemaVersion = 'kunming_dem_release_upload@1.0.0'
        status = 'complete'
        generatedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
        repository = $Repository
        tag = $Tag
        releaseUrl = $release.url
        isDraft = [bool]$release.isDraft
        package = $package
        tif = $tif
        downloadedPackage = $downloadedPackage
        downloadedTif = $downloadedTif
        verification = [ordered]@{
            packageSha256VerifiedBeforeUpload = $true
            tifSha256VerifiedBeforeUpload = $true
            zipStoredVerified = $true
            assetSizesVerified = $true
            downloadedAssetsSha256Verified = $true
            recompressed = $false
            resampled = $false
        }
    }
    if (-not $ReportPath) {
        $ReportPath = Join-Path (Split-Path -Parent $package.path) 'KUNMING_DEM_RELEASE_UPLOAD_REPORT.json'
    }
    $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
    Write-Host "Release upload and verification completed: $($release.url)" -ForegroundColor Green
    Write-Host "Report: $ReportPath" -ForegroundColor Green
}
finally {
    Remove-Item -LiteralPath $workRoot -Recurse -Force -ErrorAction SilentlyContinue
}
