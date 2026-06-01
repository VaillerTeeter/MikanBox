# MikanBox — Copilot Instructions

<!-- 本文件是仓库级 Copilot 系统提示，每次对话自动注入。
     目的：让 AI 无需用户重复说明项目栈，减少无效 token 往返。
     中文注释仅供人类维护者阅读，AI 执行纯英文规则。 -->

<!-- ============================================================
  维护规范
  ✅ 每条规则用祈使句开头：Always / Never / MUST
  ✅ 禁止事项用 NEVER 开头，优先列出
  ✅ 附 ✅/❌ 对比示例，比纯文字更有效
  ❌ 不要超过 150 行——超出后 AI 记忆稀释
  ============================================================ -->

## Project Identity

<!-- 项目基本信息：让 AI 第一时间知道这是什么项目 -->

MikanBox is a desktop anime tracking & download manager.

Tech stack:
- **Tauri v2** — Rust backend, desktop shell
- **React 19 + TypeScript** — frontend, strict mode
- **Vite 7** — bundler (dev port: `1520`)
- **Yarn** — the ONLY package manager; NEVER suggest `npm` or `pnpm`

## Frontend Rules

<!-- 前端规范：组件、样式、状态管理 -->

Always use functional components and hooks. NEVER use class components or HOCs.

Always use plain CSS. NEVER add Tailwind CSS or any CSS-in-JS library.
<!-- 项目用纯 CSS，没有 Tailwind，没有 styled-components -->

Always co-locate CSS files with their component. Place global styles in `src/styles/`.

Always place page-level components in `src/pages/`, one file per route.

State management uses **Zustand** (`src/store/`). Do not introduce other state libraries.
<!-- 状态管理用 Zustand，不要引入 Redux、Jotai 等 -->

Animations use **`motion`** (Framer Motion v12). Do not introduce other animation libraries.

## Package Rules

<!-- 包管理规范：避免引入错误的包或用错包管理器 -->

NEVER run `npm install` or `pnpm add`. Always use `yarn add`.

The following packages are already installed — NEVER suggest re-installing them:
<!-- 以下包已在 package.json 中，不要重复建议安装 -->
- `@tauri-apps/api`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-opener`
- `animal-island-ui`, `bangumi-api-client`, `motion`
- `react`, `react-dom`, `zustand`

**React Bits** is a source-copy library, NOT an npm package.
<!-- React Bits 不是 npm 包，组件直接复制到 src/components/ui/<ComponentName>/ -->
NEVER run `yarn add react-bits`. Always copy source to `src/components/ui/<ComponentName>/`.

## Tauri / Rust Backend Rules

<!-- Tauri 后端规范 -->

Always invoke Tauri commands via `invoke()` from `@tauri-apps/api/core`.
<!-- 调用 Rust 命令统一用 @tauri-apps/api/core 的 invoke，不要用其他方式 -->

Always add new Tauri commands in `src-tauri/src/lib.rs` and register with `.invoke_handler()`.

Capabilities config lives at `src-tauri/capabilities/default.json` — edit there for permission changes.

## TypeScript Rules

<!-- TypeScript 规范 -->

NEVER use `any`. NEVER use `@ts-ignore` without an explanatory comment on the same line.

✅ `// @ts-ignore: third-party type mismatch in bangumi-api-client v2026`
❌ `// @ts-ignore`

## Dev Commands

<!-- 常用开发命令，供 AI 在需要时引用 -->

```bash
yarn dev          # Vite dev server (frontend only, port 1520)
yarn tauri dev    # full Tauri app in dev mode
yarn build        # TypeScript check + Vite build
yarn tauri build  # production Tauri bundle
```

## Response Style

<!-- 回复风格：直接压缩输出 token 数量，降低成本 -->

Be concise. Target 1–3 sentences for simple answers. Expand only when complexity requires it.

NEVER open with preamble ("I'll now...", "Sure, I will...", "Here's what I'll do...").

NEVER close with a recap ("I've completed...", "The changes have been applied...").
<!-- 完成操作后不要复述做了什么，用一句话确认即可 -->

NEVER add comments, docstrings, or type annotations to code you did not change.

NEVER add error handling, new features, or refactoring beyond what was explicitly requested.
<!-- 不要超出请求范围做额外优化，除非用户明确要求 -->

Prefer code over prose: show the solution directly, skip the step-by-step walkthrough unless asked.

When offering options, give at most 2. Do not list every possible alternative.
<!-- 提供选项时最多给 2 个，不要罗列所有可能性 -->

## Instruction Self-Check

<!-- 按需验证规则：用户说"检查指令"时才触发，不是每次都输出，避免浪费 token -->

When the user says "检查指令" or "check instructions", respond with ONLY this fixed format and nothing else:
<!-- 用户说"检查指令"时，只输出以下固定格式，不要加任何额外内容 -->

```
✅ 指令文件已加载
- 包管理器: yarn（禁止 npm / pnpm）
- 样式方案: 纯 CSS（禁止 Tailwind）
- 状态管理: Zustand
- 回复风格: 简洁，禁止开场白和结尾复述
```
