$desktop = [Environment]::GetFolderPath('Desktop')
$targetDir = "C:\Users\BHANWAR\OneDrive\All baukap\OneDrive\Desktop\mks_billing_softwer"
$wsh = New-Object -ComObject WScript.Shell

# 1. Admin & Platform Console Shortcut
$adminVbs = Join-Path $targetDir "MKS_Billing_Software.vbs"
$adminShortcut = Join-Path $desktop "MKS Admin Console.lnk"
$sc1 = $wsh.CreateShortcut($adminShortcut)
$sc1.TargetPath = $adminVbs
$sc1.WorkingDirectory = $targetDir
$sc1.Description = "MKS Billing Software - Super Admin Platform Console"
$sc1.Save()

# 2. Dedicated POS Billing Counter Shortcut
$posVbs = Join-Path $targetDir "MKS_POS_Billing_Counter.vbs"
$posShortcut = Join-Path $desktop "MKS POS Billing Counter.lnk"
$sc2 = $wsh.CreateShortcut($posShortcut)
$sc2.TargetPath = $posVbs
$sc2.WorkingDirectory = $targetDir
$sc2.Description = "MKS Billing Software - Fast POS Billing Counter"
$sc2.Save()

Write-Host "SUCCESS: Created clean Desktop shortcuts!"
Write-Host "  -> MKS Admin Console.lnk"
Write-Host "  -> MKS POS Billing Counter.lnk"
