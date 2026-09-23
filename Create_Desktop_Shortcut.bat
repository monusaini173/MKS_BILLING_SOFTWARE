@echo off
title Create MKS Billing Desktop Shortcut
color 0a
echo =================================================================
echo        Creating Desktop Shortcut for MKS Billing Software
echo =================================================================
echo.

powershell -ExecutionPolicy Bypass -Command ^
  "$desktop = [Environment]::GetFolderPath('Desktop');" ^
  "$targetDir = (Get-Item -Path '%~dp0').FullName;" ^
  "$vbsPath = Join-Path $targetDir 'MKS_Billing_Software.vbs';" ^
  "$shortcutPath = Join-Path $desktop 'MKS Billing Software.lnk';" ^
  "$wsh = New-Object -ComObject WScript.Shell;" ^
  "$sc = $wsh.CreateShortcut($shortcutPath);" ^
  "$sc.TargetPath = $vbsPath;" ^
  "$sc.WorkingDirectory = $targetDir;" ^
  "$sc.Description = 'MKS Billing Software - 1-Click Desktop POS';" ^
  "$sc.Save();" ^
  "Write-Host '[SUCCESS] Desktop Icon created at: ' $shortcutPath -ForegroundColor Green;"

echo.
pause
