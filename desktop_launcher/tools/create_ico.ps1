Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectDir = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
$pngPath = Join-Path $projectDir "frontend\public\assets\images\mks_billing_logo.png"
$icoPath = Join-Path $projectDir "desktop_launcher\assets\mks_logo.ico"


# 1. Convert PNG to High-Resolution Windows Icon (.ico)
$img = [System.Drawing.Bitmap]::FromFile($pngPath)
$resized = New-Object System.Drawing.Bitmap($img, 256, 256)
$hIcon = $resized.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)

$fs = [System.IO.File]::OpenWrite($icoPath)
$icon.Save($fs)
$fs.Close()
$img.Dispose()
$resized.Dispose()

Write-Host "Generated icon file at: $icoPath"

# 2. Update Desktop Shortcuts to use the new official MKS logo icon
$desktop = [Environment]::GetFolderPath('Desktop')
$wsh = New-Object -ComObject WScript.Shell

# Update POS Shortcut
$posShortcutPath = Join-Path $desktop "MKS POS Billing Counter.lnk"
if (Test-Path $posShortcutPath) {
    $sc = $wsh.CreateShortcut($posShortcutPath)
    $sc.IconLocation = "$icoPath,0"
    $sc.Save()
    Write-Host "Updated icon for: MKS POS Billing Counter.lnk"
}

# Update Admin Shortcut
$adminShortcutPath = Join-Path $desktop "MKS Admin Console.lnk"
if (Test-Path $adminShortcutPath) {
    $sc = $wsh.CreateShortcut($adminShortcutPath)
    $sc.IconLocation = "$icoPath,0"
    $sc.Save()
    Write-Host "Updated icon for: MKS Admin Console.lnk"
}

# 3. Refresh Windows Shell Icon Cache
$code = @'
[System.Runtime.InteropServices.DllImport("shell32.dll")]
public static extern void SHChangeNotify(int wEventId, int uFlags, System.IntPtr dwItem1, System.IntPtr dwItem2);
'@
$type = Add-Type -MemberDefinition $code -Name ShellIcons -Namespace WinAPI -PassThru
$type::SHChangeNotify(0x08000000, 0, [System.IntPtr]::Zero, [System.IntPtr]::Zero)

Write-Host "SUCCESS: Desktop Icons updated with official MKS logo!"
