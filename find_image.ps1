Get-ChildItem -Path "C:\Users\BHANWAR\.gemini\antigravity-ide" -Recurse -Include *.png,*.jpg,*.jpeg,*.webp -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 10 |
    Format-Table FullName, LastWriteTime
