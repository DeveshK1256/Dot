Add-Type -AssemblyName System.Drawing

function Audit-TemplateImage {
    param (
        [string]$filePath
    )

    Write-Host "Auditing $filePath..."
    $bmp = [System.Drawing.Bitmap]::FromFile($filePath)
    $w = $bmp.Width
    $h = $bmp.Height

    $nonBlackPixels = 0
    $totalNonTransparent = 0

    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $p = $bmp.GetPixel($x, $y)
            if ($p.A -gt 0) {
                $totalNonTransparent++
                if ($p.R -ne 0 -or $p.G -ne 0 -or $p.B -ne 0) {
                    $nonBlackPixels++
                    if ($nonBlackPixels -le 5) {
                        Write-Host "  Color bleed at ($x,$y): R=$($p.R) G=$($p.G) B=$($p.B) A=$($p.A)"
                    }
                }
            }
        }
    }
    $bmp.Dispose()

    Write-Host "  Total non-transparent pixels: $totalNonTransparent"
    Write-Host "  Non-black (colored) pixels: $nonBlackPixels"
    if ($nonBlackPixels -eq 0) {
        Write-Host "  [RESULT]: 100% PURE BLACK + ALPHA ONLY (macOS Template Compliant)`n" -ForegroundColor Green
    } else {
        Write-Host "  [RESULT]: COLOR BLEED DETECTED`n" -ForegroundColor Red
    }
    return ($nonBlackPixels -eq 0)
}

$ok1 = Audit-TemplateImage -filePath "D:\Dot\dot-app\assets\icons\tray\tray-Template.png"
$ok2 = Audit-TemplateImage -filePath "D:\Dot\dot-app\assets\icons\tray\tray-Template@2x.png"

if ($ok1 -and $ok2) {
    exit 0
} else {
    exit 1
}
