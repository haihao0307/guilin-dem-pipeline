param(
    [Parameter(Mandatory = $true)]
    [string]$PlanPath,

    [Parameter(Mandatory = $true)]
    [string]$WorkRoot,

    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [int]$TimeoutMinutesPerFile = 120,
    [int]$StableChecks = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-ChromeSession {
    $processes = @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction SilentlyContinue)
    if (@($processes).Count -eq 0) {
        throw 'Chrome is not running. Open the already authenticated ASF Welcome session and rerun the project launcher.'
    }

    $preferred = @($processes | Where-Object {
        $line = [string]$_.CommandLine
        $line -match '(?i)ASF_v104_local|remote-debugging-port|user-data-dir'
    })
    $process = if (@($preferred).Count -gt 0) { @($preferred)[0] } else { @($processes)[0] }

    $exe = [string]$process.ExecutablePath
    if (-not $exe -or -not (Test-Path -LiteralPath $exe)) {
        $candidates = @(
            (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
            (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
            (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
        )
        $exe = @($candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) }) | Select-Object -First 1
    }
    if (-not $exe) {
        throw 'Chrome executable was not found.'
    }

    $arguments = @()
    $commandLine = [string]$process.CommandLine
    foreach ($pattern in @(
        '--user-data-dir=(?:"([^"]+)"|([^\s]+))',
        '--profile-directory=(?:"([^"]+)"|([^\s]+))'
    )) {
        $match = [regex]::Match($commandLine, $pattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($match.Success) {
            $value = if ($match.Groups[1].Success) { $match.Groups[1].Value } else { $match.Groups[2].Value }
            $name = $match.Value.Split('=')[0]
            $arguments += ("{0}={1}" -f $name, $value)
        }
    }

    return [pscustomobject]@{
        Exe = $exe
        Arguments = @($arguments)
        ProcessId = [int]$process.ProcessId
        CommandLine = $commandLine
    }
}

function Get-DownloadRoots {
    $roots = @(
        'C:\HaihaoDEM\ASF_v104_local\downloads',
        'C:\HaihaoDEM\ASF_v104_local\data\raw\archives',
        'C:\HaihaoDEM\ASF_v104_local\data\raw\dem',
        (Join-Path $env:USERPROFILE 'Downloads')
    )
    return @($roots | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -Unique)
}

function Test-FileSignature {
    param([string]$Path, [ValidateSet('archive','dem')] [string]$Kind)
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    $item = Get-Item -LiteralPath $Path
    if ($item.Length -le 16) { return $false }
    $stream = [IO.File]::OpenRead($Path)
    try {
        $buffer = New-Object byte[] 16
        [void]$stream.Read($buffer, 0, $buffer.Length)
    }
    finally {
        $stream.Dispose()
    }
    if ($Kind -eq 'archive') {
        return $buffer[0] -eq 0x50 -and $buffer[1] -eq 0x4B
    }
    $littleClassic = $buffer[0] -eq 0x49 -and $buffer[1] -eq 0x49 -and $buffer[2] -eq 0x2A -and $buffer[3] -eq 0x00
    $bigClassic = $buffer[0] -eq 0x4D -and $buffer[1] -eq 0x4D -and $buffer[2] -eq 0x00 -and $buffer[3] -eq 0x2A
    $littleBigTiff = $buffer[0] -eq 0x49 -and $buffer[1] -eq 0x49 -and $buffer[2] -eq 0x2B -and $buffer[3] -eq 0x00
    $bigBigTiff = $buffer[0] -eq 0x4D -and $buffer[1] -eq 0x4D -and $buffer[2] -eq 0x00 -and $buffer[3] -eq 0x2B
    return $littleClassic -or $bigClassic -or $littleBigTiff -or $bigBigTiff
}

function Find-CompletedDownload {
    param(
        [string[]]$Roots,
        [string]$ExpectedName,
        [datetime]$StartedAt,
        [int]$TimeoutMinutes,
        [int]$RequiredStableChecks
    )

    $extension = [IO.Path]::GetExtension($ExpectedName)
    $baseName = [IO.Path]::GetFileNameWithoutExtension($ExpectedName)
    $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
    $lastPath = $null
    $lastSize = -1L
    $stable = 0

    while ((Get-Date) -lt $deadline) {
        $candidates = @()
        foreach ($root in @($Roots)) {
            $candidates += @(Get-ChildItem -LiteralPath $root -File -ErrorAction SilentlyContinue | Where-Object {
                $_.LastWriteTime -ge $StartedAt.AddMinutes(-2) -and
                $_.Name -like ("{0}*{1}" -f $baseName, $extension) -and
                $_.Name -notlike '*.crdownload' -and
                $_.Name -notlike '*.tmp'
            })
        }
        $candidate = @($candidates | Sort-Object LastWriteTime -Descending) | Select-Object -First 1
        if ($candidate) {
            if ($lastPath -eq $candidate.FullName -and $lastSize -eq $candidate.Length -and $candidate.Length -gt 16) {
                $stable += 1
            }
            else {
                $lastPath = $candidate.FullName
                $lastSize = $candidate.Length
                $stable = 1
            }
            if ($stable -ge $RequiredStableChecks) {
                return $candidate.FullName
            }
        }
        Start-Sleep -Seconds 3
    }
    throw "Chrome download timed out: $ExpectedName"
}

function Extract-DemFromZip {
    param([string]$ArchivePath, [string]$DemRoot)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($ArchivePath)
    $outputs = @()
    try {
        foreach ($entry in @($archive.Entries)) {
            $name = [IO.Path]::GetFileName($entry.FullName)
            if (-not $name) { continue }
            if ($name -notmatch '(?i)(\.dem\.tif|_dem\.tif)$') { continue }
            $target = Join-Path $DemRoot $name
            $source = $entry.Open()
            $destination = [IO.File]::Open($target, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::None)
            try {
                $source.CopyTo($destination)
            }
            finally {
                $destination.Dispose()
                $source.Dispose()
            }
            if (-not (Test-FileSignature -Path $target -Kind dem)) {
                Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
                throw "Extracted file is not a TIFF DEM: $name"
            }
            $outputs += $target
        }
    }
    finally {
        $archive.Dispose()
    }
    if (@($outputs).Count -eq 0) {
        throw "ASF archive contains no *.dem.tif: $ArchivePath"
    }
    return @($outputs)
}

$resolvedPlan = (Resolve-Path -LiteralPath $PlanPath).Path
$resolvedWork = [IO.Path]::GetFullPath($WorkRoot)
$archiveRoot = Join-Path $resolvedWork 'data\raw\archives'
$demRoot = Join-Path $resolvedWork 'data\raw\dem'
$metadataRoot = Join-Path $resolvedWork 'metadata'
$logRoot = Join-Path $resolvedWork 'logs'
foreach ($directory in @($archiveRoot, $demRoot, $metadataRoot, $logRoot)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
}

$plan = Get-Content -Raw -LiteralPath $resolvedPlan | ConvertFrom-Json
$products = @($plan.selectedNewProducts)
if (@($products).Count -eq 0) {
    throw 'ASF plan contains zero selected products.'
}

$chrome = Get-ChromeSession
$downloadRoots = Get-DownloadRoots
if (@($downloadRoots).Count -eq 0) {
    throw 'No Chrome download directory was found.'
}

Write-Host ''
Write-Host 'ASF authenticated Chrome session downloader' -ForegroundColor Cyan
Write-Host ("Project: {0}" -f $ProjectId)
Write-Host ("Chrome process: {0}" -f $chrome.ProcessId)
Write-Host ("Selected products: {0}" -f @($products).Count)
Write-Host 'Chrome may request one confirmation for multiple downloads or file retention.' -ForegroundColor Yellow
Write-Host ''

$records = @()
for ($index = 0; $index -lt @($products).Count; $index += 1) {
    $product = @($products)[$index]
    $url = $null
    $kind = 'archive'
    if (@($product.directDemUrls).Count -gt 0) {
        $url = [string]@($product.directDemUrls)[0]
        $kind = 'dem'
    }
    elseif ($product.archiveUrl) {
        $url = [string]$product.archiveUrl
        $kind = 'archive'
    }
    if (-not $url) {
        throw "Selected ASF product has no download URL: $($product.granuleName)"
    }

    $uri = [Uri]$url
    $fileName = [IO.Path]::GetFileName($uri.AbsolutePath)
    if (-not $fileName) {
        $fileName = if ($kind -eq 'dem') { "$($product.granuleName).dem.tif" } else { "$($product.granuleName).zip" }
    }
    $target = if ($kind -eq 'dem') { Join-Path $demRoot $fileName } else { Join-Path $archiveRoot $fileName }

    Write-Host ("[{0}/{1}] {2}" -f ($index + 1), @($products).Count, $fileName) -ForegroundColor Cyan
    $started = Get-Date
    if (Test-Path -LiteralPath $target) {
        if (-not (Test-FileSignature -Path $target -Kind $kind)) {
            Remove-Item -LiteralPath $target -Force
        }
    }

    if (-not (Test-Path -LiteralPath $target)) {
        $arguments = @($chrome.Arguments) + @('--new-tab', $url)
        Start-Process -FilePath $chrome.Exe -ArgumentList $arguments | Out-Null
        $downloaded = Find-CompletedDownload -Roots $downloadRoots -ExpectedName $fileName -StartedAt $started -TimeoutMinutes $TimeoutMinutesPerFile -RequiredStableChecks $StableChecks
        if (-not (Test-FileSignature -Path $downloaded -Kind $kind)) {
            throw "Chrome response has an invalid file signature: $downloaded"
        }
        if ([IO.Path]::GetFullPath($downloaded) -ne [IO.Path]::GetFullPath($target)) {
            Move-Item -LiteralPath $downloaded -Destination $target -Force
        }
    }

    $demFiles = if ($kind -eq 'archive') { Extract-DemFromZip -ArchivePath $target -DemRoot $demRoot } else { @($target) }
    $records += [pscustomobject]@{
        selectionOrder = [int]$product.selectionOrder
        granuleName = [string]$product.granuleName
        url = $url
        transferKind = $kind
        sourceFile = $target
        sourceBytes = (Get-Item -LiteralPath $target).Length
        sourceSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $target).Hash.ToLowerInvariant()
        demFiles = @($demFiles | ForEach-Object {
            [pscustomobject]@{
                file = $_
                bytes = (Get-Item -LiteralPath $_).Length
                sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_).Hash.ToLowerInvariant()
            }
        })
    }
}

$manifest = [pscustomobject]@{
    schemaVersion = '1.0.0'
    generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    status = 'download_complete'
    projectId = $ProjectId
    authenticationMode = 'existing_authenticated_chrome_session'
    credentialContentRead = $false
    selectedProductCount = @($products).Count
    records = @($records)
}
$manifestPath = Join-Path $metadataRoot 'chrome_session_download_manifest.json'
$manifest | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Host ''
Write-Host 'ASF Chrome session download completed.' -ForegroundColor Green
Write-Host ("Manifest: {0}" -f $manifestPath) -ForegroundColor Green
