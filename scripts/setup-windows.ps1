# MikanBox - Windows 开发环境检测与自动修复脚本
# 运行方式（PowerShell，建议以管理员身份）：
#   Set-ExecutionPolicy Bypass -Scope Process -Force
#   .\scripts\setup-windows.ps1

# ─── 颜色辅助 ────────────────────────────────────────────────────────────────
function Write-OK      { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-FIXED   { param($msg) Write-Host " [FIX] $msg" -ForegroundColor Blue }
function Write-FAIL    { param($msg) Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-WARN    { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-INFO    { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Section { param($msg) Write-Host "`n=== $msg ===" -ForegroundColor Magenta }

$issues = @()

# ─── 编码设置 ─────────────────────────────────────────────────────────────────
# 强制 UTF-8，防止 winget 等外部程序输出乱码（PS 5.1 默认用 GBK 解码）
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding              = [System.Text.Encoding]::UTF8

# ─── 工具函数 ─────────────────────────────────────────────────────────────────
function Get-CommandVersion {
    param([string]$cmd, [string[]]$cmdArgs)
    try {
        $out = & $cmd @cmdArgs 2>&1
        if ($LASTEXITCODE -eq 0 -and $out) { return ($out | Select-Object -First 1).Trim() }
    } catch {}
    return $null
}

function Refresh-Path {
    $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('PATH', 'User')
}

# ─── 1. winget ────────────────────────────────────────────────────────────────
Write-Section "winget 包管理器"
$wingetVer = Get-CommandVersion winget @('--version')
if ($wingetVer) {
    Write-OK "winget $wingetVer"
} else {
    Write-FAIL "winget 未找到，请手动在 Microsoft Store 安装「应用安装程序」后重新运行本脚本"
    exit 1
}

# ─── 2. Node.js ───────────────────────────────────────────────────────────────
Write-Section "Node.js"
$nodeVer = Get-CommandVersion node @('--version')
if ($nodeVer) {
    $major = [int]($nodeVer.TrimStart('v').Split('.')[0])
    if ($major -eq 24) {
        Write-OK "Node.js $nodeVer"
    } elseif ($major -ge 18) {
        Write-WARN "Node.js $nodeVer 已安装，但建议使用 v24（当前版本可正常使用，跳过升级）"
    } else {
        Write-WARN "Node.js $nodeVer 版本过旧（需要 >= 18），请手动升级到 v24 后重新运行"
        $issues += "node-version-too-old"
    }
} else {
    Write-INFO "Node.js 未安装，正在安装 v24..."
    winget install --id OpenJS.NodeJS.LTS --version "24.*" --silent --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -eq 0) {
        Refresh-Path
        Write-FIXED "Node.js v24 安装完成"
    } else {
        Write-FAIL "Node.js 安装失败，请手动安装后重新运行"
        $issues += "node"
    }
}

# ─── 3. yarn ─────────────────────────────────────────────────────────────────
Write-Section "yarn"
$yarnVer = Get-CommandVersion yarn @('--version')
if ($yarnVer) {
    Write-OK "yarn $yarnVer"
} else {
    Write-INFO "yarn 未安装，正在安装..."
    npm install -g yarn
    if ($LASTEXITCODE -eq 0) {
        Refresh-Path
        $yarnVer = Get-CommandVersion yarn @('--version')
        Write-FIXED "yarn $yarnVer 安装完成"
    } else {
        Write-FAIL "yarn 安装失败，请手动运行：npm install -g yarn"
        $issues += "yarn"
    }
}

# ─── 4. Rust / rustup ────────────────────────────────────────────────────────
Write-Section "Rust 工具链"
$rustupVer = Get-CommandVersion rustup @('--version')
if ($rustupVer) {
    Write-OK "rustup $($rustupVer.Split([char]10)[0])"
} else {
    Write-INFO "rustup 未安装，正在下载安装（MSVC 工具链）..."
    $rustupInstaller = "$env:TEMP\rustup-init.exe"
    Invoke-WebRequest 'https://win.rustup.rs/x86_64' -OutFile $rustupInstaller
    & $rustupInstaller -y --default-toolchain stable --default-host x86_64-pc-windows-msvc
    Remove-Item $rustupInstaller -ErrorAction SilentlyContinue
    $env:PATH += ";$env:USERPROFILE\.cargo\bin"
    $rustupVer = Get-CommandVersion rustup @('--version')
    if ($rustupVer) {
        Write-FIXED "rustup 安装完成"
    } else {
        Write-FAIL "rustup 安装失败，请手动访问 https://rustup.rs 安装"
        $issues += "rustup"
    }
}

$rustVer = Get-CommandVersion rustc @('--version')
if ($rustVer) {
    Write-OK "rustc $($rustVer -replace 'rustc ','')"
} else {
    Write-WARN "rustc 未在 PATH 中，请重启终端后重试（rustup 刚安装时需要重启）"
    $issues += "rustc-path"
}

# ─── 5. MSVC 工具链 ───────────────────────────────────────────────────────────
Write-Section "MSVC 工具链"
$activeToolchain = Get-CommandVersion rustup @('show', 'active-toolchain')
if ($activeToolchain -and $activeToolchain -match 'msvc') {
    Write-OK "当前工具链：$activeToolchain"
} elseif ($activeToolchain) {
    Write-INFO "当前工具链 $activeToolchain 不是 MSVC，正在切换..."
    rustup default stable-x86_64-pc-windows-msvc
    Write-FIXED "已切换到 stable-x86_64-pc-windows-msvc"
} else {
    Write-WARN "无法检测工具链（rustup 可能未在 PATH 中，重启终端后重试）"
}

# ─── 6. Microsoft C++ Build Tools ────────────────────────────────────────────
Write-Section "Microsoft C++ Build Tools"
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasMSVC = $false
if (Test-Path $vsWhere) {
    $vsInstalls = & $vsWhere -latest -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json 2>$null | ConvertFrom-Json
    if ($vsInstalls) {
        Write-OK "Visual Studio C++ 工具集：$($vsInstalls[0].displayName)"
        $hasMSVC = $true
    }
}
if (-not $hasMSVC) {
    $btPath = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools"
    if (Test-Path $btPath) {
        Write-OK "Microsoft C++ Build Tools 2022 已安装"
        $hasMSVC = $true
    }
}
if (-not $hasMSVC) {
    Write-INFO "Microsoft C++ Build Tools 未安装，正在安装..."
    winget install --id Microsoft.VisualStudio.2022.BuildTools --silent --accept-source-agreements --accept-package-agreements `
        --override "--wait --quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
    if ($LASTEXITCODE -eq 0) {
        Write-FIXED "Microsoft C++ Build Tools 安装完成"
    } else {
        Write-FAIL "Build Tools 安装失败，请手动安装并勾选「使用 C++ 的桌面开发」工作负载"
        $issues += "msvc-buildtools"
    }
}

# ─── 7. WebView2 Runtime ──────────────────────────────────────────────────────
Write-Section "WebView2 Runtime"
$webview2Key = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
$webview2Alt  = 'HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
if ((Test-Path $webview2Key) -or (Test-Path $webview2Alt)) {
    $ver = (Get-ItemProperty $webview2Key -ErrorAction SilentlyContinue).pv
    if (-not $ver) { $ver = (Get-ItemProperty $webview2Alt -ErrorAction SilentlyContinue).pv }
    Write-OK "WebView2 Runtime 已安装$(if ($ver) { '，版本 ' + $ver })"
} else {
    Write-INFO "WebView2 Runtime 未检测到，正在下载安装..."
    $wv2 = "$env:TEMP\MicrosoftEdgeWebview2Setup.exe"
    Invoke-WebRequest 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $wv2
    & $wv2 /silent /install
    Remove-Item $wv2 -ErrorAction SilentlyContinue
    Write-FIXED "WebView2 Runtime 安装完成"
}

# ─── 8. Tauri CLI ─────────────────────────────────────────────────────────────
Write-Section "Tauri CLI（cargo-tauri）"
$tauriVer = Get-CommandVersion cargo @('tauri', '--version')
if ($tauriVer) {
    Write-OK "tauri-cli $tauriVer"
} else {
    Write-INFO "cargo-tauri 未安装，正在安装..."
    cargo install tauri-cli --locked
    if ($LASTEXITCODE -eq 0) {
        Write-FIXED "tauri-cli 安装完成"
    } else {
        Write-WARN "tauri-cli 安装失败（cargo 不可用时 yarn tauri dev 首次运行会自动安装）"
        $issues += "tauri-cli"
    }
}

# ─── 汇总 ────────────────────────────────────────────────────────────────────
Write-Section "检测结果汇总"
if ($issues.Count -eq 0) {
    Write-Host "`n  环境检测通过！下一步：" -ForegroundColor Green
    Write-Host "    cd MikanBox" -ForegroundColor White
    Write-Host "    yarn            # 安装前端依赖（首次）" -ForegroundColor White
    Write-Host "    yarn tauri dev  # 启动 Tauri 开发窗口" -ForegroundColor White
} else {
    Write-Host "`n  以下问题需要手动处理：" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "    - $issue" -ForegroundColor Red
    }
    Write-Host "`n  解决后请重新运行本脚本验证。" -ForegroundColor Yellow
}
