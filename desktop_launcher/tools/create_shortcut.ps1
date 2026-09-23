$desktop = [Environment]::GetFolderPath('Desktop')
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$targetDir = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
$launchersDir = Join-Path $targetDir "desktop_launcher\launchers"
$icoPath = Join-Path $targetDir "desktop_launcher\assets\mks_logo.ico"

$wsh = New-Object -ComObject WScript.Shell

# 1. Admin & Platform Console Shortcut
$adminVbs = Join-Path $launchersDir "MKS_Billing_Software.vbs"
$adminShortcut = Join-Path $desktop "MKS Admin Console.lnk"
$sc1 = $wsh.CreateShortcut($adminShortcut)
$sc1.TargetPath = $adminVbs
$sc1.WorkingDirectory = $targetDir
$sc1.Description = "MKS Billing Software - Super Admin Platform Console"
if (Test-Path $icoPath) { $sc1.IconLocation = "$icoPath,0" }
$sc1.Save()

# 2. Dedicated POS Billing Counter Shortcut
$posVbs = Join-Path $launchersDir "MKS_POS_Billing_Counter.vbs"
$posShortcut = Join-Path $desktop "MKS POS Billing Counter.lnk"
$sc2 = $wsh.CreateShortcut($posShortcut)
$sc2.TargetPath = $posVbs
$sc2.WorkingDirectory = $targetDir
$sc2.Description = "MKS Billing Software - Fast POS Billing Counter"
if (Test-Path $icoPath) { $sc2.IconLocation = "$icoPath,0" }
$sc2.Save()

Write-Host "SUCCESS: Created clean Desktop shortcuts!"
Write-Host "  -> MKS Admin Console.lnk"
Write-Host "  -> MKS POS Billing Counter.lnk"

