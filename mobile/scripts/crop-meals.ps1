Add-Type -AssemblyName System.Drawing
$src = Get-ChildItem -LiteralPath "C:\Users\Thomas Lemor\Desktop\App Nutrisport\Design" -Filter "Planche*.png" | Select-Object -First 1
$out = "C:\Users\Thomas Lemor\Desktop\App Nutrisport\mobile\assets\images\meals"
New-Item -ItemType Directory -Force $out | Out-Null
$img = [System.Drawing.Bitmap]::FromFile($src.FullName)
$items = @(
  @{ n = 'breakfast'; x = 497; y = 488 },
  @{ n = 'lunch'; x = 497; y = 601 },
  @{ n = 'snack'; x = 497; y = 714 },
  @{ n = 'dinner'; x = 497; y = 833 },
  @{ n = 'evening'; x = 497; y = 952 }
)
$r = 41
$size = 160
foreach ($it in $items) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse(0, 0, $size, $size)
  $g.SetClip($path)
  $dest = New-Object System.Drawing.Rectangle 0, 0, $size, $size
  $g.DrawImage($img, $dest, ($it.x - $r), ($it.y - $r), (2 * $r), (2 * $r), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $bmp.Save((Join-Path $out ($it.n + '.png')), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
$img.Dispose()
"done"
