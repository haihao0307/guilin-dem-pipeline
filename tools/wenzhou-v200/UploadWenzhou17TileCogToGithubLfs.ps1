param(
    [Parameter(Mandatory = $false)]
    [string]$SourceFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ExpectedName = 'WENZHOU_17TILE_SCREENSHOT_CROP_12_5M_COG.tif'
$ExpectedBytes = 136760745
$ExpectedSha256 = 'c1da93dca81abc2ee9edaa47496d80c6fa36155e11c9b61464f4f2b547659b43'
$Branch = 'project/wenzhou-v200-17tile-truth-hydrology-rebuild'
$TargetRelative = 'projects/wenzhou/v200/truth/WENZHOU_17TILE_SCREENSHOT_CROP_12_5M_COG.tif'
$ReceiptRelative = 'projects/wenzhou/v200/truth/upload-receipt.json'
$ManifestRelative = 'projects/wenzhou/v200/truth/WENZHOU_17TILE_TRUTH_MANIFEST.json'
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
    $dialog.Title = '选择温州 V200 新 17 源权威 COG'
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

if (-not (Test-Path -LiteralPath $SourceFile -PathType Leaf)) {
    throw "找不到源文件：$SourceFile"
}
$SourceFile = (Resolve-Path -LiteralPath $SourceFile).Path
$sourceItem = Get-Item -LiteralPath $SourceFile
if ($sourceItem.Name -ne $ExpectedName) {
    Write-Warning "文件名为 $($sourceItem.Name)，冻结名称为 $ExpectedName。将继续以字节数和 SHA-256 作为最终身份门槛。"
}
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
    throw '工作区存在未提交修改。为防止覆盖文件，上传已安全停止。请使用干净克隆。'
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

$manifestPath = Join-Path $RepoRoot $ManifestRelative
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "缺少真值清单：$ManifestRelative"
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding utf8 | ConvertFrom-Json
if ([int64]$manifest.truthCog.expectedBytes -ne $ExpectedBytes) {
    throw '清单中的预期字节数与上传脚本不一致。'
}
if ([string]$manifest.truthCog.expectedSha256 -ne $ExpectedSha256) {
    throw '清单中的预期 SHA-256 与上传脚本不一致。'
}

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
    schema = 'wenzhou_v200_truth_lfs_upload_receipt@1.0.0'
    preparedAtUtc = [DateTime]::UtcNow.ToString('o')
    branch = $Branch
    repositoryPath = $TargetRelative
    selectedSourcePath = $SourceFile
    filename = $ExpectedName
    bytes = $ExpectedBytes
    sha256 = $ExpectedSha256
    sourceHashVerified = $true
    copiedHashVerified = $true
    gitLfsRequired = $true
    localLfsFsckPassed = $false
    pushRequested = $true
    remotePushVerified = $false
    freshCloneVerified = $false
    verificationWorkflow = '.github/workflows/wenzhou-v200-truth-lfs-verify.yml'
}
$receiptPath = Join-Path $RepoRoot $ReceiptRelative
$receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $receiptPath -Encoding utf8

Invoke-Git add -- $TargetRelative $ReceiptRelative
$staged = & git -C $RepoRoot diff --cached --name-only
if ($LASTEXITCODE -ne 0 -or -not $staged) {
    throw '没有检测到待提交的 COG 或收据。'
}

Invoke-Git commit -m 'Upload exact Wenzhou V200 17-tile truth COG for verification'
Invoke-Git lfs push origin $Branch
Invoke-Git push origin "HEAD:$Branch"
Invoke-Git lfs fsck

$lfsFiles = & git -C $RepoRoot lfs ls-files --name-only
if ($LASTEXITCODE -ne 0 -or $lfsFiles -notcontains $TargetRelative) {
    throw '推送后本地 Git LFS 文件清单中没有找到目标 COG。'
}

Write-Host ''
Write-Host '温州 V200 新 17 源 COG 已提交并请求推送到 GitHub LFS。'
Write-Host "分支：$Branch"
Write-Host "仓库路径：$TargetRelative"
Write-Host "字节数：$ExpectedBytes"
Write-Host "SHA-256：$ExpectedSha256"
Write-Host 'GitHub Actions 将执行独立 fresh clone 与 SHA-256 复核。验证完成前，清单仍保持 binary pending。'
