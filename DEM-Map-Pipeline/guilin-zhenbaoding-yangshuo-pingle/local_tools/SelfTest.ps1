. (Join-Path $PSScriptRoot 'Common.ps1')
$packageRoot = Get-PackageRoot
$projectRoot = Get-ProjectSourceRoot
$python = Ensure-Python
Invoke-Python -Python $python -Arguments @((Join-Path $PSScriptRoot 'package_self_test.py'),'--package-root',$packageRoot,'--project-root',$projectRoot)
Write-Host 'Package self-test completed.' -ForegroundColor Green
