<#
  Khôi phục Spa CRM từ một bản sao lưu .zip.enc (tạo bởi backup.ps1).

  powershell -ExecutionPolicy Bypass -File scripts\restore.ps1 D:\Tai\spa_crm_2026-10-01_2300.zip.enc
  powershell -ExecutionPolicy Bypass -File scripts\restore.ps1 <file.zip.enc> -Database spa_crm_test

  -Database: tên database đích (mặc định lấy từ DATABASE_URL). Database phải tồn tại sẵn
             (createdb). Dữ liệu cũ trong database đích sẽ bị XOÁ và thay bằng bản sao lưu.
  -Yes:      bỏ qua câu hỏi xác nhận.
#>
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$File,
  [string]$Database = '',
  [switch]$Yes
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$Root = Split-Path -Parent $PSScriptRoot
$Utf8 = New-Object System.Text.UTF8Encoding $false
. (Join-Path $PSScriptRoot 'backup-lib.ps1')

$Env = @{}
$envFile = Join-Path $Root '.env'
if (Test-Path $envFile) {
  foreach ($line in [IO.File]::ReadAllLines($envFile, $Utf8)) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      $v = $Matches[2].Trim()
      if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) { $v = $v.Substring(1, $v.Length - 2) }
      $Env[$Matches[1]] = $v
    }
  }
}
function Conf([string]$key, [string]$default = '') {
  if ($Env.ContainsKey($key) -and $Env[$key]) { return $Env[$key] }
  return $default
}

$DbUrl = (Conf 'DATABASE_URL') -replace '\?.*$', ''
$PgBin = Conf 'PG_BIN' 'C:\Program Files\PostgreSQL\15\bin'
$PgRestore = Join-Path $PgBin 'pg_restore.exe'

if (-not (Test-Path $File)) { Write-Error "Không thấy file $File"; exit 1 }
if (-not $DbUrl) { Write-Error 'Thiếu DATABASE_URL trong .env'; exit 1 }
if (-not (Test-Path $PgRestore)) { Write-Error "Không thấy pg_restore.exe trong $PgBin"; exit 1 }

if ($Database) {
  # Thay tên database ở cuối URL: postgresql://user:pass@host:port/<db>
  $DbUrl = $DbUrl -replace '/[^/]*$', "/$Database"
}
$target = ($DbUrl -replace '^.*/', '')

$Password = Conf 'BACKUP_PASSWORD'
if (-not $Password) {
  $sec = Read-Host 'Mật khẩu bản sao lưu (BACKUP_PASSWORD)' -AsSecureString
  $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
}

if (-not $Yes) {
  Write-Host ''
  Write-Host "Sẽ khôi phục '$((Split-Path $File -Leaf))' vào database '$target'." -ForegroundColor Yellow
  Write-Host 'Toàn bộ dữ liệu hiện có trong database này sẽ bị thay thế.' -ForegroundColor Yellow
  $ans = Read-Host 'Gõ CO để tiếp tục'
  if ($ans -ne 'CO') { Write-Host 'Đã huỷ.'; exit 1 }
  Write-Host 'Nên dừng app (dịch vụ SpaCRM) trước khi khôi phục.'
}

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("spa_restore_" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  $zip = Join-Path $tmp 'backup.zip'
  Unprotect-BackupFile (Resolve-Path $File).Path $zip $Password
  Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force -ErrorAction Stop
  $dump = Get-ChildItem $tmp -Filter '*.dump' -Recurse | Select-Object -First 1
  if (-not $dump) { throw 'Không thấy file .dump trong bản sao lưu' }

  Write-Host "Đang khôi phục vào $target ..."
  & $PgRestore --clean --if-exists --no-owner --no-privileges -d $DbUrl $dump.FullName
  if ($LASTEXITCODE -ne 0) { throw "pg_restore kết thúc với mã $LASTEXITCODE (xem thông báo ở trên)" }
  Write-Host 'Khôi phục xong.' -ForegroundColor Green
  exit 0
} catch {
  Write-Host "LỖI: $_" -ForegroundColor Red
  exit 1
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
