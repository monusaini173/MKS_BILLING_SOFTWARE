$desktop = [Environment]::GetFolderPath('Desktop')
$files = Get-ChildItem -Path $desktop -Filter "*MKS*.lnk"

foreach ($file in $files) {
    if ($file.Name -ne "MKS Admin Console.lnk" -and $file.Name -ne "MKS POS Billing Counter.lnk") {
        Remove-Item -Path $file.FullName -Force
        Write-Host "Removed old duplicate: $($file.Name)"
    } else {
        Write-Host "Kept clean shortcut: $($file.Name)"
    }
}
