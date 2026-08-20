param(
    [string]$Repository = 'haihao0307/GeoJson2UE',
    [string]$Branch = 'dem-zhenbaoding-yangshuo-pingle'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$packageRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logs = Join-Path $packageRoot 'logs'
$workspace = Join-Path $packageRoot '_github_workspace'
$clone = Join-Path $workspace 'GeoJson2UE'
New-Item -ItemType Directory -Force -Path $logs,$workspace | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$logFile = Join-Path $logs ("GITHUB_PUSH_{0}.log" -f $stamp)
$transcript = $false
$exitCode = 0

function Find-Tool {
    param([string]$Name, [string[]]$Paths)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($path in $Paths) { if (Test-Path -LiteralPath $path) { return $path } }
    return $null
}

function Ensure-WingetPackage {
    param([string]$Id)
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) { throw "winget is required to install $Id" }
    & $winget.Source install --id $Id --exact --source winget --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw "winget installation failed for $Id" }
}

try {
    Start-Transcript -Path $logFile -Append | Out-Null
    $transcript = $true
    Write-Host ''
    Write-Host 'Guilin DEM GitHub push tool' -ForegroundColor Cyan
    Write-Host ("Repository: {0}" -f $Repository)
    Write-Host ("Branch: {0}" -f $Branch)

    $git = Find-Tool -Name 'git.exe' -Paths @('C:\Program Files\Git\cmd\git.exe','C:\Program Files\Git\bin\git.exe')
    if (-not $git) { Ensure-WingetPackage -Id 'Git.Git'; $git = Find-Tool -Name 'git.exe' -Paths @('C:\Program Files\Git\cmd\git.exe','C:\Program Files\Git\bin\git.exe') }
    if (-not $git) { throw 'Git is unavailable.' }

    $gh = Find-Tool -Name 'gh.exe' -Paths @('C:\Program Files\GitHub CLI\gh.exe')
    if (-not $gh) { Ensure-WingetPackage -Id 'GitHub.cli'; $gh = Find-Tool -Name 'gh.exe' -Paths @('C:\Program Files\GitHub CLI\gh.exe') }
    if (-not $gh) { throw 'GitHub CLI is unavailable.' }

    & $gh auth status --hostname github.com
    if ($LASTEXITCODE -ne 0) {
        & $gh auth login --hostname github.com --git-protocol https --web
        if ($LASTEXITCODE -ne 0) { throw 'GitHub login failed.' }
    }

    if (-not (Test-Path -LiteralPath (Join-Path $clone '.git'))) {
        if (Test-Path -LiteralPath $clone) { Remove-Item -LiteralPath $clone -Recurse -Force }
        & $gh repo clone $Repository $clone
        if ($LASTEXITCODE -ne 0) { throw 'Repository clone failed.' }
    }

    $dirty = & $git -C $clone status --porcelain
    if ($dirty) { throw "The managed Git workspace contains uncommitted files: $clone" }

    & $git -C $clone fetch origin --prune
    if ($LASTEXITCODE -ne 0) { throw 'git fetch failed.' }
    $defaultBranch = (& $gh repo view $Repository --json defaultBranchRef --jq '.defaultBranchRef.name').Trim()
    if (-not $defaultBranch) { $defaultBranch = 'main' }
    & $git -C $clone ls-remote --exit-code --heads origin $Branch *> $null
    if ($LASTEXITCODE -eq 0) { & $git -C $clone checkout -B $Branch ("origin/{0}" -f $Branch) }
    else { & $git -C $clone checkout -B $Branch ("origin/{0}" -f $defaultBranch) }
    if ($LASTEXITCODE -ne 0) { throw 'Branch checkout failed.' }

    $srcProject = Join-Path $packageRoot 'DEM-Map-Pipeline\guilin-zhenbaoding-yangshuo-pingle'
    $dstProject = Join-Path $clone 'DEM-Map-Pipeline\guilin-zhenbaoding-yangshuo-pingle'
    New-Item -ItemType Directory -Force -Path $dstProject | Out-Null
    & robocopy.exe $srcProject $dstProject /MIR /R:2 /W:1 /NFL /NDL /NP /XD '.venv' '__pycache__' 'data\raw' 'outputs' 'logs' 'exports' /XF '*.tif' '*.tiff' '*.hgt' '*.gz' '*.part'
    if ($LASTEXITCODE -ge 8) { throw "robocopy project failed with exit code $LASTEXITCODE" }

    $workflowSource = Join-Path $packageRoot '.github\workflows\guilin-dem-extended.yml'
    $workflowTarget = Join-Path $clone '.github\workflows\guilin-dem-extended.yml'
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $workflowTarget) | Out-Null
    Copy-Item -LiteralPath $workflowSource -Destination $workflowTarget -Force

    & $git -C $clone add -- '.github/workflows/guilin-dem-extended.yml' 'DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle'
    if ($LASTEXITCODE -ne 0) { throw 'git add failed.' }
    & $git -C $clone status --short
    & $git -C $clone diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host 'No Git changes were detected.' -ForegroundColor Yellow
    } else {
        $answer = Read-Host 'Type PUSH to commit and push these files'
        if ($answer -cne 'PUSH') { throw 'Push cancelled by user.' }
        & $git -C $clone config user.name 'Haihao_Nature Grace HK'
        & $git -C $clone config user.email '168883551+haihao0307@users.noreply.github.com'
        & $git -C $clone commit -m 'Add full local Guilin DEM production package'
        if ($LASTEXITCODE -ne 0) { throw 'git commit failed.' }
        & $git -C $clone push -u origin $Branch
        if ($LASTEXITCODE -ne 0) { throw 'git push failed.' }
    }

    try {
        & $gh workflow run 'guilin-dem-extended.yml' --repo $Repository --ref $Branch -f data_mode=auto
        if ($LASTEXITCODE -ne 0) { Write-Host 'Workflow was not started automatically. Open Actions and run it manually.' -ForegroundColor Yellow }
    } catch { Write-Host 'Workflow start was skipped.' -ForegroundColor Yellow }

    Start-Process ("https://github.com/{0}/actions" -f $Repository)
    Start-Process ("https://github.com/{0}/settings/pages" -f $Repository)
    Write-Host ''
    Write-Host 'GitHub synchronization completed.' -ForegroundColor Green
    Write-Host ("Managed clone: {0}" -f $clone)
    Write-Host ("Log: {0}" -f $logFile)
}
catch {
    $exitCode = 1
    Write-Host ''
    Write-Host 'GitHub synchronization stopped.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ("Log: {0}" -f $logFile) -ForegroundColor Yellow
}
finally {
    if ($transcript) { try { Stop-Transcript | Out-Null } catch {} }
}
exit $exitCode
