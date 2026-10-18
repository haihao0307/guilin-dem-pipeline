$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskNode = (Get-Command node -ErrorAction Stop).Source
& $taskNode (Join-Path $PSScriptRoot 'prepare-fast12.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Local asset preparation failed' }
$taskPort = 8786
try { $taskExisting = Invoke-RestMethod "http://127.0.0.1:$taskPort/__fast-status" -TimeoutSec 2 } catch { $taskExisting = $null }
if (-not $taskExisting.ready) {
    $taskServer = Join-Path $PSScriptRoot 'serve-fast12.cjs'
    $taskProcess = Start-Process -FilePath $taskNode -ArgumentList @($taskServer, "$taskPort") -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru
    $taskProcess.Id | Set-Content (Join-Path $taskRoot '.build/fast12-server.pid')
}
Write-Output "http://127.0.0.1:$taskPort/preview.html#layer=static&view=oblique&experiment=current-rest"
