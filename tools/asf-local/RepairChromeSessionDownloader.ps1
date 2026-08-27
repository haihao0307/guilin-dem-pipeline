param(
    [string]$Path = 'C:\HaihaoDEM\ASF_v104_local\scripts\run_chrome_session_download.ps1',
    [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Path)) {
    throw "ASF Chrome session script was not found: $Path"
}

$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
$content = Get-Content -Raw -LiteralPath $resolvedPath
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput(
    $content,
    [ref]$tokens,
    [ref]$parseErrors
)

if (@($parseErrors).Count -gt 0) {
    $message = @($parseErrors | ForEach-Object { $_.Message }) -join '; '
    throw "The existing Chrome session script has PowerShell syntax errors: $message"
}

$memberNodes = @($ast.FindAll({
    param($node)
    if ($node -isnot [System.Management.Automation.Language.MemberExpressionAst]) {
        return $false
    }
    $memberText = $node.Member.Extent.Text.Trim("'", '"')
    return $memberText -ieq 'Count'
}, $true))

$edits = @()
foreach ($node in $memberNodes) {
    $expressionText = $node.Expression.Extent.Text
    if ($expressionText.TrimStart().StartsWith('@(')) {
        continue
    }
    $edits += [pscustomobject]@{
        Start = $node.Expression.Extent.StartOffset
        End = $node.Expression.Extent.EndOffset
        Original = $expressionText
        Replacement = "@($expressionText)"
        Line = $node.Expression.Extent.StartLineNumber
    }
}

if (@($edits).Count -eq 0) {
    Write-Host 'No unguarded .Count expression was found. No file was changed.' -ForegroundColor Green
    exit 0
}

$patched = $content
foreach ($edit in @($edits | Sort-Object Start -Descending)) {
    $prefix = $patched.Substring(0, $edit.Start)
    $suffix = $patched.Substring($edit.End)
    $patched = $prefix + $edit.Replacement + $suffix
}

$checkTokens = $null
$checkErrors = $null
[void][System.Management.Automation.Language.Parser]::ParseInput(
    $patched,
    [ref]$checkTokens,
    [ref]$checkErrors
)
if (@($checkErrors).Count -gt 0) {
    $message = @($checkErrors | ForEach-Object { $_.Message }) -join '; '
    throw "The proposed Count repair did not pass PowerShell syntax validation: $message"
}

Write-Host ''
Write-Host 'ASF Chrome session Count repair plan' -ForegroundColor Cyan
Write-Host ("Script: {0}" -f $resolvedPath)
Write-Host ("Expressions to repair: {0}" -f @($edits).Count)
foreach ($edit in @($edits | Sort-Object Line)) {
    Write-Host ("Line {0}: {1}.Count  ->  @({1}).Count" -f $edit.Line, $edit.Original)
}

if (-not $Apply) {
    $previewPath = $resolvedPath + '.countfix.preview.ps1'
    Set-Content -LiteralPath $previewPath -Value $patched -Encoding UTF8
    Write-Host ''
    Write-Host 'Preview created. The original script was not changed.' -ForegroundColor Yellow
    Write-Host ("Preview: {0}" -f $previewPath) -ForegroundColor Yellow
    Write-Host 'Run this tool again with -Apply after reviewing the preview.' -ForegroundColor Yellow
    exit 0
}

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupPath = $resolvedPath + ".before-countfix-$stamp.bak"
Copy-Item -LiteralPath $resolvedPath -Destination $backupPath -Force
Set-Content -LiteralPath $resolvedPath -Value $patched -Encoding UTF8

Write-Host ''
Write-Host 'Count repair applied successfully.' -ForegroundColor Green
Write-Host ("Backup: {0}" -f $backupPath) -ForegroundColor Green
Write-Host ("Updated: {0}" -f $resolvedPath) -ForegroundColor Green
