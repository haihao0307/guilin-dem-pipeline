Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-PackageRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
}

function Get-ProjectSourceRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

function Get-WorkRoot {
    if ($env:GUILIN_DEM_WORK_ROOT) { return $env:GUILIN_DEM_WORK_ROOT }
    return 'C:\HaihaoDEM\Guilin_Extended_DEM_Full_v2_0'
}

function Test-PythonCandidate {
    param([string]$Exe, [string[]]$Prefix)
    try {
        $args = @(); if ($Prefix) { $args += $Prefix }; $args += @('-c','import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 2)')
        & $Exe @args 2>$null
        if ($LASTEXITCODE -eq 0) {
            return [pscustomobject]@{ Exe=$Exe; Prefix=@($Prefix) }
        }
    } catch {}
    return $null
}

function Find-Python {
    $candidates = New-Object System.Collections.Generic.List[object]
    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($py) {
        foreach ($v in @('-3.13','-3.12','-3.11','-3.10','-3')) { $candidates.Add([pscustomobject]@{Exe=$py.Source;Prefix=@($v)}) }
    }
    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($python) { $candidates.Add([pscustomobject]@{Exe=$python.Source;Prefix=@()}) }
    foreach ($path in @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python310\python.exe'),
        'C:\Python313\python.exe','C:\Python312\python.exe','C:\Python311\python.exe','C:\Python310\python.exe'
    )) { $candidates.Add([pscustomobject]@{Exe=$path;Prefix=@()}) }
    foreach ($candidate in $candidates) {
        $result = Test-PythonCandidate -Exe $candidate.Exe -Prefix $candidate.Prefix
        if ($null -ne $result) { return $result }
    }
    return $null
}

function Invoke-Python {
    param($Python, [string[]]$Arguments)
    $all = @(); if ($Python.Prefix) { $all += $Python.Prefix }; $all += $Arguments
    & $Python.Exe @all
    if ($LASTEXITCODE -ne 0) { throw "Python command failed with exit code $LASTEXITCODE" }
}

function Ensure-Python {
    $python = Find-Python
    if ($null -ne $python) { return $python }
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) { throw 'Python 3.10 or newer was not found and winget is unavailable.' }
    Write-Host 'Installing Python 3.12 with winget...' -ForegroundColor Yellow
    & $winget.Source install --id Python.Python.3.12 --exact --source winget --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw "Python installation failed with exit code $LASTEXITCODE" }
    $python = Find-Python
    if ($null -eq $python) { throw 'Python installation finished but Python is still unavailable. Reopen the launcher.' }
    return $python
}

function Sync-SourceToWork {
    param([string]$SourceRoot, [string]$WorkRoot)
    New-Item -ItemType Directory -Force -Path $WorkRoot | Out-Null
    foreach ($name in @('config','scripts','tests','web','docs')) {
        $source = Join-Path $SourceRoot $name
        $target = Join-Path $WorkRoot $name
        if (Test-Path -LiteralPath $source) {
            New-Item -ItemType Directory -Force -Path $target | Out-Null
            Copy-Item -Path (Join-Path $source '*') -Destination $target -Recurse -Force
        }
    }
    foreach ($name in @('requirements.txt','README.md','TASK_RECORD.json','THIRD_PARTY_SOURCES.txt')) {
        $source = Join-Path $SourceRoot $name
        if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination (Join-Path $WorkRoot $name) -Force }
    }
    foreach ($dir in @('data\existing_five','data\raw\archives','data\raw\dem','data\raw\metadata','data\raw\mapzen','metadata','outputs','reports','logs','exports')) {
        New-Item -ItemType Directory -Force -Path (Join-Path $WorkRoot $dir) | Out-Null
    }
    $sourceFive = Join-Path $SourceRoot 'data\existing_five'
    $targetFive = Join-Path $WorkRoot 'data\existing_five'
    Get-ChildItem -LiteralPath $sourceFive -File -ErrorAction SilentlyContinue | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $targetFive $_.Name) -Force
    }
}

function Ensure-Venv {
    param($BasePython, [string]$WorkRoot)
    $venvDir = Join-Path $WorkRoot '.venv'
    $venvExe = Join-Path $venvDir 'Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $venvExe)) {
        Invoke-Python -Python $BasePython -Arguments @('-m','venv',$venvDir)
    }
    $venvPython = [pscustomobject]@{Exe=$venvExe;Prefix=@()}
    Invoke-Python -Python $venvPython -Arguments @('-m','pip','install','--disable-pip-version-check','--upgrade','pip','setuptools','wheel')
    Invoke-Python -Python $venvPython -Arguments @('-m','pip','install','--disable-pip-version-check','--only-binary=:all:','-r',(Join-Path $WorkRoot 'requirements.txt'))
    return $venvPython
}

function Load-EarthdataToken {
    $tokenFile = Join-Path $env:APPDATA 'HaihaoDEM\earthdata-token.dpapi'
    if (-not (Test-Path -LiteralPath $tokenFile)) { return $null }
    $encrypted = (Get-Content -Raw -LiteralPath $tokenFile).Trim()
    if (-not $encrypted) { return $null }
    $secure = $encrypted | ConvertTo-SecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
