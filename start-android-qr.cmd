@echo off
setlocal
set SCRIPT_DIR=%~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\start-android-qr.ps1"
if errorlevel 1 (
  echo.
  echo Launcher failed. Press any key to close...
  pause >nul
)
endlocal
