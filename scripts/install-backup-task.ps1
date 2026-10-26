<#
  Tạo tác vụ Task Scheduler "SpaCRM Backup": chạy scripts\backup.ps1 hằng ngày lúc 23:00,
  chạy cả khi không ai đăng nhập Windows (tài khoản SYSTEM), tự chạy bù nếu lúc đó máy tắt.

  Mở PowerShell bằng "Run as administrator" rồi chạy:
    powershell -ExecutionPolicy Bypass -File scripts\install-backup-task.ps1
  Đổi giờ:  ... -At 22:30
  Gỡ:       Unregister-ScheduledTask -TaskName "SpaCRM Backup" -Confirm:$false
#>
param([string]$At = '23:00')

$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host 'Hãy mở PowerShell bằng "Run as administrator" rồi chạy lại.' -ForegroundColor Red
  exit 1
}

$script = Join-Path $PSScriptRoot 'backup.ps1'
$root = Split-Path -Parent $PSScriptRoot

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -Trigger scheduled" `
  -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 15) `
  -RunOnlyIfNetworkAvailable:$false

Register-ScheduledTask -TaskName 'SpaCRM Backup' -Action $action -Trigger $trigger -Principal $principal `
  -Settings $settings -Description 'Sao lưu Spa CRM vào thư mục BACKUP_DIR trên máy' -Force | Out-Null

Write-Host "Đã tạo tác vụ 'SpaCRM Backup' chạy hằng ngày lúc $At." -ForegroundColor Green
Write-Host 'Chạy thử ngay: Start-ScheduledTask -TaskName "SpaCRM Backup"'
