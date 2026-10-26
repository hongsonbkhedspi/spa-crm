<#
  Hàm dùng chung cho sao lưu:
  - Mã hoá / giải mã file sao lưu bằng AES-256 có sẵn trong Windows (.NET), không cần cài thêm phần mềm.
  - Remove-OldBackups: dọn bản cũ trong thư mục sao lưu.
  Dùng chung cho backup.ps1, restore.ps1, decrypt-backup.ps1 (dot-source: . "$PSScriptRoot\backup-lib.ps1").

  Định dạng file .zip.enc:
    "SPACRM01" (8 byte) | salt (16) | IV (16) | dữ liệu mã hoá AES-256-CBC (PKCS7) | HMAC-SHA256 (32)
  Khoá: PBKDF2-SHA256 (200.000 vòng) từ BACKUP_PASSWORD -> 64 byte: 32 byte khoá AES + 32 byte khoá HMAC.
  HMAC tính trên toàn bộ phần trước nó (encrypt-then-MAC), nên sai mật khẩu hoặc file bị sửa đều bị phát hiện
  trước khi giải mã.
#>

$script:BackupMagic = [Text.Encoding]::ASCII.GetBytes('SPACRM01')
$script:BackupIterations = 200000

function Get-BackupKeys([string]$Password, [byte[]]$Salt) {
  # Constructor có HashAlgorithmName cần .NET Framework 4.7.2+ (Windows 10 1803 trở lên đã có sẵn).
  $kdf = New-Object Security.Cryptography.Rfc2898DeriveBytes($Password, $Salt, $script:BackupIterations, [Security.Cryptography.HashAlgorithmName]::SHA256)
  try {
    $bytes = $kdf.GetBytes(64)
    return @{ Enc = [byte[]]$bytes[0..31]; Mac = [byte[]]$bytes[32..63] }
  } finally {
    $kdf.Dispose()
  }
}

# HMAC-SHA256 của $Length byte đầu tiên của file, đọc theo từng khối.
function Get-FileHmac([string]$Path, [byte[]]$Key, [long]$Length) {
  $hmac = New-Object Security.Cryptography.HMACSHA256 (, $Key)
  $fs = [IO.File]::OpenRead($Path)
  try {
    $buf = New-Object byte[] 1048576
    $left = $Length
    while ($left -gt 0) {
      $n = $fs.Read($buf, 0, [int][Math]::Min($buf.Length, $left))
      if ($n -le 0) { throw 'File sao lưu bị cắt ngắn' }
      [void]$hmac.TransformBlock($buf, 0, $n, $null, 0)
      $left -= $n
    }
    [void]$hmac.TransformFinalBlock((New-Object byte[] 0), 0, 0)
    return $hmac.Hash
  } finally {
    $fs.Dispose()
    $hmac.Dispose()
  }
}

function Protect-BackupFile([string]$InFile, [string]$OutFile, [string]$Password) {
  if (-not $Password) { throw 'Thiếu mật khẩu sao lưu' }
  $rng = New-Object Security.Cryptography.RNGCryptoServiceProvider
  $salt = New-Object byte[] 16; $rng.GetBytes($salt)
  $iv = New-Object byte[] 16; $rng.GetBytes($iv)
  $rng.Dispose()
  $keys = Get-BackupKeys $Password $salt

  $aes = [Security.Cryptography.Aes]::Create()
  $aes.KeySize = 256; $aes.Mode = 'CBC'; $aes.Padding = 'PKCS7'
  $aes.Key = $keys.Enc; $aes.IV = $iv

  $out = [IO.File]::Create($OutFile)
  try {
    $out.Write($script:BackupMagic, 0, $script:BackupMagic.Length)
    $out.Write($salt, 0, 16)
    $out.Write($iv, 0, 16)
    $crypto = New-Object Security.Cryptography.CryptoStream($out, $aes.CreateEncryptor(), 'Write')
    $in = [IO.File]::OpenRead($InFile)
    try { $in.CopyTo($crypto) } finally { $in.Dispose() }
    $crypto.FlushFinalBlock()
    $crypto.Dispose()   # đóng luôn $out
  } finally {
    $out.Dispose()
    $aes.Dispose()
  }

  $len = (Get-Item $OutFile).Length
  $mac = Get-FileHmac $OutFile $keys.Mac $len
  $fs = [IO.File]::Open($OutFile, 'Append')
  try { $fs.Write($mac, 0, $mac.Length) } finally { $fs.Dispose() }
}

function Unprotect-BackupFile([string]$InFile, [string]$OutFile, [string]$Password) {
  $total = (Get-Item $InFile).Length
  $headerLen = $script:BackupMagic.Length + 32
  if ($total -lt $headerLen + 16 + 32) { throw 'File không phải bản sao lưu Spa CRM (quá ngắn)' }

  $fs = [IO.File]::OpenRead($InFile)
  try {
    $header = New-Object byte[] $headerLen
    [void]$fs.Read($header, 0, $headerLen)
    $fs.Position = $total - 32
    $storedMac = New-Object byte[] 32
    [void]$fs.Read($storedMac, 0, 32)
  } finally {
    $fs.Dispose()
  }
  for ($i = 0; $i -lt $script:BackupMagic.Length; $i++) {
    if ($header[$i] -ne $script:BackupMagic[$i]) { throw 'File không phải bản sao lưu Spa CRM (.zip.enc)' }
  }
  $salt = [byte[]]$header[8..23]
  $iv = [byte[]]$header[24..39]
  $keys = Get-BackupKeys $Password $salt

  $mac = Get-FileHmac $InFile $keys.Mac ($total - 32)
  $diff = 0
  for ($i = 0; $i -lt 32; $i++) { $diff = $diff -bor ($mac[$i] -bxor $storedMac[$i]) }
  if ($diff -ne 0) { throw 'Sai mật khẩu hoặc file sao lưu đã bị hỏng' }

  $aes = [Security.Cryptography.Aes]::Create()
  $aes.KeySize = 256; $aes.Mode = 'CBC'; $aes.Padding = 'PKCS7'
  $aes.Key = $keys.Enc; $aes.IV = $iv

  $in = [IO.File]::OpenRead($InFile)
  $out = [IO.File]::Create($OutFile)
  try {
    $in.Position = $headerLen
    $crypto = New-Object Security.Cryptography.CryptoStream($out, $aes.CreateDecryptor(), 'Write')
    $buf = New-Object byte[] 1048576
    $left = $total - 32 - $headerLen
    while ($left -gt 0) {
      $n = $in.Read($buf, 0, [int][Math]::Min($buf.Length, $left))
      if ($n -le 0) { break }
      $crypto.Write($buf, 0, $n)
      $left -= $n
    }
    $crypto.FlushFinalBlock()
    $crypto.Dispose()
  } finally {
    $out.Dispose()
    $in.Dispose()
    $aes.Dispose()
  }
}

<#
  Dọn bản sao lưu cũ trong $Dir. Chỉ đụng tới file tên dạng spa_crm_YYYY-MM-DD_HHmm.zip.enc.
  Giữ: $KeepRecent bản mới nhất, cộng bản sớm nhất của ngày 1 mỗi tháng trong $KeepMonths tháng gần đây.
  Ngày lấy từ tên file (không dùng ngày sửa file, vì chép file sang chỗ khác sẽ đổi ngày đó).
  Trả về số file đã xoá.
#>
function Remove-OldBackups([string]$Dir, [int]$KeepRecent = 30, [int]$KeepMonths = 12, [datetime]$Now = (Get-Date)) {
  $pattern = '^spa_crm_(\d{4})-(\d{2})-(\d{2})_(\d{4})\.zip\.enc$'
  $files = @(Get-ChildItem -LiteralPath $Dir -File | Where-Object { $_.Name -match $pattern } | Sort-Object Name -Descending)
  $keep = @{}
  $files | Select-Object -First $KeepRecent | ForEach-Object { $keep[$_.Name] = $true }

  $oldestMonth = $Now.Date.AddDays(1 - $Now.Day).AddMonths(-($KeepMonths - 1))
  $monthsSeen = @{}
  # Duyệt từ cũ tới mới để giữ bản đầu tiên của ngày 1 mỗi tháng
  foreach ($f in ($files | Sort-Object Name)) {
    [void]($f.Name -match $pattern)
    if ($Matches[3] -ne '01') { continue }
    $month = Get-Date -Year ([int]$Matches[1]) -Month ([int]$Matches[2]) -Day 1 -Hour 0 -Minute 0 -Second 0 -Millisecond 0
    $key = "$($Matches[1])-$($Matches[2])"
    if ($month -ge $oldestMonth -and -not $monthsSeen.ContainsKey($key)) {
      $monthsSeen[$key] = $true
      $keep[$f.Name] = $true
    }
  }

  $removed = 0
  foreach ($f in $files) {
    if (-not $keep.ContainsKey($f.Name)) {
      Remove-Item -LiteralPath $f.FullName -Force -ErrorAction Stop
      $removed++
    }
  }
  return $removed
}
