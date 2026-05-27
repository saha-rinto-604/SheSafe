param(
  [int]$BackendPort = 4000,
  [int]$MetroPort   = 8081,
  [switch]$SkipMigrations
)

$ErrorActionPreference = 'Stop'

$UseNgrok = $true
$PublicApiUrl = "https://citric-scuba-duh.ngrok-free.dev"
$UseExpoTunnel = $true
$StartBackend = $true

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
    # Use ipconfig instead of Get-NetIPConfiguration (which can hang on some Windows configs)
    $output = ipconfig 2>$null
    $loopback = [System.Net.IPAddress]::Loopback.ToString()
    $ip = $output | Select-String 'IPv4 Address' | ForEach-Object {
      if ($_ -match ':\s*(\d+\.\d+\.\d+\.\d+)') { $matches[1] }
    } | Where-Object { $_ -ne $loopback } | Select-Object -First 1
    if ($ip) { return $ip }
  } catch {}
  throw "Could not detect a LAN IPv4 address. Use NGROK mode or connect this machine to the same Wi-Fi as the phone."
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

function Normalize-ApiUrl {
  param([string]$ApiUrl)
  return $ApiUrl.Trim().TrimEnd('/')
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

function Write-HealthFailureHelp {
  param([string]$Mode, [string]$Url)
  Write-Warning "  Backend health check failed for $Mode mode: $Url"
  Write-Warning "  Check these common causes:"
  Write-Warning "    1. backend not running on port $BackendPort"
  Write-Warning "    2. ngrok terminal closed"
  Write-Warning "    3. ngrok URL changed"
  Write-Warning "    4. backend crashed"
}

# ===========================================================================
# MAIN
# ===========================================================================

Write-Host ""
Write-Host "=== SheSafe Android QR Launcher ===" -ForegroundColor Cyan
Write-Host "Repo: $repoRoot"
Write-Host ""

# 1. Free ports
Write-Host "[1/7] Preparing ports $BackendPort and $MetroPort..." -ForegroundColor Yellow
if ($StartBackend) {
  Stop-PortProcess -Port $BackendPort
} else {
  Write-Host "  Leaving backend port $BackendPort alone (StartBackend is false)."
}
Stop-PortProcess -Port $MetroPort

# 2. Clear Expo cache
Write-Host ""
Write-Host "[2/7] Clearing Expo/Metro cache..." -ForegroundColor Yellow
Clear-MobileCache -MobilePath $mobileDir

# 3. Select API mode and update .env
Write-Host ""
Write-Host "[3/7] Selecting API mode..." -ForegroundColor Yellow
if ($UseNgrok) {
  $apiMode = "NGROK"
  $apiUrl = Normalize-ApiUrl -ApiUrl $PublicApiUrl
  if (-not $apiUrl) {
    throw "PublicApiUrl is required when UseNgrok is true."
  }
  if (-not $apiUrl.StartsWith("https://")) {
    Write-Warning "  NGROK mode should use the forwarding HTTPS URL, for example https://example.ngrok-free.dev"
  }
} else {
  $apiMode = "LAN"
  $lanIp  = Get-LanIp
  $apiUrl = "http://" + $lanIp + ":" + $BackendPort
  Write-Host "  LAN IP : $lanIp"
}
Write-Host "  API Mode: $apiMode"
Write-Host "  API URL : $apiUrl"
$expoMode = if ($UseExpoTunnel) { "TUNNEL" } else { "LAN" }
Write-Host "  Expo Mode: $expoMode"
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
if ($StartBackend) {
  Write-Host "[5/7] Starting backend in a new terminal..." -ForegroundColor Yellow
  $backendCmd = "Write-Host 'SheSafe Backend - port $BackendPort' -ForegroundColor Cyan; Set-Location '" + $backendDir + "'; npm run dev"
  Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $backendCmd
} else {
  Write-Host "[5/7] Using already-running backend on port $BackendPort." -ForegroundColor Yellow
}

# 6. Wait for backend health
$healthUrl = $apiUrl + "/api/health"
Write-Host "  Waiting for $healthUrl ..."
if (Wait-ForBackend -Url $healthUrl -Timeout 30) {
  Write-Host "  Backend is up." -ForegroundColor Green
} else {
  Write-HealthFailureHelp -Mode $apiMode -Url $healthUrl
}

# 7. Fix Expo packages then start
Write-Host ""
Write-Host "[6/7] Fixing Expo package versions..." -ForegroundColor Yellow
Set-Location $mobileDir
npx expo install --fix

Write-Host ""
Write-Host "[7/7] Starting Expo - scan the QR code on your Android device." -ForegroundColor Cyan
Write-Host "  Backend API : $apiUrl" -ForegroundColor DarkGray
Write-Host "  Expo Mode   : $expoMode" -ForegroundColor DarkGray
Write-Host ""
if ($UseExpoTunnel) {
  npx expo start --tunnel --clear
} else {
  npx expo start --clear
}
