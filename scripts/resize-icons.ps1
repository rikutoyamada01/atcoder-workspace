Add-Type -AssemblyName System.Drawing

function Resize-Image {
    param (
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Width,
        [int]$Height
    )
    $img = [System.Drawing.Image]::FromFile($InputPath)
    $bmp = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $Width, $Height)
    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $img.Dispose()
}

$srcDir = "c:\Users\yamadarikuto\Mycode\atcoder-workspace\src\icons"
if (-not (Test-Path $srcDir)) { 
    New-Item -ItemType Directory -Path $srcDir | Out-Null
}

$masterPath = "C:\Users\yamadarikuto\.gemini\antigravity\brain\0a341067-a9ad-4112-b7e5-be804ffb53d1\master_icon_1781083761725.png"

Resize-Image $masterPath "$srcDir\icon16.png" 16 16
Resize-Image $masterPath "$srcDir\icon48.png" 48 48
Resize-Image $masterPath "$srcDir\icon128.png" 128 128

Write-Host "Icons resized and saved to $srcDir"
