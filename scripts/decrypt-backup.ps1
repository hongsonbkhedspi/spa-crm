<#
  Giải mã một bản sao lưu .zip.enc thành file .zip thường (mở được bằng Windows Explorer),
  bên trong là file .dump của pg_dump. Dùng khi cần lấy file ra xem/chép mà không khôi phục.

  powershell -ExecutionPolicy Bypass -File scripts\decrypt-backup.ps1 D:\Tai\spa_crm_2026-10-01_2300.zip.enc
  -> tạo D:\Tai\spa_crm_2026-10-01_2300.zip

  Mật khẩu lấy từ BACKUP_PASSWORD trong .env; nếu không có thì hỏi.
#>
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$File,
  [string]$Out = ''
)

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'backup-lib.ps1')

if (-not (Test-Path $File)) { Write-Error "Không thấy file $File"; exit 1 }
$src = (Resolve-Path $File).Path
if (-not $Out) { $Out = $src -replace '\.enc$', '' }
if ($Out -eq $src) { $Out = "$src.zip" }

$Password = ''
$envFile = Join-Path $Root '.env'
if (Test-Path $envFile) {
  $m = Select-String -Path $envFile -Pattern '^\s*BACKUP_PASSWORD\s*=\s*"?([^"]*)"?\s*$' -Encoding UTF8 | Select-Object -First 1
  if ($m) { $Password = $m.Matches[0].Groups[1].Value }
}
if (-not $Password) {
  $sec = Read-Host 'Mật khẩu bản sao lưu (BACKUP_PASSWORD)' -AsSecureString
  $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
}

try {
  Unprotect-BackupFile $src $Out $Password
  Write-Host "Đã giải mã: $Out" -ForegroundColor Green
  exit 0
} catch {
  Remove-Item $Out -Force -ErrorAction SilentlyContinue
  Write-Host "LỖI: $_" -ForegroundColor Red
  exit 1
}
