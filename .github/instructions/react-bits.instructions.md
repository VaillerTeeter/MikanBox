---
description: "Use when: adding animated/interactive UI components, text animations, backgrounds, or visual effects to the project. Covers how to find, copy, and integrate React Bits components — a source-copy library, NOT an npm package."
applyTo: "**"
---

# React Bits Component Rules

<!-- 本文件约束 AI 在引入 React Bits 动效组件时的行为。
     React Bits 不是 npm 包，是一个复制粘贴式源码库，组件代码直接属于本项目。
     官网：https://reactbits.dev  源仓库：https://github.com/DavidHDev/react-bits
     中文注释仅供人类维护者阅读，AI 执行纯英文规则。 -->

<!-- ============================================================
  适用场景（满足任一即触发）：
  - 需要文字动画（模糊渐入、打字机、分割等）
  - 需要背景特效（粒子、噪点、渐变动画等）
  - 需要 UI 动效组件（卡片翻转、磁吸按钮等）
  - 用户提到 "react-bits" 或 "动效组件"
  ============================================================ -->

## What React Bits Is

<!-- React Bits 的本质：理解这一点是正确使用的前提 -->

React Bits is a **source-copy component library**, NOT an npm package.

NEVER run `yarn add react-bits` or `npm install react-bits` — no such package exists.

Components are copied directly into the project as source files. Once copied, the code belongs to the project and can be freely modified.

✅ Copy source → edit freely → ship
❌ `yarn add react-bits`

## Finding a Component

<!-- 查找组件的步骤 -->

Always browse components at [reactbits.dev](https://reactbits.dev) first to find one that fits the requirement.

Categories available:

```text
Text Animations  — BlurText, SplitText, GradientText, ShinyText, ...
Animations       — MagneticButton, PixelCard, Ribbons, ...
Components       — SpotlightCard, TiltCard, Dock, ...
Backgrounds      — Aurora, Particles, DotMatrix, ...
```

Always select the **TS-CSS** variant — this project uses TypeScript and plain CSS (no Tailwind).

<!-- 变体选择规则：项目使用 TypeScript + CSS，禁止选 TW (Tailwind) 变体 -->

✅ `BlurText-TS-CSS`
❌ `BlurText-TS-TW`

## Installing a Component

<!-- 引入组件的完整流程 -->

Before copying any component, Always check its dependencies on the component page.
Each component lists its own external dependencies (e.g., `motion`, `gsap`, `ogl`).

Always install only what the specific component requires:

```bash
# Example: BlurText requires motion
yarn add motion

# Example: some components require gsap
yarn add gsap
```

NEVER install a dependency already present in `package.json`.

## File Placement

<!-- 组件文件放置规范 -->

Always place copied component files under `src/components/ui/<ComponentName>/`:

```text
src/components/ui/
└── BlurText/
    └── BlurText.tsx     # copied source, TS-CSS variant
```

Always use PascalCase for both the folder name and the file name.

## Fetching Source Code

<!-- 获取源码的方式 -->

To obtain a component's source code programmatically, fetch from the React Bits registry:

```text
GET https://reactbits.dev/r/<ComponentName>-TS-CSS.json
```

The response contains:
- `files[].content` — the full TypeScript source to copy
- `dependencies` — the exact npm packages required

Always read `dependencies` from the registry JSON before running `yarn add`.

## Usage

<!-- 组件使用规范 -->

After copying, import the component using a relative path — never from a package name:

```tsx
// ✅ correct — local source file
import BlurText from './components/ui/BlurText/BlurText';

// ❌ wrong — no such npm package
import BlurText from 'react-bits';
```

Always check the Props table on the component page for all available customization options.
