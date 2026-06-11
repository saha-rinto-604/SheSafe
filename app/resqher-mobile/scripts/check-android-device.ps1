param()

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
$localPropertiesPath = Join-Path $projectRoot "android\local.properties"

function Add-Candidate {
  param(
    [string]$Label,
    [string]$Path
  )

  if (-not [string]::IsNullOrWhiteSpace($Path)) {
    [pscustomobject]@{
      Label = $Label
      Path = $Path
    }
  }
}

function Get-LocalSdkPath {
  if (-not (Test-Path -LiteralPath $localPropertiesPath)) {
    return $null
  }

  $sdkLine = Get-Content -LiteralPath $localPropertiesPath |
    Where-Object { $_ -match "^\s*sdk\.dir\s*=" } |
    Select-Object -First 1

  if (-not $sdkLine) {
    return $null
  }

  $sdkPath = ($sdkLine -split "=", 2)[1].Trim()
  return $sdkPath -replace "\\\\", "\"
}

$localAppDataSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$localPropertiesSdk = Get-LocalSdkPath

$candidates = @()
$sdkCandidates = @(
  (Add-Candidate "android/local.properties" $localPropertiesSdk),
  (Add-Candidate "ANDROID_HOME" $env:ANDROID_HOME),
  (Add-Candidate "ANDROID_SDK_ROOT" $env:ANDROID_SDK_ROOT),
  (Add-Candidate "LOCALAPPDATA" $localAppDataSdk)
) | Where-Object { $_ }

$pathAdb = Get-Command adb.exe -ErrorAction SilentlyContinue
if ($pathAdb) {
  $candidates = @(
    [pscustomobject]@{
      Label = "PATH"
      Path = $pathAdb.Source
    }
  ) + $candidates
}

$sdkCandidates | ForEach-Object {
  $candidate = Add-Candidate $_.Label (Join-Path $_.Path "platform-tools\adb.exe")
  if ($candidate) { $candidates += $candidate }
}

$adb = $candidates | Where-Object { Test-Path $_.Path } | Select-Object -First 1
$manualPathEntry = Join-Path $localAppDataSdk "platform-tools"

Write-Host "Android device check"
Write-Host "--------------------"
Write-Host "SDK folder: $(if (Test-Path -LiteralPath $localAppDataSdk) { 'found' } else { 'missing' })"
Write-Host "android/local.properties: $(if (Test-Path -LiteralPath $localPropertiesPath) { 'found' } else { 'missing' })"

if (-not (Test-Path -LiteralPath $localPropertiesPath)) {
  Write-Host "Create android/local.properties with:"
  Write-Host "  sdk.dir=$($localAppDataSdk -replace '\\', '/')"
  exit 2
}

if (-not $localPropertiesSdk) {
  Write-Host "android/local.properties does not contain an sdk.dir entry."
  exit 2
}

if (-not (Test-Path -LiteralPath $localPropertiesSdk)) {
  Write-Host "sdk.dir points to a missing Android SDK folder:"
  Write-Host "  $localPropertiesSdk"
  exit 2
}

Write-Host "sdk.dir: valid"

if (-not $adb) {
  Write-Host "ADB not found."
  Write-Host ""
  Write-Host "Install Android SDK Platform-Tools, then add this PATH entry manually:"
  Write-Host "  $manualPathEntry"
  Write-Host ""
  Write-Host "Then restart PowerShell and run:"
  Write-Host "  adb devices"
  Write-Host "  npm run android:check"
  exit 2
}

$adbDir = Split-Path $adb.Path -Parent
$pathContainsAdbDir = ($env:Path -split ';') -contains $adbDir

Write-Host "ADB found: $($adb.Path)"
if (-not $pathContainsAdbDir) {
  Write-Host "ADB is available by full path, but this folder is not on PATH:"
  Write-Host "  $adbDir"
  Write-Host "Add this PATH entry manually for normal 'adb' commands:"
  Write-Host "  $manualPathEntry"
}

Write-Host ""
Write-Host "Running adb devices..."
$adbOutput = & $adb.Path devices 2>&1
$adbOutput | ForEach-Object { Write-Host $_ }

$deviceLines = @($adbOutput | Where-Object { $_ -match "\t" })
$connected = @($deviceLines | Where-Object { $_ -match "\sdevice(\s|$)" })
$unauthorized = @($deviceLines | Where-Object { $_ -match "\sunauthorized(\s|$)" })
$offline = @($deviceLines | Where-Object { $_ -match "\soffline(\s|$)" })

Write-Host ""
Write-Host "Device states: device=$($connected.Count), unauthorized=$($unauthorized.Count), offline=$($offline.Count)"

if ($connected.Count -gt 0) {
  Write-Host "At least one Android device/emulator is authorized."
  if ($unauthorized.Count -gt 0 -or $offline.Count -gt 0) {
    Write-Host "When Expo prompts, select only a target with status 'device'."
  }
  Write-Host "Next command:"
  Write-Host "  npx.cmd expo run:android --device"
  exit 0
}

if ($unauthorized.Count -gt 0) {
  Write-Host "Device detected but unauthorized."
  Write-Host "Unlock the phone and accept the 'Allow USB debugging?' prompt."
  Write-Host "If no prompt appears, revoke USB debugging authorizations and reconnect."
  exit 1
}

if ($offline.Count -gt 0) {
  Write-Host "Device detected but offline."
  Write-Host "Restart the adb server, reconnect USB, keep the phone unlocked, and run adb devices again."
  exit 1
}

Write-Host "No Android device/emulator detected."
Write-Host ""
Write-Host "Physical phone checklist:"
Write-Host "  1. Enable Developer options."
Write-Host "  2. Enable USB debugging."
Write-Host "  3. Connect the phone by USB."
Write-Host "  4. Select File Transfer / MTP."
Write-Host "  5. Accept the 'Allow USB debugging?' popup."
Write-Host "  6. If the device shows unauthorized, unlock the phone and accept the popup."
Write-Host "  7. If no popup appears, revoke USB debugging authorizations and reconnect."
Write-Host "  8. Try another cable or USB port if needed."
Write-Host ""
Write-Host "Emulator checklist:"
Write-Host "  1. Open Android Studio > Device Manager."
Write-Host "  2. Create or start an Android emulator."
Write-Host "  3. Run npm run android:check again."
exit 1
