Add-Type -AssemblyName System.Drawing

function Generate-CircleImage {
    param (
        [int]$size,
        [string]$bgColor, # "black" or "transparent"
        [string]$circleColor, # "white", "#3b82f6", or "black"
        [double]$circleRadiusRatio = 0.58, # radius / (size/2)
        [string]$outputPath
    )

    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($bgColor -eq "black") {
        $brushBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 17, 24, 39)) # Modern rich black/slate-900
        $g.FillRectangle($brushBg, 0, 0, $size, $size)
        $brushBg.Dispose()
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    $cColor = if ($circleColor -eq "white") {
        [System.Drawing.Color]::White
    } elseif ($circleColor -eq "black") {
        [System.Drawing.Color]::FromArgb(255, 0, 0, 0)
    } elseif ($circleColor -eq "blue") {
        [System.Drawing.Color]::FromArgb(255, 59, 130, 246) # #3b82f6 Dot Accent Blue
    } else {
        [System.Drawing.Color]::White
    }

    $brushCircle = New-Object System.Drawing.SolidBrush($cColor)
    $diameter = [float]($size * $circleRadiusRatio)
    $x = [float](($size - $diameter) / 2.0)
    $y = [float](($size - $diameter) / 2.0)

    $g.FillEllipse($brushCircle, $x, $y, $diameter, $diameter)

    $brushCircle.Dispose()
    $g.Dispose()

    $dir = [System.IO.Path]::GetDirectoryName($outputPath)
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created $outputPath ($size x $size)"
}

# 1. Master PNG (1024x1024) - App Icon Variant (Colored blue dot centered on solid dark background)
Generate-CircleImage -size 1024 -bgColor "black" -circleColor "blue" -circleRadiusRatio 0.58 -outputPath "d:\Dot\dot-app\assets\icons\master-app-icon.png"

# 2. Master Template PNG (1024x1024) - macOS Menu Bar Template (Solid black circle glyph + full transparent background)
Generate-CircleImage -size 1024 -bgColor "transparent" -circleColor "black" -circleRadiusRatio 0.65 -outputPath "d:\Dot\dot-app\assets\icons\master-tray-template.png"

# 3. Tray icons for Windows & Linux (16x16 and 32x32: White/Blue dot on black square)
Generate-CircleImage -size 16 -bgColor "black" -circleColor "white" -circleRadiusRatio 0.62 -outputPath "d:\Dot\dot-app\assets\icons\tray\tray-16.png"
Generate-CircleImage -size 32 -bgColor "black" -circleColor "white" -circleRadiusRatio 0.62 -outputPath "d:\Dot\dot-app\assets\icons\tray\tray-32.png"

# 4. macOS Tray Template Icons (Black glyph + transparent background, no color)
Generate-CircleImage -size 16 -bgColor "transparent" -circleColor "black" -circleRadiusRatio 0.65 -outputPath "d:\Dot\dot-app\assets\icons\tray\tray-Template.png"
Generate-CircleImage -size 32 -bgColor "transparent" -circleColor "black" -circleRadiusRatio 0.65 -outputPath "d:\Dot\dot-app\assets\icons\tray\tray-Template@2x.png"

# 5. Linux full icon set in assets/icons/app/png/ (16x16, 24x24, 32x32, 48x48, 64x64, 128x128, 256x256, 512x512)
$linuxSizes = @(16, 24, 32, 48, 64, 128, 256, 512)
foreach ($sz in $linuxSizes) {
    Generate-CircleImage -size $sz -bgColor "black" -circleColor "blue" -circleRadiusRatio 0.58 -outputPath "d:\Dot\dot-app\assets\icons\app\png\$($sz)x$($sz).png"
}
