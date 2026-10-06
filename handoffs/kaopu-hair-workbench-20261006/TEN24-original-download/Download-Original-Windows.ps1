# Optional Windows PowerShell 5.1+ / PowerShell 7 helper.
# Downloads ONLY official bytes into a NEW private directory outside Git.
# Does not install/run Blender, change execution policy, or upload anything.
param(
    [Parameter(Mandatory=$true)][string]$PrivateAssetsParent
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$ManifestPath = Join-Path $PSScriptRoot 'original-files-manifest.json'
$Manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$Parent = (Resolve-Path -LiteralPath $PrivateAssetsParent).Path
if (-not (Test-Path -LiteralPath $Parent -PathType Container)) { throw 'Choose an existing private parent directory.' }
$Ancestor = [System.IO.DirectoryInfo]$Parent
while ($null -ne $Ancestor) {
    if (Test-Path -LiteralPath (Join-Path $Ancestor.FullName '.git')) { throw 'Assets must be outside every Git checkout. Choose a private directory outside the project.' }
    if (($Ancestor.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Use a real local directory, not a junction or symlink.' }
    $Ancestor = $Ancestor.Parent
}
# Additional guard for nonstandard Git worktrees; no repository mutation.
if (Get-Command git -ErrorAction SilentlyContinue) {
    $OldPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        $inside = & git -C $Parent rev-parse --is-inside-work-tree 2>$null
        $GitExit = $LASTEXITCODE
    } finally { $ErrorActionPreference = $OldPreference }
    if ($GitExit -eq 0 -and $inside -eq 'true') { throw 'Assets must be outside the Git worktree.' }
}
$Drive = New-Object System.IO.DriveInfo ([System.IO.Path]::GetPathRoot($Parent))
$RequiredBytes = [int64]$Manifest.archive.bytes + [int64]$Manifest.archive.uncompressed_bytes + 1073741824
if ($Drive.AvailableFreeSpace -lt $RequiredBytes) { throw "Insufficient disk space. Need at least $RequiredBytes bytes including reserve." }
$Name = 'TEN24-original-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
$Dest = Join-Path $Parent $Name
if (Test-Path -LiteralPath $Dest) { throw 'Destination already exists; refusing overwrite.' }
[void][System.IO.Directory]::CreateDirectory($Dest)
$Zip = Join-Path $Dest '3D_ScanStore_Free_Head.zip'
$Original = Join-Path $Dest 'original'
$Log = [ordered]@{ source = $Manifest.download_url; started_utc = [DateTime]::UtcNow.ToString('o'); destination = $Dest; status = 'started'; source_assets_uploaded = $false }
$LogPath = Join-Path $Dest 'download-and-verify.json'
$Client = $null; $Response = $null; $InputStream = $null; $OutputStream = $null; $BodyCancel = $null
$Watch = [System.Diagnostics.Stopwatch]::StartNew()
try {
    Add-Type -AssemblyName System.Net.Http
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Handler = New-Object System.Net.Http.HttpClientHandler
    $Handler.AllowAutoRedirect = $false
    $Client = [System.Net.Http.HttpClient]::new($Handler)
    $Client.Timeout = [TimeSpan]::FromHours(2)
    $Client.DefaultRequestHeaders.CacheControl = New-Object System.Net.Http.Headers.CacheControlHeaderValue
    $Client.DefaultRequestHeaders.CacheControl.NoCache = $true
    $Response = $Client.GetAsync([string]$Manifest.download_url, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
    $Log.http_status = [int]$Response.StatusCode
    [void]$Response.EnsureSuccessStatusCode()
    $FinalUri = $Response.RequestMessage.RequestUri
    if ($FinalUri.Scheme -ne 'https' -or $FinalUri.Host -ne 'samplescan.s3.us-west-2.amazonaws.com') { throw 'Unexpected download destination. Stop and inspect; do not follow another source.' }
    $Log.http_content_length = $Response.Content.Headers.ContentLength
    $InputStream = $Response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
    $OutputStream = [System.IO.File]::Open($Zip, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    $BodyCancel = New-Object System.Threading.CancellationTokenSource
    $BodyCancel.CancelAfter([TimeSpan]::FromHours(2))
    $Copy = $InputStream.CopyToAsync($OutputStream, 1048576, $BodyCancel.Token)
    if (-not $Copy.Wait([TimeSpan]::FromHours(2))) {
        $BodyCancel.Cancel()
        throw 'Download body timed out; partial file kept in the new directory.'
    }
    $Copy.GetAwaiter().GetResult()
    $OutputStream.Dispose(); $OutputStream = $null
    $InputStream.Dispose(); $InputStream = $null
    $Log.download_seconds = $Watch.Elapsed.TotalSeconds
    $Log.bytes = (Get-Item -LiteralPath $Zip).Length
    $Log.sha256 = (Get-FileHash -LiteralPath $Zip -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($Log.bytes -ne $Manifest.archive.bytes -or $Log.sha256 -ne $Manifest.archive.sha256) { throw 'Downloaded ZIP does not match verified original. Keep it for diagnosis; do not open it.' }
    # Entire ZIP bytes are trusted only after exact SHA-256 matches the verified source.
    [System.IO.Compression.ZipFile]::ExtractToDirectory($Zip, $Original)
    $Results = @()
    foreach ($File in $Manifest.files) {
        $Path = Join-Path $Original ($File.path.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
        $Actual = Get-Item -LiteralPath $Path
        $SHA = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
        $OK = $Actual.Length -eq $File.bytes -and $SHA -eq $File.sha256
        $Results += [ordered]@{ path = $File.path; bytes = $Actual.Length; sha256 = $SHA; ok = $OK }
        if (-not $OK) { throw "Extracted file mismatch: $($File.path)" }
    }
    $ActualCount = @(Get-ChildItem -LiteralPath $Original -Recurse -File).Count
    if ($ActualCount -ne $Manifest.archive.file_count) { throw 'Unexpected extracted file count.' }
    $Log.files = $Results
    $Log.file_count = $ActualCount
    $Log.original_scene = Join-Path $Original 'Blender\Blender Scene.blend'
    $Log.status = 'complete; archive and all 72 extracted files SHA-256 match'
    $Log.total_seconds = $Watch.Elapsed.TotalSeconds
    Write-Output "Verified original: $Original"
    Write-Output 'Next: run verify_original.py for independent ZIP CRC checks; inspect existing Blender version before opening. Auto-exec must stay disabled.'
} catch {
    $Log.status = 'failed'
    $Log.error = $_.Exception.Message
    throw
} finally {
    if ($null -ne $OutputStream) { $OutputStream.Dispose() }
    if ($null -ne $InputStream) { $InputStream.Dispose() }
    if ($null -ne $Response) { $Response.Dispose() }
    if ($null -ne $Client) { $Client.Dispose() }
    if ($null -ne $BodyCancel) { $BodyCancel.Dispose() }
    $Log | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $LogPath -Encoding UTF8
}
