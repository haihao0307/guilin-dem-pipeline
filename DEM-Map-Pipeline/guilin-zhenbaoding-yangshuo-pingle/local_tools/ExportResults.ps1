param([string]$WorkRoot = '')
. (Join-Path $PSScriptRoot 'Common.ps1')
if (-not $WorkRoot) { $WorkRoot = Get-WorkRoot }
$packageRoot = Get-PackageRoot
$exports = Join-Path $packageRoot 'exports'
New-Item -ItemType Directory -Force -Path $exports | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$target = Join-Path $exports ("Guilin_DEM_Runtime_Result_{0}.zip" -f $stamp)
$items = @()
foreach ($name in @('outputs','metadata','reports','web','logs')) {
    $path = Join-Path $WorkRoot $name
    if (Test-Path -LiteralPath $path) { $items += $path }
}
if ($items.Count -eq 0) { throw 'No runtime result folders were found.' }
Compress-Archive -Path $items -DestinationPath $target -CompressionLevel Optimal -Force
$hash = Get-FileHash -LiteralPath $target -Algorithm SHA256
("{0}  {1}" -f $hash.Hash.ToLowerInvariant(),(Split-Path -Leaf $target)) | Set-Content -LiteralPath ($target + '.sha256.txt') -Encoding ASCII
Write-Host ("Result package: {0}" -f $target) -ForegroundColor Green
Start-Process explorer.exe -ArgumentList $exports
