# MikanBox

基于 [Bangumi API](https://github.com/bangumi/api) 的 Windows 桌面番剧管理工具，使用 Tauri v2 + React + TypeScript + Rust 构建。

## 功能规划

- **季度番剧查询** — 按季度浏览 Bangumi 番剧列表，查看详情、评分、简介
- **追番管理** — 管理个人收藏与追番进度，同步 Bangumi 账号数据
- **番剧下载** — 集成番剧下载站点，管理下载任务
- **轨道合并与标签** — 对番剧视频文件进行字幕/音轨合并，添加元数据标签

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
│   │       └── git-guard.sh                       # git/gh 危险写操作拦截脚本
│   ├── instructions/                               # GitHub Copilot 指令文件
│   │   ├── context7.instructions.md              # Context7 MCP 文档查询规范
│   │   ├── git-workflow.instructions.md           # AI git 操作行为规范
│   │   └── react-bits.instructions.md            # React Bits 组件引入规范
│   ├── ISSUE_TEMPLATE/                            # Issue 模板（中英文 bug/feature 各一份）
│   ├── PULL_REQUEST_TEMPLATE.md                   # PR 描述模板
│   └── workflows/
│       └── lint.yml                               # CI Lint 工作流（14 项检查）
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
│   └── setup-windows.ps1                          # Windows 开发环境一键检查/安装脚本
├── src/                                            # React 前端源代码
│   ├── assets/
│   │   └── fonts/
│   │       └── ZCOOLKuaiLe-Regular.ttf            # 站酷快乐体（内置，无需网络）
│   ├── pages/                                      # 页面组件（每项导航对应一个页面）
│   │   ├── BacklogPage.tsx                        # 想看
│   │   ├── DownloadPage.tsx                       # 下载
│   │   ├── FinishedPage.tsx                       # 看过
│   │   ├── QueryPage.tsx                          # 季度查询
│   │   ├── SearchPage.tsx                         # 搜索
│   │   ├── TracksPage.tsx                         # 轨道工具
│   │   └── WatchingPage.tsx                       # 在看
│   ├── styles/
│   │   ├── fonts.css                              # @font-face 声明（引用内置字体文件）
│   │   └── theme.css                              # 主题 CSS 变量（皮肤切换入口）
│   ├── App.css                                    # 全局布局样式
│   ├── App.tsx                                    # 根组件（主窗口布局：顶栏 + 左侧导航栏）
│   ├── main.tsx                                   # React 入口
│   └── vite-env.d.ts                              # Vite 类型声明
├── src-tauri/                                      # Tauri/Rust 后端
│   ├── capabilities/
│   │   └── default.json                           # Tauri ACL 权限配置
│   ├── icons/                                     # 应用图标（Windows Store 等多尺寸）
│   ├── src/
│   │   ├── lib.rs                                 # Tauri 命令注册与应用初始化
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

> 开始工作前，先读取 `.github/instructions/` 目录下所有 `.instructions.md` 文件，完全理解其中的规则后再响应。

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

### 技术栈

- [Tauri v2](https://tauri.app/) — Windows 桌面应用框架（Rust 后端 + WebView2）
- [React 19](https://react.dev/) — 前端 UI 框架
- [Vite 7](https://vite.dev/) — 前端构建工具
- [TypeScript](https://www.typescriptlang.org/) — 类型安全的 JavaScript 超集

### 作者

- [GitHub Profile](https://github.com/VaillerTeeter)
