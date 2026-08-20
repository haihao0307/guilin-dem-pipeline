$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$tokenFile = Join-Path $env:APPDATA 'HaihaoDEM\earthdata-token.dpapi'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $tokenFile) | Out-Null
$secure = Read-Host 'Paste the NASA Earthdata token. The value stays hidden' -AsSecureString
$secure | ConvertFrom-SecureString | Set-Content -LiteralPath $tokenFile -Encoding UTF8
Write-Host ("Token saved with Windows DPAPI: {0}" -f $tokenFile) -ForegroundColor Green
