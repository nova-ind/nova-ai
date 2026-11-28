$ErrorActionPreference = 'Stop'

$installerDir = $PSScriptRoot
$rootDir = Split-Path -Parent $installerDir
$toolsDir = Join-Path $installerDir 'tools'
$assetsDir = Join-Path $installerDir 'assets'
$srcDir = Join-Path $installerDir 'src'
$packagesDir = Join-Path $installerDir 'packages'
$sdkDir = Join-Path $packagesDir 'sdk'
$stagingDir = Join-Path $installerDir 'staging'
$distDir = Join-Path $rootDir 'dist'

$sdkUrl = 'https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.4370.26'
$sdkNupkg = Join-Path $packagesDir 'Microsoft.Web.WebView2.1.0.4370.26.nupkg'
$sdkZip = Join-Path $packagesDir 'Microsoft.Web.WebView2.1.0.4370.26.zip'
$webviewRuntimeUrl = 'https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/22ced09c-d6bd-4427-a658-f1dc48f3a440/MicrosoftEdgeWebView2RuntimeInstallerX64.exe'
$webviewRuntimeHash = '82b2d8a7013e0c0ea15d48ff4742ee3778ba16bd8b7b4a47876645b3e48d4016'
$webviewRuntime = Join-Path $packagesDir 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'

$ffmpegUrl = 'https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/download/autobuild-2026-11-24-12-41/ffmpeg-n9.0.2-963-g4d831360c9-win64-lgpl-9.0.zip'
$ffmpegHash = '4eac755f025785c71ae3fc3fe7b531d59bc058de8f3173917f043f7f31e4aa97'
$ffmpegZip = Join-Path $packagesDir 'ffmpeg-pinned-win64-lgpl.zip'
$ffmpegDir = Join-Path $packagesDir 'ffmpeg'
$ffmpegExe = Join-Path $ffmpegDir 'ffmpeg.exe'
$ffprobeExe = Join-Path $ffmpegDir 'ffprobe.exe'
$ffmpegLicense = Join-Path $ffmpegDir 'FFMPEG_LICENSE.txt'

$csc = @(
  'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe',
  'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $csc) {
  throw 'C# compiler (csc.exe) was not found on this PC.'
}

$nodeExe = (Get-Command node -ErrorAction Stop).Source
$nodeDir = Split-Path -Parent $nodeExe
$nodeLicense = Join-Path $nodeDir 'LICENSE'

New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null
New-Item -ItemType Directory -Path $packagesDir -Force | Out-Null
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

Write-Host '[1/6] Generating same-logo PNG + ICO assets...'
$iconGeneratorSource = Join-Path $toolsDir 'make-icons.cs'
$iconGeneratorExe = Join-Path $toolsDir 'make-icons.exe'
& $csc /nologo /target:exe "/out:$iconGeneratorExe" $iconGeneratorSource /r:System.Drawing.dll
if ($LASTEXITCODE -ne 0) { throw 'Logo generator compilation failed.' }
& $iconGeneratorExe $assetsDir
if ($LASTEXITCODE -ne 0) { throw 'Logo generation failed.' }

Write-Host '[2/6] Preparing WebView2 SDK, offline runtime and FFmpeg...'
if (-not (Test-Path $sdkNupkg)) {
  Invoke-WebRequest -Uri $sdkUrl -OutFile $sdkNupkg -UseBasicParsing -TimeoutSec 600
}
$wv2Core = Join-Path $sdkDir 'lib\net462\Microsoft.Web.WebView2.Core.dll'
$wv2WinForms = Join-Path $sdkDir 'lib\net462\Microsoft.Web.WebView2.WinForms.dll'
if (-not (Test-Path $wv2Core) -or -not (Test-Path $wv2WinForms)) {
  Copy-Item $sdkNupkg $sdkZip -Force
  if (Test-Path $sdkDir) { Remove-Item $sdkDir -Recurse -Force }
  Expand-Archive -Path $sdkZip -DestinationPath $sdkDir -Force
}
$wv2Loader = Join-Path $sdkDir 'runtimes\win-x64\native\WebView2Loader.dll'
if (-not (Test-Path $wv2Core) -or -not (Test-Path $wv2WinForms) -or -not (Test-Path $wv2Loader)) {
  throw 'WebView2 SDK files were not extracted correctly.'
}

if (-not (Test-Path $webviewRuntime)) {
  Invoke-WebRequest -Uri $webviewRuntimeUrl -OutFile $webviewRuntime -UseBasicParsing -TimeoutSec 900
}
$actualHash = (Get-FileHash $webviewRuntime -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $webviewRuntimeHash) {
  throw "WebView2 runtime hash mismatch: $actualHash"
}

if (-not (Test-Path $ffmpegZip)) {
  Invoke-WebRequest -Uri $ffmpegUrl -OutFile $ffmpegZip -UseBasicParsing -TimeoutSec 1200
}
$ffmpegActualHash = (Get-FileHash $ffmpegZip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($ffmpegActualHash -ne $ffmpegHash) {
  throw "FFmpeg hash mismatch: $ffmpegActualHash"
}
if (-not (Test-Path $ffmpegExe) -or -not (Test-Path $ffprobeExe)) {
  $ffmpegExtract = Join-Path $packagesDir 'ffmpeg-extract'
  if (Test-Path $ffmpegExtract) { Remove-Item $ffmpegExtract -Recurse -Force }
  Expand-Archive -Path $ffmpegZip -DestinationPath $ffmpegExtract -Force
  $foundFfmpeg = Get-ChildItem $ffmpegExtract -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1
  $foundFfprobe = Get-ChildItem $ffmpegExtract -Recurse -Filter 'ffprobe.exe' | Select-Object -First 1
  $foundLicense = Get-ChildItem $ffmpegExtract -Recurse -Filter 'LICENSE*' | Select-Object -First 1
  if (-not $foundFfmpeg -or -not $foundFfprobe) {
    throw 'FFmpeg/ffprobe were not found in the downloaded archive.'
  }
  New-Item -ItemType Directory -Path $ffmpegDir -Force | Out-Null
  Copy-Item $foundFfmpeg.FullName $ffmpegExe -Force
  Copy-Item $foundFfprobe.FullName $ffprobeExe -Force
  if ($foundLicense) { Copy-Item $foundLicense.FullName $ffmpegLicense -Force }
}

Write-Host '[3/6] Staging Nova app files...'
if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null
Copy-Item (Join-Path $rootDir 'server.js') (Join-Path $stagingDir 'server.js') -Force
Copy-Item (Join-Path $rootDir 'public') (Join-Path $stagingDir 'public') -Recurse -Force
Copy-Item (Join-Path $assetsDir 'nova.ico') (Join-Path $stagingDir 'nova.ico') -Force
Copy-Item (Join-Path $installerDir 'README.txt') (Join-Path $stagingDir 'README.txt') -Force
Copy-Item $wv2Core (Join-Path $stagingDir 'Microsoft.Web.WebView2.Core.dll') -Force
Copy-Item $wv2WinForms (Join-Path $stagingDir 'Microsoft.Web.WebView2.WinForms.dll') -Force
Copy-Item $wv2Loader (Join-Path $stagingDir 'WebView2Loader.dll') -Force

New-Item -ItemType Directory -Path (Join-Path $stagingDir 'runtime') -Force | Out-Null
Copy-Item $nodeExe (Join-Path $stagingDir 'runtime\node.exe') -Force
Copy-Item $webviewRuntime (Join-Path $stagingDir 'runtime\MicrosoftEdgeWebView2RuntimeInstallerX64.exe') -Force
if (Test-Path $nodeLicense) {
  Copy-Item $nodeLicense (Join-Path $stagingDir 'runtime\NODE_LICENSE.txt') -Force
}
Copy-Item $ffmpegExe (Join-Path $stagingDir 'runtime\ffmpeg.exe') -Force
Copy-Item $ffprobeExe (Join-Path $stagingDir 'runtime\ffprobe.exe') -Force
if (Test-Path $ffmpegLicense) {
  Copy-Item $ffmpegLicense (Join-Path $stagingDir 'runtime\FFMPEG_LICENSE.txt') -Force
}

Write-Host '[4/6] Compiling Nova desktop launcher...'
$launcherExe = Join-Path $stagingDir 'Nova.exe'
$launcherIcon = Join-Path $assetsDir 'nova.ico'
$launcherLogo = (Join-Path $assetsDir 'nova-64.png') + ',NovaLogo.png'
$launcherSource = Join-Path $srcDir 'NovaLauncher.cs'
& $csc /nologo /target:winexe "/out:$launcherExe" "/win32icon:$launcherIcon" "/resource:$launcherLogo" $launcherSource /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Management.dll "/r:$wv2Core" "/r:$wv2WinForms"
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }

Write-Host '[5/6] Building professional Windows installer...'
$iscc = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'),
  (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 7\ISCC.exe'),
  'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
  'C:\Program Files\Inno Setup 6\ISCC.exe',
  'C:\Program Files (x86)\Inno Setup 7\ISCC.exe',
  'C:\Program Files\Inno Setup 7\ISCC.exe'
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not $iscc) {
  throw 'Inno Setup compiler (ISCC.exe) was not found.'
}

& $iscc (Join-Path $installerDir 'Nova.iss')
if ($LASTEXITCODE -ne 0) { throw 'Installer build failed.' }

Write-Host '[6/6] Done.'
Get-ChildItem $distDir -Filter 'Nova-AI-Setup*.exe' | ForEach-Object {
  Write-Host ('Installer: ' + $_.FullName + ' (' + [math]::Round($_.Length / 1MB, 1) + ' MB)')
}
