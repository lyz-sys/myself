# Keep the personal site alive on 127.0.0.1:8090.
# Ctrl+C stops only this watcher. The site process keeps running.
# Autostart: npm run autostart:install

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Port = if ($env:PERSONAL_SITE_PORT) { [int]$env:PERSONAL_SITE_PORT } else { 8090 }
$ServerEntry = Join-Path $Root "server.js"
$HealthUrl = "http://127.0.0.1:$Port/health"
$PollSeconds = 3
$FailThreshold = 2

$extraPaths = @(
  "C:\Program Files\nodejs",
  "$env:APPDATA\npm"
) | Where-Object { $_ -and (Test-Path $_) }
$env:Path = (($extraPaths + ($env:Path -split ';' | Where-Object { $_ })) -join ';')

$logDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$logFile = Join-Path $logDir "keep-alive.log"

function Write-KeepAliveLog([string]$Message) {
  $line = "[keep-alive] $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
  Write-Host $line
  try { Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue } catch {}
}

function Resolve-NodeCommand {
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $fallback = "C:\Program Files\nodejs\node.exe"
  if (Test-Path $fallback) { return $fallback }
  return $null
}

function Test-ServerHealth {
  try {
    $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
  } catch {
    return $false
  }
}

function Clear-PortListeners {
  try {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object {
        Write-KeepAliveLog "freeing port $Port (pid=$($_.OwningProcess))"
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
      }
  } catch {}
}

function Stop-TrackedServer($Proc) {
  if (-not $Proc) { return }
  try {
    if (Get-Process -Id $Proc.Id -ErrorAction SilentlyContinue) {
      Write-KeepAliveLog "stopping server pid=$($Proc.Id)"
      Stop-Process -Id $Proc.Id -Force -ErrorAction SilentlyContinue
    }
  } catch {}
  Clear-PortListeners
  Start-Sleep -Seconds 1
}

$lockFile = Join-Path $env:TEMP "personal-site-keepalive.pid"
if (Test-Path -LiteralPath $lockFile) {
  $oldPid = 0
  try { $oldPid = [int](Get-Content -LiteralPath $lockFile -ErrorAction Stop | Select-Object -First 1) } catch {}
  if ($oldPid -gt 0 -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
    Write-KeepAliveLog "another instance running (pid=$oldPid). Exiting."
    exit 0
  }
  Write-KeepAliveLog "removing stale lock (pid=$oldPid)"
  Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
}
Set-Content -LiteralPath $lockFile -Value $PID -Encoding ASCII

$serverProc = $null

try {
  [Console]::TreatControlCAsInput = $false
  $null = [Console]::add_CancelKeyPress({
    param($sender, $eventArgs)
    $eventArgs.Cancel = $true
    Write-KeepAliveLog "Ctrl+C ignored. Close the window to stop the watcher. The site stays up."
  })
} catch {
  Write-KeepAliveLog "note: could not trap Ctrl+C ($($_.Exception.Message))"
}

try {
  Write-KeepAliveLog "root=$Root pid=$PID port=$Port"
  $nodeExe = Resolve-NodeCommand
  if (-not $nodeExe) {
    Write-KeepAliveLog "ERROR: node not found"
    exit 1
  }
  if (-not (Test-Path $ServerEntry)) {
    Write-KeepAliveLog "ERROR: missing $ServerEntry"
    exit 1
  }

  Write-KeepAliveLog "watch loop started (health=$HealthUrl)"

  while ($true) {
    $alive = $false
    if ($serverProc) {
      $alive = $null -ne (Get-Process -Id $serverProc.Id -ErrorAction SilentlyContinue)
    }

    if (-not $alive) {
      if ($serverProc) { Write-KeepAliveLog "server process gone — restarting" }
      Clear-PortListeners
      Start-Sleep -Milliseconds 400

      $env:PORT = "$Port"
      $serverProc = Start-Process `
        -FilePath $nodeExe `
        -ArgumentList "`"$ServerEntry`"" `
        -WorkingDirectory $Root `
        -WindowStyle Hidden `
        -PassThru

      Write-KeepAliveLog "started server pid=$($serverProc.Id)"

      $booted = $false
      for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        if (-not (Get-Process -Id $serverProc.Id -ErrorAction SilentlyContinue)) { break }
        if (Test-ServerHealth) { $booted = $true; break }
      }
      if (-not $booted) {
        Write-KeepAliveLog "server failed to become healthy — will retry"
        Stop-TrackedServer $serverProc
        $serverProc = $null
        Start-Sleep -Seconds 3
        continue
      }
      Write-KeepAliveLog "server healthy at http://127.0.0.1:$Port"
    }

    $fails = 0
    while ($serverProc -and (Get-Process -Id $serverProc.Id -ErrorAction SilentlyContinue)) {
      Start-Sleep -Seconds $PollSeconds
      if (-not (Get-Process -Id $serverProc.Id -ErrorAction SilentlyContinue)) { break }
      if (Test-ServerHealth) {
        $fails = 0
        continue
      }
      $fails++
      Write-KeepAliveLog "health check failed ($fails/$FailThreshold)"
      if ($fails -ge $FailThreshold) {
        Write-KeepAliveLog "restarting unhealthy server"
        Stop-TrackedServer $serverProc
        $serverProc = $null
        break
      }
    }
  }
} finally {
  Write-KeepAliveLog "watcher exiting — leaving the site running."
  if (Test-Path -LiteralPath $lockFile) {
    $stored = 0
    try { $stored = [int](Get-Content -LiteralPath $lockFile -ErrorAction SilentlyContinue | Select-Object -First 1) } catch {}
    if ($stored -eq $PID) {
      Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
    }
  }
}
