# MikanBox

基于 [Bangumi API](https://github.com/bangumi/api) 的 Windows 桌面番剧管理工具，使用 Tauri v2 + React + TypeScript + Rust 构建。

## 已实现功能

- **季度番剧查询** — 按年份 + 季度浏览 Bangumi 番剧列表，支持平台 / 来源 / 标签 / 地区 / 受众多维筛选，查看详情、评分、简介、剧集、角色、演职人员
- **追番管理** — 正在追番 / 补番计划 / 已完番剧三状态收藏，周历视图、网格视图切换
- **资源搜索** — 搜索 Nyaa 字幕组资源，支持多关键词 AND / OR / NOT 逻辑组合，一键添加磁力下载
- **番剧下载** — 内嵌 aria2c sidecar，磁力链接下载，任务全生命周期管理（下载中 / 暂停 / 恢复 / 取消 / 重启），状态机防止非法转换；显示阶段、连接数、做种数诊断信息；下载设置弹窗支持 BT Tracker 列表管理、高级参数配置（最大 Peer 数 / 磁盘缓存 / 监听端口），配置全部持久化到磁盘，支持 JSON 导入 / 导出，脏标记提示未保存修改
- **轨道合并** — MKV 轨道工坊，识别视频 / 音频 / 字幕轨道，支持双文件队列合并（A 版视频 + B 版字幕），实时进度推送，自动清空轨道名称，输出目录默认为 A 版文件所在目录；内嵌 mkvmerge sidecar

## 规划中

- **RSS 自动订阅** — 订阅蜜柑计划 / Nyaa RSS 源，按番剧 + 字幕组规则自动匹配新集并推送到下载队列，无需手动搜索
- **文件自动重命名** — 下载完成后按 `[字幕组] 番剧名 - 集数 [分辨率].mkv` 规范自动重命名，支持自定义模板
- **Bangumi 进度同步** — 在追番页一键将本地观看进度（已看集数）写回 Bangumi，保持在线收藏数据一致
- **本地视频库** — 扫描指定目录，将本地 MKV / MP4 文件与 Bangumi 番剧条目自动关联，支持调用外部播放器
- **桌面通知** — 下载完成、新集到达、合并结束时推送 Windows 系统通知

## 目录结构

```text
.
├── .editorconfig                                   # 编辑器通用格式规范（缩进/换行/编码）
├── .env.example                                    # 环境变量模板（GH_TOKEN）
├── .gitignore                                      # Git 忽略规则
├── .github/                                        # GitHub 仓库配置与文档
│   ├── dependabot.yml                              # Dependabot 自动依赖更新配置
│   ├── docs/                                       # 项目文档
│   │   ├── ci/
│   │   │   └── ci-checks.md                       # CI 检查规则说明
│   │   ├── hooks/
│   │   │   └── git-guard.md                       # git-guard PreToolUse hook 说明
│   │   ├── mcp/
│   │   │   └── github-tools.md                    # GitHub MCP Server 工具清单
│   │   └── settings/                              # 仓库 Settings 配置操作记录（19 个文件）
│   ├── hooks/                                      # Git Hook 脚本
│   │   ├── git-guard.json                         # Claude Code PreToolUse hook 注册配置
│   │   └── scripts/
│   │       ├── git-guard.sh                        # Linux / macOS 拦截脚本（bash + python3）
│   │       └── git-guard.py                        # Windows 拦截脚本（纯 Python 3，无需 bash）
│   ├── instructions/                               # GitHub Copilot 指令文件
│   │   ├── context7.instructions.md              # Context7 MCP 文档查询规范
│   │   ├── git-workflow.instructions.md           # AI git 操作行为规范
│   │   └── react-bits.instructions.md            # React Bits 组件引入规范
│   ├── ISSUE_TEMPLATE/                            # Issue 模板（中英文 bug/feature 各一份）
│   ├── PULL_REQUEST_TEMPLATE.md                   # PR 描述模板
│   └── workflows/
│       └── lint.yml                               # CI Lint 工作流（15 项检查）
├── .lintrc/                                        # 各工具 Lint 配置
│   ├── backend/rust/
│   │   ├── .clippy.toml                           # Clippy 静态分析规则
│   │   └── rustfmt.toml                           # Rust 代码格式化配置
│   ├── data-formats/toml/
│   │   └── taplo.toml                             # TOML 格式化配置
│   ├── docs/markdown/
│   │   └── .markdownlint.json                     # Markdown lint 规则
│   ├── frontend/
│   │   ├── css-styles/
│   │   │   └── .stylelintrc.json                  # CSS/Tailwind lint 规则
│   │   ├── prettier/
│   │   │   └── .prettierrc                        # Prettier 格式化配置
│   │   ├── typescript/
│   │   │   ├── .eslintrc-ts.json                  # ESLint TypeScript/React 规则
│   │   │   └── tsconfig-lint.json                 # ESLint 专用 tsconfig
│   │   └── knip.json                              # Knip 未使用导出检查配置
│   ├── general/
│   │   ├── .ls-lint.yml                           # 文件命名规范检查
│   │   ├── .yamllint.yml                          # YAML lint 规则
│   │   └── cspell.json                            # 拼写检查词典配置
│   ├── git/
│   │   └── .commitlintrc.cjs                      # Commit message 规范
│   ├── infrastructure/shell/
│   │   ├── .shellcheckrc                          # ShellCheck 配置
│   │   └── PSScriptAnalyzerSettings.psd1          # PowerShell 静态分析规则
│   └── security/
│       └── .semgrep.yml                           # OWASP Top 10 安全扫描规则（TS + Rust）
├── .vscode/                                        # VS Code 工作区配置
│   ├── extensions.json                            # 推荐扩展列表
│   └── mcp.json                                   # MCP Server 配置（GitHub MCP + Context7）
│   └── settings.json                              # 工作区设置（格式化/lint/Tauri 等）
├── public/                                         # 静态资源（Vite 原样复制）
├── scripts/
│   ├── download-aria2.ps1                         # 自动下载 aria2c 二进制（Tauri sidecar）
│   ├── download-mkvmerge.ps1                      # 自动下载 mkvmerge 二进制（Tauri sidecar）
│   └── setup-windows.ps1                          # Windows 开发环境一键检查/安装脚本
├── src/                                            # React 前端源代码
│   ├── assets/
│   │   └── fonts/
│   │       └── ZCOOLKuaiLe-Regular.ttf            # 站酷快乐体（内置，无需网络）
│   ├── pages/                                      # 页面组件（每项导航对应一个页面）
│   │   ├── BacklogPage.tsx                        # 补番计划
│   │   ├── DownloadPage.tsx                       # 下载管理
│   │   ├── FinishedPage.tsx                       # 已完番剧
│   │   ├── QueryPage.tsx                          # 季度查询
│   │   ├── SearchPage.tsx                         # 搜索资源
│   │   ├── TracksPage.tsx                         # 轨道工坊
│   │   ├── WatchingPage.tsx                       # 正在追番
│   │   └── WatchListPage.tsx                      # 追番列表基础页（WatchingPage / BacklogPage 复用）
│   ├── store/                                      # 全局状态
│   │   ├── downloadStore.tsx                      # 下载任务 Context（状态机 + aria2 事件 + localStorage）
│   │   └── watchStore.ts                          # 追番收藏 localStorage 工具函数
│   ├── styles/
│   │   ├── fonts.css                              # @font-face 声明（引用内置字体文件）
│   │   └── theme.css                              # 主题 CSS 变量（皮肤切换入口）
│   ├── App.css                                    # 全局布局与组件样式（颜色全部引用 theme.css 变量）
│   ├── App.tsx                                    # 根组件（主窗口布局：顶栏 + 左侧导航栏 + 下载设置弹窗：Tracker / 高级参数 / 导入导出）
│   ├── main.tsx                                   # React 入口
│   └── vite-env.d.ts                              # Vite 类型声明
├── src-tauri/                                      # Tauri/Rust 后端
│   ├── capabilities/
│   │   └── default.json                           # Tauri ACL 权限配置
│   ├── icons/                                     # 应用图标（Windows Store 等多尺寸）
│   ├── src/
│   │   ├── lib.rs                                 # Tauri 命令 + aria2 控制 + mkvmerge 轨道识别与合并 + BT Tracker 持久化 + 高级参数持久化（AdvancedConfig）
│   │   └── main.rs                                # Rust 程序入口
│   ├── build.rs                                   # Tauri 构建脚本
│   ├── Cargo.lock                                 # 依赖版本锁定
│   ├── Cargo.toml                                 # Rust 包定义与依赖声明
│   └── tauri.conf.json                            # Tauri 应用配置（窗口/bundle/权限）
├── CODE_OF_CONDUCT.md                              # 行为准则
├── CONTRIBUTING.md                                 # 贡献指南
├── index.html                                      # Vite 入口 HTML
├── LICENSE                                         # GPL-3.0 许可证
├── package.json                                    # npm 包定义、scripts、依赖声明
├── README.md                                       # 本文件
├── SECURITY.md                                     # 安全漏洞披露政策
├── tsconfig.json                                   # TypeScript 编译配置（前端）
├── tsconfig.node.json                              # TypeScript 配置（Vite 配置文件）
└── vite.config.ts                                  # Vite 构建配置
```

## 本地配置

1. 复制 Token 模板文件：

    ```bash
    # Linux/macOS
    cp .env.example .env
    # Windows PowerShell
    Copy-Item .env.example .env
    ```

2. 编辑 `.env`，填入你的 GitHub Personal Access Token：

    ```ini
    # GitHub CLI 操作（PR / Issue / Release 等）
    GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
    ```

    > Token 申请地址：GitHub → Settings → Developer settings → Personal access tokens

3. 加载环境变量（每次新开终端执行一次）：

    ```bash
    export GH_TOKEN="$(grep '^GH_TOKEN=' .env | cut -d= -f2- | tr -d '\r')"
    ```

4. 验证配置：

    ```bash
    gh auth status
    ```

## 开发工作流

### 初次克隆后

**Windows（推荐，支持完整 Tauri 窗口）**：

```powershell
# 1. 运行环境检查脚本（自动检测并安装缺失的依赖）
.\scripts\setup-windows.ps1

# 2. 安装 npm 依赖
yarn install

# 3. 下载 aria2c 二进制（Tauri sidecar，首次必须执行）
.\scripts\download-aria2.ps1

# 4. 下载 mkvmerge 二进制（Tauri sidecar，轨道合并功能必须执行）
.\scripts\download-mkvmerge.ps1
```

脚本会依次检查：winget → Node.js v24 → yarn → rustup → Rust stable MSVC 工具链 → C++ Build Tools → WebView2 → Tauri CLI。

**WSL / Linux / macOS（仅浏览器预览，不支持 Tauri 桌面窗口）**：

```bash
yarn install
```

### 日常开发

```bash
# Windows PowerShell — 启动完整 Tauri 桌面窗口（热重载）
yarn tauri dev

# WSL / macOS 浏览器预览（Vite dev server，localhost:1520）
yarn dev
```

### 构建

```bash
# 构建 Windows 安装包（需在 Windows 上运行）
yarn tauri build
```

## CI 检查说明

> 详细的 CI 检查规则文档已独立维护，请参阅 [ci-checks.md](.github/docs/ci/ci-checks.md)。

`lint.yml` 包含以下 15 项检查：

| 检查项 | 工具 | 覆盖范围 |
|---|---|---|
| markdown-lint | markdownlint-cli | `**/*.md` |
| yaml-lint | yamllint | `**/*.{yml,yaml}` |
| toml-lint | taplo | `**/*.toml` |
| typescript-lint | ESLint + Prettier | `src/**/*.{ts,tsx}` |
| stylelint-lint | Stylelint | `src/**/*.css` |
| rust-lint | clippy + rustfmt | `src-tauri/src/**/*.rs` |
| shell-lint | ShellCheck | `**/*.sh` |
| react-doctor | millionco/react-doctor | `src/` |
| powershell-lint | PSScriptAnalyzer | `**/*.ps1` |
| secret-scan | Gitleaks | 全仓库 |
| semgrep-scan | Semgrep | `src/` + `src-tauri/src/` |
| commitlint-lint | commitlint | Commit messages |
| cspell-lint | CSpell | 全仓库文本 |
| knip-lint | Knip | `src/**` |
| ls-lint | ls-lint | 全仓库文件命名 |

## AI Agent 开发说明

本项目主要通过 AI Agent（GitHub Copilot）进行日常开发和维护工作。

在每次会话开始时，请发送以下提示词，让 AI 优先读取项目规范后再开始工作：

> 开始工作前，先读取 `.github/` 目录下所有 `.instructions.md` 文件，完全理解其中的规则后再响应。

目前包含的指令文件：

| 文件 | 说明 |
|---|---|
| `context7.instructions.md` | 库/框架文档查询规范（Context7 MCP 工具调用顺序与 library ID 选择） |
| `git-workflow.instructions.md` | AI git 操作行为规范（授权要求、分支命名、提交规范、PR 工作流） |
| `react-bits.instructions.md` | React Bits 动效组件引入规范（源码复制方式，非 npm 包） |

## 相关链接

### 本项目

- [MikanBox](https://github.com/VaillerTeeter/MikanBox) — 本仓库

### Bangumi

- [Bangumi 番组计划](https://bgm.tv/) — 目标数据平台
- [bangumi/api](https://github.com/bangumi/api) — Bangumi 官方 API 仓库
- [Bangumi API 文档](https://bangumi.github.io/api/) — 在线 API 文档（Swagger UI）
- [Bangumi Personal Access Token](https://next.bgm.tv/demo/access-token) — 创建用于认证的 Access Token

### 资源平台

- [Nyaa.si](https://nyaa.si/) — 番剧资源搜索平台（字幕组磁力资源）

### 下载核心

- [aria2](https://aria2.github.io/) — 高性能多协议下载工具（本项目以 Tauri sidecar 方式内嵌）
- [aria2 JSON-RPC 协议文档](https://aria2.github.io/manual/en/html/aria2c.html#rpc-interface) — aria2 RPC 接口参考
- [MKVToolNix](https://mkvtoolnix.download/) — MKV 封装工具集（mkvmerge 以 Tauri sidecar 方式内嵌，用于轨道合并）

### 前端 UI

- [animal-island-ui](https://github.com/ShenQingchuan/animal-island-ui) — 项目使用的 React 组件库（Button / Icon / Modal / Table 等）
- [Motion](https://motion.dev/) — React 动画库（`motion/react`）
- [React Bits](https://reactbits.dev/) — 动效组件源码库（源码复制方式引入，非 npm 包）

### Bangumi API 客户端

- [bangumi-api-client](https://www.npmjs.com/package/bangumi-api-client) — TypeScript Bangumi API 客户端（本项目使用）

### 技术栈

- [Tauri v2](https://tauri.app/) — Windows 桌面应用框架（Rust 后端 + WebView2）
- [React 19](https://react.dev/) — 前端 UI 框架
- [Vite 7](https://vite.dev/) — 前端构建工具
- [TypeScript](https://www.typescriptlang.org/) — 类型安全的 JavaScript 超集
- [Tokio](https://tokio.rs/) — Rust 异步运行时（aria2 轮询、RPC 调用）
- [reqwest](https://docs.rs/reqwest/) — Rust HTTP 客户端（aria2 JSON-RPC 通信）
- [Serde](https://serde.rs/) — Rust 序列化 / 反序列化框架

### CI / Lint 工具

- [ESLint](https://eslint.org/) — TypeScript/React 静态分析
- [Prettier](https://prettier.io/) — 代码格式化
- [Stylelint](https://stylelint.io/) — CSS 规范检查
- [Clippy](https://doc.rust-lang.org/clippy/) — Rust 静态分析
- [markdownlint-cli](https://github.com/igorshubovych/markdownlint-cli) — Markdown 规范检查
- [CSpell](https://cspell.org/) — 拼写检查
- [Gitleaks](https://gitleaks.io/) — 密钥 / 凭据泄露扫描
- [Semgrep](https://semgrep.dev/) — OWASP Top 10 安全扫描
- [Knip](https://knip.dev/) — 未使用导出 / 依赖检测
- [Commitlint](https://commitlint.js.org/) — Commit message 规范校验

### 作者

- [GitHub Profile](https://github.com/VaillerTeeter)
