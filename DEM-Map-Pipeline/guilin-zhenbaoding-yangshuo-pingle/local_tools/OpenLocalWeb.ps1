param([string]$WorkRoot = '')
. (Join-Path $PSScriptRoot 'Common.ps1')
if (-not $WorkRoot) { $WorkRoot = Get-WorkRoot }
$sourceRoot = Get-ProjectSourceRoot
$webRoot = Join-Path $WorkRoot 'web'
if (-not (Test-Path -LiteralPath (Join-Path $webRoot 'index.html'))) { $webRoot = Join-Path $sourceRoot 'web' }
if (-not (Test-Path -LiteralPath (Join-Path $webRoot 'index.html'))) { throw 'Web files were not found.' }
$python = Ensure-Python
$port = 8787
$address = "http://127.0.0.1:$port/index.html"
$serverCmd = '"{0}" {1} -m http.server {2} --bind 127.0.0.1 --directory "{3}"' -f $python.Exe,($python.Prefix -join ' '),$port,$webRoot
Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d','/k',$serverCmd) -WorkingDirectory $webRoot
Start-Sleep -Seconds 2
Start-Process $address
Write-Host ("Local web: {0}" -f $address) -ForegroundColor Green
