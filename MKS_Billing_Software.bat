@echo off
title MKS Billing Software Launcher
color 0b
echo =================================================================
echo        MKS BILLING SOFTWARE - 1-CLICK DESKTOP LAUNCHER
echo                 by MKS IT Solution
echo =================================================================
echo.

cd /d "%~dp0"

:: Check if Server is already running on Port 5000
netstat -ano | findstr /R /C:":5000 .*LISTENING" >nul
if %errorlevel% equ 0 (
    echo [OK] Backend Server is already running on Port 5000.
) else (
    echo [1/3] Starting Backend Server (Port 5000)...
    start "MKS Server" /min cmd /c "cd server && npm start"
)

:: Check if Frontend is already running on Port 4200
netstat -ano | findstr /R /C:":4200 .*LISTENING" >nul
if %errorlevel% equ 0 (
    echo [OK] Frontend POS is already running on Port 4200.
) else (
    echo [2/3] Starting Frontend POS Application (Port 4200)...
    start "MKS Frontend" /min cmd /c "cd frontend && npm start"
    echo Waiting for application to initialize...
    timeout /t 5 /nobreak >nul
)

echo.
echo [3/3] Opening MKS Billing Desktop Software Window...

:: Launch dedicated standalone app window
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:4200/billing --window-size=1366,768 --start-maximized
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:4200/billing --window-size=1366,768 --start-maximized
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:4200/billing --window-size=1366,768 --start-maximized
) else (
    start http://localhost:4200/billing
)

echo.
echo =================================================================
echo  MKS Billing Software is ready and open!
echo =================================================================
exit
