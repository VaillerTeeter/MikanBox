---
description: "Use when: reading files, writing files, making code edits, running terminal commands, searching in the codebase, or managing processes. Covers when to invoke Desktop Commander MCP tools and how to use them efficiently to minimize token usage."
applyTo: "**"
---

# Desktop Commander MCP Rules

<!-- 本文件约束 AI 在操作文件、终端、进程时必须优先使用 Desktop Commander MCP 工具的行为。
     Desktop Commander 通过结构化工具调用替代大段文字输出，从设计层面节省 token。
     中文注释仅供人类维护者阅读，AI 执行纯英文规则。 -->

<!-- ============================================================
  适用场景（满足任一即触发）：
  - 读取 / 写入 / 编辑工作区文件
  - 运行终端命令（yarn、cargo、git 等）
  - 在代码库中搜索文件名或内容
  - 管理后台进程（开发服务器、构建任务等）
  ============================================================ -->

## When to Use Desktop Commander

<!-- 触发条件：以下操作必须通过 Desktop Commander 工具执行，不得用输出文字替代 -->

Always use Desktop Commander tools for any file or terminal operation — do not output shell commands for the user to run manually when the MCP can execute them directly.

<!-- 不得跳过 Desktop Commander 的场景示例 -->

✅ Reading a file → use `read_file`
✅ Making a targeted code change → use `edit_block`
✅ Running `yarn build` → use `execute_command`
✅ Searching for a symbol across files → use `start_search`
❌ Purely conversational answers with no file/terminal action → Desktop Commander not required

## Editing Files

<!-- 文件编辑规则：优先用外科手术式编辑，禁止不必要的全文件重写 -->

Always use `edit_block` for targeted changes. NEVER rewrite an entire file when only a small section needs to change.
<!-- edit_block 只发送差异片段，全文件重写会消耗大量 token -->

`edit_block` format:
```text
filepath.ext
<<<<<<< SEARCH
exact content to find
=======
replacement content
>>>>>>> REPLACE
```

Always make multiple small `edit_block` calls rather than one large rewrite.
<!-- 宁可多次小改，不要一次大改——这是 Desktop Commander 节省 token 的核心设计 -->

NEVER set `fileWriteLineLimit` above 100 unless explicitly asked.
<!-- 默认 50 行写入限制强制 AI 分块操作，避免一次性写入整个大文件 -->

## Reading Files

<!-- 文件读取规则：避免一次性读取超出需要的内容 -->

Always use `read_file` with line ranges when only part of a file is needed.
<!-- 指定行范围可避免把整个大文件塞进 context -->

Use `read_multiple_files` when reading several files at once — one tool call instead of many.
<!-- 批量读取比多次单独调用更省 token -->

## Running Commands

<!-- 终端命令规则 -->

Always use `execute_command` to run shell commands. NEVER ask the user to run commands manually if the MCP can do it.
<!-- 能用工具执行的命令，不要输出给用户手动跑 -->

For long-running processes (dev server, watcher), use `start_process` and interact via `interact_with_process`.
<!-- 开发服务器等长期进程用 start_process，不要用 execute_command 阻塞 -->

Always check `list_sessions` before starting a new process to avoid duplicate dev servers.
<!-- 避免重复启动开发服务器，每次先确认是否已有在运行的会话 -->

## Searching

<!-- 代码搜索规则 -->

Always use `start_search` for finding files by name or content pattern.
<!-- 用工具搜索，不要让 AI 凭记忆猜文件位置 -->

Always call `get_more_search_results` to paginate if the first batch is insufficient.
Always call `stop_search` when done to free resources.
<!-- 搜索完毕后关闭会话，避免资源泄漏 -->

## Token Efficiency Rules

<!-- Token 效率规则：Desktop Commander 设计目标之一就是减少 AI 的 token 浪费 -->

NEVER output a full file's content in the chat when `read_file` or `edit_block` can handle it silently.

NEVER generate a bash script as text and ask the user to run it — use `execute_command` directly.

Always prefer the most targeted tool for the job:
<!-- 选最精准的工具，避免过度读取或过度输出 -->

```text
Small code change    → edit_block        (not write_file)
Partial file read    → read_file + range (not full file)
Find a symbol        → start_search      (not reading many files manually)
Run a build step     → execute_command   (not user-facing instructions)
```
