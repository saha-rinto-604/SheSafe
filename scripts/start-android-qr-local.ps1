param(
  [int]$BackendPort = 4000,
  [int]$MetroPort   = 8081,
  [switch]$SkipMigrations
)

$ErrorActionPreference = 'Stop'

$scriptDir     = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot      = Resolve-Path (Join-Path $scriptDir "..")
$mobileDir     = Join-Path $repoRoot "app/resqher-mobile"
$backendDir    = Join-Path $repoRoot "backend"
$mobileEnvPath = Join-Path $mobileDir ".env"

# ---------------------------------------------------------------------------
function Stop-PortProcess {
  param([int]$Port)
  try {
    # Use netstat instead of Get-NetTCPConnection (which can hang on some Windows configs)
    $lines = netstat -ano 2>$null | Select-String ":$Port\s" | Select-String "LISTENING"
    if (-not $lines) { Write-Host "  Port $Port is free."; return }
    foreach ($line in $lines) {
      $parts = ($line -replace '\s+', ' ').Trim().Split(' ')
      $pid_ = $parts[-1]
      if ($pid_ -and $pid_ -ne '0' -and $pid_ -ne "$PID") {
        Write-Host "  Stopping PID $pid_ on port $Port..."
        Stop-Process -Id ([int]$pid_) -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {
    Write-Warning "Could not clean port ${Port}: $($_.Exception.Message)"
  }
}

function Get-LanIp {
  try {
    # Split ipconfig output into per-adapter blocks.
    # VirtualBox / VMware host-only adapters have no Default Gateway — skip them.
    # The real WiFi/Ethernet adapter always has a Default Gateway set.
    $raw = (ipconfig 2>$null) -join "`n"
    $blocks = ($raw + "`n") -split '(?m)(?=^\S)'
    foreach ($block in $blocks) {
      if ($block -match '(?m)Default Gateway[^:]*:\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})') {
        if ($block -match '(?m)IPv4 Address[^:]*:\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})') {
          return $matches[1]
        }
      }
    }
  } catch {}
  return '127.0.0.1'
}

function Clear-MobileCache {
  param([string]$MobilePath)
  $targets = @(
    (Join-Path $MobilePath '.expo'),
    (Join-Path $MobilePath 'node_modules/.cache')
  )
  foreach ($t in $targets) {
    if (Test-Path $t) {
      Write-Host "  Removing $t"
      Remove-Item $t -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  if ($env:TEMP) {
    foreach ($pat in @('metro-*','haste-map-*','react-native-packager-cache-*')) {
      Get-ChildItem -Path $env:TEMP -Filter $pat -ErrorAction SilentlyContinue |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

function Update-ExpoApiEnv {
  param([string]$EnvPath, [string]$ApiUrl)
  $line = "EXPO_PUBLIC_API_URL=$ApiUrl"
  if (-not (Test-Path $EnvPath)) {
    Set-Content -Path $EnvPath -Value $line -Encoding UTF8
    Write-Host "  Created .env: $line"
    return
  }
  $raw = Get-Content -Path $EnvPath -Raw
  if ($raw -match '(?m)^EXPO_PUBLIC_API_URL=.*$') {
    $updated = [regex]::Replace($raw, '(?m)^EXPO_PUBLIC_API_URL=.*$', $line)
  } else {
    $updated = $raw.TrimEnd() + "`r`n" + $line + "`r`n"
  }
  Set-Content -Path $EnvPath -Value $updated -Encoding UTF8
  Write-Host "  $line"
}

function Wait-ForBackend {
  param([string]$Url, [int]$Timeout = 30)
  $deadline = (Get-Date).AddSeconds($Timeout)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) { return $true }
    } catch {}
    Start-Sleep -Milliseconds 700
  }
  return $false
}

# ===========================================================================
# MAIN
# ===========================================================================

Write-Host ""
Write-Host "=== SheSafe Android QR Launcher ===" -ForegroundColor Cyan
Write-Host "Repo: $repoRoot"
Write-Host ""

# 1. Free ports
Write-Host "[1/7] Freeing ports $BackendPort and $MetroPort..." -ForegroundColor Yellow
Stop-PortProcess -Port $BackendPort
Stop-PortProcess -Port $MetroPort

# 2. Clear Expo cache
Write-Host ""
Write-Host "[2/7] Clearing Expo/Metro cache..." -ForegroundColor Yellow
Clear-MobileCache -MobilePath $mobileDir

# 3. Detect LAN IP and update .env
Write-Host ""
Write-Host "[3/7] Detecting LAN IP..." -ForegroundColor Yellow
$lanIp  = Get-LanIp
$apiUrl = "http://" + $lanIp + ":" + $BackendPort
Write-Host "  LAN IP : $lanIp"
Update-ExpoApiEnv -EnvPath $mobileEnvPath -ApiUrl $apiUrl

# 4. Run database migrations
Write-Host ""
if ($SkipMigrations) {
  Write-Host "[4/7] Skipping migrations (-SkipMigrations set)." -ForegroundColor DarkGray
} else {
  Write-Host "[4/7] Running database migrations..." -ForegroundColor Yellow
  $migrateScript = Join-Path $backendDir "scripts\migrate.js"
  try {
    $out = & node $migrateScript 2>&1
    $out | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  Migrations OK." -ForegroundColor Green
    } else {
      Write-Warning "  Migrations exited with code $LASTEXITCODE - check MySQL and backend/.env"
    }
  } catch {
    Write-Warning "  Could not run migrations: $($_.Exception.Message)"
    Write-Warning "  Make sure MySQL is running and credentials in backend/.env are correct."
  }
}

# 5. Start backend in a new terminal
Write-Host ""
Write-Host "[5/7] Starting backend in a new terminal..." -ForegroundColor Yellow
$backendCmd = "Write-Host 'SheSafe Backend - http://localhost:$BackendPort' -ForegroundColor Cyan; Set-Location '" + $backendDir + "'; npm.cmd run dev"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $backendCmd

# 6. Wait for backend health
$healthUrl = $apiUrl + "/api/health"
Write-Host "  Waiting for $healthUrl ..."
if (Wait-ForBackend -Url $healthUrl -Timeout 30) {
  Write-Host "  Backend is up." -ForegroundColor Green
} else {
  Write-Warning "  Backend did not respond in 30s - check the backend terminal for errors."
}

# 7. Fix Expo packages then start
Write-Host ""
Write-Host "[6/7] Fixing Expo package versions..." -ForegroundColor Yellow
Set-Location $mobileDir
npx.cmd expo install --fix

Write-Host ""
Write-Host "[7/7] Starting Expo - scan the QR code on your Android device." -ForegroundColor Cyan
Write-Host "  Backend API : $apiUrl" -ForegroundColor DarkGray
Write-Host ""
npx.cmd expo start --clear
