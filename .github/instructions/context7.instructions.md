---
description: "Use when: answering questions about any library, framework, SDK, API, or CLI tool — including setup steps, configuration, code generation, and version-specific usage. Covers when to invoke Context7 MCP tools and how to select the correct library ID."
applyTo: "**"
---

# Context7 Documentation Rules

<!-- 本文件约束 AI 在回答库/框架/SDK/API 相关问题时必须调用 Context7 MCP 工具的行为。
     Context7 通过 MCP 拉取实时、版本精确的官方文档，避免幻觉 API 和过期示例。
     中文注释仅供人类维护者阅读，AI 执行纯英文规则。 -->

<!-- ============================================================
  适用场景（满足任一即触发）：
  - 用户询问某个库/框架/SDK/CLI 工具的用法
  - 生成涉及第三方库的代码
  - 配置步骤 / 安装步骤 / 版本迁移
  - 不确定某 API 是否仍然存在或签名是否变化
  ============================================================ -->

## When to Use Context7

<!-- 触发条件：以下情况必须调用 Context7，无需用户显式要求 -->

Always use Context7 when answering questions about any library, framework, SDK, API, or CLI tool — including setup steps, configuration, code generation, and version-specific usage — without the user having to explicitly ask.

<!-- 不得跳过 Context7 的场景示例 -->

✅ "How do I use `invoke` in Tauri v2?" → call Context7
✅ "Set up Prisma with Next.js" → call Context7
✅ "What's the React `useEffect` cleanup syntax?" → call Context7
❌ General programming concepts with no library dependency → Context7 not required

## Tool Call Order

<!-- 工具调用顺序：必须先 resolve，再 query，禁止跳过 -->

Always call `resolve-library-id` first to obtain the exact Context7-compatible library ID, then call `query-docs` with that ID.

NEVER call `query-docs` directly without a valid library ID, UNLESS the user explicitly provides one in `/org/project` or `/org/project/version` format.

<!-- 正确顺序示例 -->
```text
1. resolve-library-id  libraryName="Tauri"  query="invoke command from TypeScript"
   → returns /websites/v2_tauri_app

2. query-docs  libraryId="/websites/v2_tauri_app"  query="invoke command from TypeScript"
```

NEVER call `query-docs` more than 3 times per question.
<!-- 每次用户提问最多调用 query-docs 3 次，超出则使用已有结果作答 -->

## Library ID Selection

<!-- 库 ID 选择：从 resolve 结果中挑选最优匹配 -->

Always prefer the library result with the highest combination of:

```text
1. Name match — exact name match is prioritized
2. Source Reputation — High > Medium > Low > Unknown
3. Benchmark Score — higher is better (max 100)
4. Code Snippets — more snippets = better coverage
```

Always specify a version ID (e.g., `/vercel/next.js/v14`) when the user's question targets a specific version.
<!-- 用户明确提到版本号时，必须用对应的版本 ID -->

## Query Content Rules

<!-- 查询内容规则 -->

NEVER include sensitive information in queries sent to Context7:
<!-- 以下内容禁止出现在发往 Context7 的 query 字段中 -->

- API keys / tokens / passwords / credentials
- Personal data
- Proprietary business logic or internal code

Always write queries in specific, task-oriented language:
<!-- query 字段必须具体描述任务，禁止模糊关键词 -->

✅ `"How to configure JWT authentication middleware in Express.js"`
❌ `"auth"`
