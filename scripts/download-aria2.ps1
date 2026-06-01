# Download aria2c for Tauri sidecar (Windows x86_64)
# Run from the repo root: .\scripts\download-aria2.ps1

$ErrorActionPreference = "Stop"

$TargetDir = "$PSScriptRoot\..\src-tauri\binaries"
$TargetName = "aria2c-x86_64-pc-windows-msvc.exe"
$TargetPath = Join-Path $TargetDir $TargetName

if (Test-Path $TargetPath) {
    Write-Host "aria2c already exists at $TargetPath" -ForegroundColor Green
    exit 0
}

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

# Get latest release from GitHub
Write-Host "Fetching latest aria2 release info..." -ForegroundColor Cyan
$Release = Invoke-RestMethod "https://api.github.com/repos/aria2/aria2/releases/latest"
$Asset = $Release.assets | Where-Object { $_.name -match "win-64.*zip$" } | Select-Object -First 1

if (-not $Asset) {
    Write-Error "Could not find aria2 Windows 64-bit release asset"
}

$ZipUrl  = $Asset.browser_download_url
$ZipName = $Asset.name
$TmpZip  = Join-Path $env:TEMP $ZipName
$TmpDir  = Join-Path $env:TEMP "aria2-extract"

Write-Host "Downloading $ZipName..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $ZipUrl -OutFile $TmpZip -UseBasicParsing

Write-Host "Extracting..." -ForegroundColor Cyan
Remove-Item $TmpDir -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $TmpZip -DestinationPath $TmpDir

$Exe = Get-ChildItem -Path $TmpDir -Recurse -Filter "aria2c.exe" | Select-Object -First 1
if (-not $Exe) { Write-Error "aria2c.exe not found in archive" }

Copy-Item $Exe.FullName -Destination $TargetPath
Remove-Item $TmpZip -Force
Remove-Item $TmpDir -Recurse -Force

Write-Host "Done: $TargetPath" -ForegroundColor Green
