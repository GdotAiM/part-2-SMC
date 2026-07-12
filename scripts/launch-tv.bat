@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM Launch TradingView Desktop + CDP Proxy for Docker integration
REM ─────────────────────────────────────────────────────────────────────────────
REM This script:
REM   1. Kills any existing TradingView process and CDP proxy
REM   2. Launches TradingView Desktop with --remote-debugging-port=9222
REM   3. Launches the CDP proxy (scripts/cdp-proxy.mjs) on port 29222
REM   4. Prints the LAN IP for docker-compose extra_hosts
REM
REM Prerequisites:
REM   - Node.js 22+ in PATH
REM   - TradingView Desktop installed
REM
REM Usage:
REM   scripts\launch-tv.bat
REM   scripts\launch-tv.bat --proxy-only    (skip TV launch, just start proxy)
REM ─────────────────────────────────────────────────────────────────────────────

setlocal enabledelayedexpansion

set PROXY_PORT=29222
set TV_CDP_PORT=9222

REM ── Find repo root (two levels up from scripts/) ────────────────────────────
set REPO_ROOT=%~dp0..
pushd "%REPO_ROOT%" 2>nul || (
  echo [ERROR] Cannot find repo root at %REPO_ROOT%
  exit /b 1
)

echo ╔══════════════════════════════════════════════════╗
echo ║     SMC Pulse Predict — TV Launch Tool          ║
echo ╚══════════════════════════════════════════════════╝
echo.

REM ── Step 1: Kill existing processes ─────────────────────────────────────────
echo [1/4] Stopping existing processes...

taskkill /F /IM TradingView.exe 2>nul && echo   - TradingView.exe stopped || echo   - No running TradingView.exe found
taskkill /F /IM node.exe /FI "WINDOWTITLE eq cdp-proxy" 2>nul
for /f "tokens=2" %%p in ('tasklist /FI "IMAGENAME eq node.exe" /NH /FO CSV 2^>nul ^| findstr /i cdp-proxy') do (
  taskkill /F /PID %%p 2>nul
)
echo   - CDP proxy processes cleaned

REM ── Step 1b: Detect proxy-only mode ─────────────────────────────────────────
set PROXY_ONLY=0
if "%1"=="--proxy-only" set PROXY_ONLY=1

REM ── Step 2: Launch TradingView (unless --proxy-only) ────────────────────────
if "%PROXY_ONLY%"=="0" (
  echo [2/4] Starting TradingView Desktop...

  REM Try multiple install paths
  set TV_EXE=
  if exist "%LOCALAPPDATA%\TradingView\TradingView.exe" set TV_EXE=%LOCALAPPDATA%\TradingView\TradingView.exe
  if exist "%PROGRAMFILES%\TradingView\TradingView.exe" set TV_EXE=%PROGRAMFILES%\TradingView\TradingView.exe
  if exist "%PROGRAMFILES(X86)%\TradingView\TradingView.exe" set TV_EXE=%PROGRAMFILES(X86)%\TradingView\TradingView.exe

  if defined TV_EXE (
    echo   - Found: !TV_EXE!
    start "TradingView" "!TV_EXE!" --remote-debugging-port=%TV_CDP_PORT%
    echo   - Launched with CDP port %TV_CDP_PORT%
  ) else (
    echo   [WARN] TradingView Desktop not found at expected paths.
    echo   Install from https://www.tradingview.com/desktop/
    echo   Or launch manually with: --remote-debugging-port=%TV_CDP_PORT%
  )
) else (
  echo [2/4] Skipping TradingView launch (--proxy-only)
)

REM ── Step 3: Wait for TV to bind CDP port (up to 30s) ───────────────────────
echo [3/4] Waiting for CDP port %TV_CDP_PORT%...
set WAIT_COUNT=0
:wait_loop
timeout /t 2 /nobreak >nul
set /a WAIT_COUNT+=1
node scripts\cdp-proxy.mjs --check >nul 2>&1
if !errorlevel! equ 0 goto cdp_ready
if !WAIT_COUNT! lss 15 goto wait_loop

echo   [WARN] CDP port not reachable after 30s. Proxy will retry connections.
goto start_proxy

:cdp_ready
echo   - CDP port %TV_CDP_PORT% is ready after !WAIT_COUNT!x2s

REM ── Step 4: Launch CDP proxy ────────────────────────────────────────────────
:start_proxy
echo [4/4] Starting CDP proxy on port %PROXY_PORT%...
start "cdp-proxy" cmd /c "node scripts\cdp-proxy.mjs %PROXY_PORT% %TV_CDP_PORT%"

REM Give it a moment
timeout /t 1 /nobreak >nul

echo.
echo ────────────────────────────────────────────────────────────
echo  All set!
echo.
echo  For Docker Compose, set these in your .env or docker-compose.yml:
echo    TV_ENABLED=true
echo    TV_CDP_PORT=%PROXY_PORT%
echo    TV_CONNECTION_TYPE=desktop
echo.
for /f "tokens=*" %%i in ('node scripts\cdp-proxy.mjs --ip 2^>nul') do (
  echo  extra_hosts: host.docker.internal:%%i
)
echo.
echo  Close this window or press Ctrl+C to stop everything.
echo ────────────────────────────────────────────────────────────

REM Keep the window open
popd
endlocal
