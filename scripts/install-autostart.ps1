# Install Windows logon autostart for the personal site.
# Run once: npm run autostart:install

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$TaskName = "PersonalSiteKeepAlive"
$KeepAlive = Join-Path $PSScriptRoot "keep-alive.ps1"
$LauncherCmd = Join-Path $PSScriptRoot "keep-alive-autostart.cmd"
$StartupDir = [Environment]::GetFolderPath("Startup")
$StartupShortcut = Join-Path $StartupDir "PersonalSiteKeepAlive.lnk"

if (-not (Test-Path $KeepAlive)) {
  throw "Missing keep-alive script: $KeepAlive"
}

$launcherBody = @"
@echo off
REM Autostart wrapper — waits for desktop/PATH, then runs keep-alive.
cd /d "$Root"
timeout /t 25 /nobreak >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "$KeepAlive"
"@
Set-Content -LiteralPath $LauncherCmd -Value $launcherBody -Encoding ASCII

$lockFile = Join-Path $env:TEMP "personal-site-keepalive.pid"
Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction `
  -Execute "cmd.exe" `
  -Argument "/c `"$LauncherCmd`"" `
  -WorkingDirectory $Root

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
try { $trigger.Delay = "PT30S" } catch {}

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 5 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal `
  -UserId "$env:USERDOMAIN\$env:USERNAME" `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Start the personal site keep-alive after Windows logon" `
  -Force | Out-Null

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($StartupShortcut)
$shortcut.TargetPath = $LauncherCmd
$shortcut.WorkingDirectory = $Root
$shortcut.WindowStyle = 7
$shortcut.Description = "Personal site keep-alive"
$shortcut.Save()

Write-Host "[install-autostart] Scheduled task: $TaskName"
Write-Host "[install-autostart] Startup shortcut: $StartupShortcut"
Write-Host "[install-autostart] Site: http://127.0.0.1:8090"
Write-Host "[install-autostart] Starting keep-alive now..."

Start-Process -FilePath "powershell.exe" `
  -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$KeepAlive`"" `
  -WorkingDirectory $Root

Write-Host "[install-autostart] Done."
