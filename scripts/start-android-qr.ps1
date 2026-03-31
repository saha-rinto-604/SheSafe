param(
  [int]$BackendPort = 4000,
  [int]$MetroPort = 8081
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
$mobileDir = Join-Path $repoRoot "app/resqher-mobile"
$backendDir = Join-Path $repoRoot "backend"
$mobileEnvPath = Join-Path $mobileDir ".env"

function Stop-PortProcess {
  param([int]$Port)

  try {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) {
      Write-Host "Port $Port is free."
      return
    }

    $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $processIds) {
      if ($procId -and $procId -ne $PID) {
        Write-Host "Stopping process $procId on port $Port..."
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {
    Write-Warning "Could not clean port ${Port}: $($_.Exception.Message)"
  }
}

function Get-LanIp {
  try {
    $cfg = Get-NetIPConfiguration |
      Where-Object { $_.NetAdapter.Status -eq 'Up' -and $_.IPv4DefaultGateway -ne $null } |
      Select-Object -First 1

    if ($cfg -and $cfg.IPv4Address -and $cfg.IPv4Address.IPAddress) {
      return $cfg.IPv4Address.IPAddress
    }
  } catch {
  }

  return '127.0.0.1'
}

function Clear-MobileCache {
  param([string]$MobilePath)

  $targets = @(
    (Join-Path $MobilePath '.expo'),
    (Join-Path $MobilePath 'node_modules/.cache')
  )

  foreach ($target in $targets) {
    if (Test-Path $target) {
      Write-Host "Removing $target"
      Remove-Item $target -Recurse -Force -ErrorAction SilentlyContinue
    }
  }

  if ($env:TEMP) {
    $patterns = @('metro-*', 'haste-map-*', 'react-native-packager-cache-*')
    foreach ($pattern in $patterns) {
      Get-ChildItem -Path $env:TEMP -Filter $pattern -ErrorAction SilentlyContinue |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

function Update-ExpoApiEnv {
  param(
    [string]$EnvPath,
    [string]$ApiUrl
  )

  $line = "EXPO_PUBLIC_API_URL=$ApiUrl"

  if (-not (Test-Path $EnvPath)) {
    Set-Content -Path $EnvPath -Value $line -Encoding UTF8
    Write-Host "Created .env with API URL: $ApiUrl"
    return
  }

  $raw = Get-Content -Path $EnvPath -Raw
  if ($raw -match '(?m)^EXPO_PUBLIC_API_URL=.*$') {
    $updated = [regex]::Replace($raw, '(?m)^EXPO_PUBLIC_API_URL=.*$', $line)
  } else {
    $updated = ($raw.TrimEnd() + "`r`n" + $line + "`r`n")
  }

  Set-Content -Path $EnvPath -Value $updated -Encoding UTF8
  Write-Host "Updated EXPO_PUBLIC_API_URL to $ApiUrl"
}

function Wait-ForBackend {
  param(
    [string]$HealthUrl,
    [int]$TimeoutSeconds = 25
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $res = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
      if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 300) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 700
    }
  }

  return $false
}

Write-Host "=== ResQher Android QR Launcher ===" -ForegroundColor Cyan
Write-Host "Repository: $repoRoot"

Stop-PortProcess -Port $BackendPort
Stop-PortProcess -Port $MetroPort
Clear-MobileCache -MobilePath $mobileDir

$lanIp = Get-LanIp
$apiUrl = "http://${lanIp}:$BackendPort"
Update-ExpoApiEnv -EnvPath $mobileEnvPath -ApiUrl $apiUrl

Write-Host "Starting backend in a new terminal..."
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-ExecutionPolicy', 'Bypass',
  '-Command', "Set-Location '$backendDir'; npm run dev"
) | Out-Null

$healthUrl = "$apiUrl/api/health"
if (Wait-ForBackend -HealthUrl $healthUrl) {
  Write-Host "Backend is reachable at $healthUrl" -ForegroundColor Green
} else {
  Write-Warning "Backend health check did not pass yet. Expo will still start."
}

Write-Host "Starting Expo (QR in this terminal)..." -ForegroundColor Yellow
Set-Location $mobileDir
npx expo start --tunnel --clear
