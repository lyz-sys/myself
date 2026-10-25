# Remove Windows logon autostart for the personal site.

$ErrorActionPreference = "Continue"
$TaskName = "PersonalSiteKeepAlive"
$StartupDir = [Environment]::GetFolderPath("Startup")
$StartupShortcut = Join-Path $StartupDir "PersonalSiteKeepAlive.lnk"
$LauncherCmd = Join-Path $PSScriptRoot "keep-alive-autostart.cmd"
$lockFile = Join-Path $env:TEMP "personal-site-keepalive.pid"

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "[uninstall-autostart] Removed scheduled task: $TaskName"
} else {
  Write-Host "[uninstall-autostart] Task '$TaskName' not found."
}

if (Test-Path -LiteralPath $StartupShortcut) {
  Remove-Item -LiteralPath $StartupShortcut -Force
  Write-Host "[uninstall-autostart] Removed Startup shortcut."
}

if (Test-Path -LiteralPath $LauncherCmd) {
  Remove-Item -LiteralPath $LauncherCmd -Force
  Write-Host "[uninstall-autostart] Removed launcher cmd."
}

Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
Write-Host "[uninstall-autostart] Cleared keep-alive lock. The site process, if still running, was left up."
