@echo off
title MKS POS Billing Counter
color 0a
echo =================================================================
echo        MKS POS BILLING COUNTER - DIRECT POS LAUNCHER
echo                     by MKS IT Solution
echo =================================================================
echo.

cd /d "%~dp0"

:: Check if Server is already running on Port 5000
netstat -ano | findstr /R /C:":5000 .*LISTENING" >nul
if %errorlevel% neq 0 (
    echo [1/2] Starting Backend Server...
    start "MKS Server" /min cmd /c "cd server && npm start"
)

:: Check if Frontend is already running on Port 4200
netstat -ano | findstr /R /C:":4200 .*LISTENING" >nul
if %errorlevel% neq 0 (
    echo [2/2] Starting POS Billing System...
    start "MKS Frontend" /min cmd /c "cd frontend && npm start"
    timeout /t 5 /nobreak >nul
)

echo.
echo Opening POS Billing Counter Window...

:: Launch dedicated standalone POS window directly to /billing
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:4200/billing --window-size=1366,768 --start-maximized
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:4200/billing --window-size=1366,768 --start-maximized
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:4200/billing --window-size=1366,768 --start-maximized
) else (
    start http://localhost:4200/billing
)

exit
