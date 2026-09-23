@echo off
title Create MKS Billing Desktop Shortcut
color 0a
echo =================================================================
echo        Creating Desktop Shortcut for MKS Billing Software
echo =================================================================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0create_shortcut.ps1"

echo.
pause
