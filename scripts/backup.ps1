<#
  Sao lưu Spa CRM: pg_dump -> nén .zip (Compress-Archive có sẵn trong Windows)
                   -> mã hoá AES-256 (.NET, xem backup-lib.ps1) -> .zip.enc trong BACKUP_DIR (chỉ lưu trên máy).
  Không cần cài thêm phần mềm. File .zip.enc chỉ mở được bằng restore.ps1 hoặc decrypt-backup.ps1 kèm mật khẩu.
  Giữ lại: 30 bản gần nhất + bản ngày 1 của mỗi tháng trong 12 tháng.

  Chạy tay:        powershell -ExecutionPolicy Bypass -File scripts\backup.ps1
  Task Scheduler:  ... -File scripts\backup.ps1 -Trigger scheduled
  Từ app:          ... -File scripts\backup.ps1 -LogId 12 -Trigger manual   (app đã tạo dòng backup_logs)

  Cấu hình đọc từ file .env ở thư mục gốc dự án:
    DATABASE_URL, BACKUP_PASSWORD, BACKUP_DIR, PG_BIN
#>
param(
  [int]$LogId = 0,
  [ValidateSet('scheduled', 'manual')][string]$Trigger = 'scheduled'
)

# 'Continue': trong PowerShell 5.1, stderr của lệnh ngoài (pg_dump, psql) với 'Stop' sẽ bị coi là lỗi.
# Lỗi được kiểm tra bằng $LASTEXITCODE và throw thủ công.
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'   # thanh tiến độ của Compress-Archive làm chậm và rác log
$Root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'backup-lib.ps1')
$Utf8 = New-Object System.Text.UTF8Encoding $false

# ---------- .env ----------
$Env = @{}
$envFile = Join-Path $Root '.env'
if (Test-Path $envFile) {
  foreach ($line in [IO.File]::ReadAllLines($envFile, $Utf8)) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      $v = $Matches[2].Trim()
      if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
        $v = $v.Substring(1, $v.Length - 2)
      }
      $Env[$Matches[1]] = $v
    }
  }
}
function Conf([string]$key, [string]$default = '') {
  if ($Env.ContainsKey($key) -and $Env[$key]) { return $Env[$key] }
  $fromProcess = [Environment]::GetEnvironmentVariable($key)
  if ($fromProcess) { return $fromProcess }
  return $default
}

$DbUrl = (Conf 'DATABASE_URL') -replace '\?.*$', ''   # psql/pg_dump không hiểu ?schema=public
$Password = Conf 'BACKUP_PASSWORD'
$BackupDir = Conf 'BACKUP_DIR' (Join-Path $Root 'backups')
$PgBin = Conf 'PG_BIN' 'C:\Program Files\PostgreSQL\15\bin'
$KeepRecent = 30    # số bản gần nhất luôn giữ
$KeepMonths = 12    # bản ngày 1 mỗi tháng giữ trong bấy nhiêu tháng

$Psql = Join-Path $PgBin 'psql.exe'
$PgDump = Join-Path $PgBin 'pg_dump.exe'
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$LogFile = Join-Path $BackupDir 'backup.log'

function Log([string]$msg) {
  $line = "{0:yyyy-MM-dd HH:mm:ss} [{1}] {2}" -f (Get-Date), $Trigger, $msg
  [IO.File]::AppendAllText($LogFile, $line + "`r`n", $Utf8)
  Write-Host $line
}

function Sql-Quote([string]$s) {
  if ($null -eq $s) { return 'NULL' }
  return "'" + $s.Replace("'", "''") + "'"
}

# Chạy SQL qua file tạm (UTF-8) để tiếng Việt không bị lỗi mã hoá trên dòng lệnh Windows.
function Invoke-Sql([string]$sql) {
  $tmp = [IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllText($tmp, $sql, $Utf8)
    $env:PGCLIENTENCODING = 'UTF8'
    $out = & $Psql -X -q -t -A -v ON_ERROR_STOP=1 -d $DbUrl -f $tmp 2>&1
    if ($LASTEXITCODE -ne 0) { throw "psql lỗi: $out" }
    return ($out | Out-String).Trim()
  } finally {
    Remove-Item $tmp -ErrorAction SilentlyContinue
  }
}

function Finish-Log([string]$status, [string]$fileName, [Nullable[long]]$size, [string]$err) {
  if ($LogId -le 0) { return }
  $sizeSql = if ($null -ne $size) { "$size" } else { 'NULL' }
  $fileSql = if ($fileName) { Sql-Quote $fileName } else { 'NULL' }
  $errSql = if ($err) { Sql-Quote ($err.Substring(0, [Math]::Min(1000, $err.Length))) } else { 'NULL' }
  try {
    # Cột uploaded không còn dùng (không đẩy lên cloud), luôn để false.
    Invoke-Sql "UPDATE backup_logs SET status='$status', finished_at=now(), file_name=$fileSql, size_bytes=$sizeSql, uploaded=false, error_message=$errSql WHERE id=$LogId;" | Out-Null
  } catch {
    Log "Không ghi được backup_logs: $_"
  }
}

$archive = $null
$size = $null
try {
  if (-not $DbUrl) { throw 'Thiếu DATABASE_URL trong .env' }
  if (-not (Test-Path $Psql)) { throw "Không thấy psql.exe trong PG_BIN ($PgBin)" }

  if ($LogId -le 0) {
    $LogId = [int](Invoke-Sql "INSERT INTO backup_logs (started_at, status, uploaded, trigger) VALUES (now(), 'running', false, '$Trigger') RETURNING id;")
  }
  Log "Bắt đầu sao lưu (log #$LogId)"

  if (-not $Password) { throw 'Thiếu BACKUP_PASSWORD trong .env' }
  if (-not (Test-Path $PgDump)) { throw "Không thấy pg_dump.exe trong PG_BIN ($PgBin)" }
  # 1) pg_dump
  $stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
  $dump = Join-Path $BackupDir "spa_crm_$stamp.dump"
  $zip = Join-Path $BackupDir "spa_crm_$stamp.zip"
  $archive = Join-Path $BackupDir "spa_crm_$stamp.zip.enc"
  $dumpErr = & $PgDump -Fc --no-owner -d $DbUrl -f $dump 2>&1
  if ($LASTEXITCODE -ne 0) { throw "pg_dump lỗi: $dumpErr" }

  # 2) nén bằng zip của Windows, rồi mã hoá AES-256 (zip của Windows không đặt được mật khẩu).
  #    Không ghi mật khẩu ra log. Xoá .dump và .zip chưa mã hoá ngay sau đó.
  try {
    if (Test-Path $zip) { Remove-Item $zip -Force }
    Compress-Archive -LiteralPath $dump -DestinationPath $zip -CompressionLevel Optimal -ErrorAction Stop
    try {
      Protect-BackupFile $zip $archive $Password
    } catch {
      Remove-Item $archive -Force -ErrorAction SilentlyContinue   # không để lại file mã hoá dở dang
      throw "Mã hoá lỗi: $_"
    }
  } finally {
    Remove-Item $dump, $zip -Force -ErrorAction SilentlyContinue
  }
  $size = (Get-Item $archive -ErrorAction Stop).Length
  $fileName = Split-Path $archive -Leaf
  Log "Đã tạo $fileName ($size bytes)"

  # 3) dọn bản cũ (lỗi dọn dẹp không làm hỏng lần sao lưu)
  try {
    $removed = Remove-OldBackups $BackupDir $KeepRecent $KeepMonths
    if ($removed) { Log "Đã xoá $removed bản cũ" }
  } catch {
    Log "Không dọn được bản cũ: $_"
  }

  Finish-Log 'success' $fileName $size $null
  Log 'Hoàn tất'
  exit 0
} catch {
  $msg = "$_"
  Log "LỖI: $msg"
  $name = if ($archive -and (Test-Path $archive)) { Split-Path $archive -Leaf } else { $null }
  Finish-Log 'failed' $name $size $msg
  exit 1
}
