param(
    [Parameter(Mandatory = $false)]
    [string]$SourceFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ExpectedName = 'WENZHOU_QINGJIANG_22000KM2_12_5M_COG.tif'
$ExpectedBytes = 54638031
$ExpectedSha256 = '8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e'
$Branch = 'archive/wenzhou-qingjiang-22000km2-dem-truth-v001'
$TargetRelative = 'projects/wenzhou/archive/truth/WENZHOU_QINGJIANG_22000KM2_12_5M_COG.tif'
$ReceiptRelative = 'projects/wenzhou/archive/truth/upload-receipt.json'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & git -C $RepoRoot @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git command failed with exit code $LASTEXITCODE: git $($Arguments -join ' ')"
    }
}

function Select-SourceFile {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = '选择温州 22000 平方公里权威 COG'
    $dialog.Filter = 'GeoTIFF (*.tif)|*.tif|All files (*.*)|*.*'
    $dialog.FileName = $ExpectedName
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        throw '未选择文件，上传已安全停止。'
    }
    return $dialog.FileName
}

if ([string]::IsNullOrWhiteSpace($SourceFile)) {
    $SourceFile = Select-SourceFile
}

$SourceFile = (Resolve-Path -LiteralPath $SourceFile).Path
$sourceItem = Get-Item -LiteralPath $SourceFile
if ($sourceItem.Length -ne $ExpectedBytes) {
    throw "文件大小不一致。实测 $($sourceItem.Length) 字节，要求 $ExpectedBytes 字节。"
}

Write-Host '正在计算源文件 SHA-256，请保持窗口开启。'
$sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $SourceFile).Hash.ToLowerInvariant()
if ($sourceHash -ne $ExpectedSha256) {
    throw "SHA-256 不一致。实测 $sourceHash，要求 $ExpectedSha256。"
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw '没有找到 Git。请先安装 Git for Windows。'
}

& git lfs version | Out-Host
if ($LASTEXITCODE -ne 0) {
    throw '没有找到 Git LFS。请先安装 Git LFS。'
}

$originUrl = (& git -C $RepoRoot remote get-url origin).Trim()
if ($LASTEXITCODE -ne 0 -or $originUrl -notmatch 'haihao0307/guilin-dem-pipeline') {
    throw "当前目录没有连接到目标仓库。实际 origin 为 $originUrl"
}

$dirty = & git -C $RepoRoot status --porcelain
if ($LASTEXITCODE -ne 0) {
    throw '无法读取 Git 工作区状态。'
}
if ($dirty) {
    throw '工作区存在未提交修改。为防止覆盖文件，上传已安全停止。请先提交或另建干净克隆。'
}

Invoke-Git fetch origin $Branch
& git -C $RepoRoot show-ref --verify --quiet "refs/heads/$Branch"
if ($LASTEXITCODE -eq 0) {
    Invoke-Git switch $Branch
} else {
    Invoke-Git switch --create $Branch --track "origin/$Branch"
}
Invoke-Git pull --ff-only origin $Branch
Invoke-Git lfs install --local

$attribute = (& git -C $RepoRoot check-attr filter -- $TargetRelative) -join "`n"
if ($attribute -notmatch 'filter: lfs') {
    throw "目标 TIFF 未被 Git LFS 规则管理：$attribute"
}

$targetPath = Join-Path $RepoRoot $TargetRelative
$targetDirectory = Split-Path -Parent $targetPath
New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
Copy-Item -LiteralPath $SourceFile -Destination $targetPath -Force

$copiedItem = Get-Item -LiteralPath $targetPath
$copiedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant()
if ($copiedItem.Length -ne $ExpectedBytes -or $copiedHash -ne $ExpectedSha256) {
    Remove-Item -LiteralPath $targetPath -Force -ErrorAction SilentlyContinue
    throw '复制后的文件未通过大小或 SHA-256 校验，目标文件已删除。'
}

$receipt = [ordered]@{
    schema = 'wenzhou_dem_github_lfs_upload_receipt@1.0.0'
    uploadedAtUtc = [DateTime]::UtcNow.ToString('o')
    branch = $Branch
    repositoryPath = $TargetRelative
    filename = $ExpectedName
    bytes = $ExpectedBytes
    sha256 = $ExpectedSha256
    sourceHashVerified = $true
    copiedHashVerified = $true
    gitLfsRequired = $true
    remotePushCompleted = $false
    freshDownloadVerified = $false
}
$receiptPath = Join-Path $RepoRoot $ReceiptRelative
$receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $receiptPath -Encoding utf8

Invoke-Git add -- $TargetRelative $ReceiptRelative
$staged = & git -C $RepoRoot diff --cached --name-only
if ($LASTEXITCODE -ne 0 -or -not $staged) {
    throw '没有检测到待提交的 COG 或收据。'
}

Invoke-Git commit -m 'Archive verified Wenzhou 22000 km2 truth COG with Git LFS'
Invoke-Git lfs push origin $Branch
Invoke-Git push origin "HEAD:$Branch"
Invoke-Git lfs fsck

$lfsFiles = & git -C $RepoRoot lfs ls-files --name-only
if ($LASTEXITCODE -ne 0 -or $lfsFiles -notcontains $TargetRelative) {
    throw '推送后 Git LFS 文件清单中没有找到目标 COG。'
}

$receipt.remotePushCompleted = $true
$receipt.commit = (& git -C $RepoRoot rev-parse HEAD).Trim()
$receipt.gitLfsFsckPassed = $true
$receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $receiptPath -Encoding utf8
Invoke-Git add -- $ReceiptRelative
Invoke-Git commit -m 'Record Wenzhou COG Git LFS upload receipt'
Invoke-Git push origin "HEAD:$Branch"

Write-Host ''
Write-Host '温州权威 COG 已推送到 GitHub LFS。'
Write-Host "分支：$Branch"
Write-Host "仓库路径：$TargetRelative"
Write-Host "SHA-256：$ExpectedSha256"
Write-Host '下一步必须从 GitHub 新目录重新下载一次并复核 SHA-256，随后才可将 archive-manifest.json 改为 archived_verified。'
