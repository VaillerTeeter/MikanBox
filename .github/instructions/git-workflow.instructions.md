---
description: "Use when: executing git operations, creating branches, committing code, pushing, creating or merging PRs, managing releases, or any destructive/irreversible action. Covers AI authorization requirements, branch workflow, commit message rules, and PR template compliance."
applyTo: "**"
---

# AI Git Workflow Rules

<!-- 本文件约束 AI 在 git / gh / GitHub MCP 操作上的行为。
     物理拦截由 .github/hooks/scripts/git-guard.sh 负责；本文件为 AI 行为规范。
     中文注释仅供人类维护者阅读，AI 执行纯英文规则。 -->

<!-- ============================================================
  .instructions.md 写作规范

  ✅ 每条规则用祈使句开头：Always / Never / Before X, do Y
  ✅ 禁止事项优先列出，用 "NEVER" 或 "MUST NOT"
  ✅ 附上示例（good/bad 对比）比纯文字更有效
  ✅ 每个关注点独立 section，避免混合
  ✅ 关键词必须出现在 description 中（Agent 靠它发现这个文件）
  ❌ 不要写"建议"、"推荐"——用强制语气
  ❌ 不要超过 150 行——超出后 Agent 记忆稀释
  ============================================================ -->

## Authorization Requirements

<!-- 授权要求：以下操作必须等用户在当前消息中明确写出才能执行，否则一律不得自行发起 -->

NEVER self-initiate any of the following without an explicit user instruction:

<!-- git 本地写操作 -->
- `git add` / `git commit` / `git push` / `git reset` / `git restore` / `git rm`
- `git merge` / `git rebase` / `git cherry-pick`
- `git tag <name>` / `git tag -a` / `git tag -d`
- `git branch -d` / `git branch -D`
- `git stash drop` / `git stash pop` / `git stash clear`

<!-- gh CLI 写操作 -->
- `gh pr create` / `gh pr merge` / `gh pr close` / `gh pr edit`
- `gh release create` / `gh repo delete` / `gh issue close` / `gh issue delete`

<!-- GitHub MCP 写操作 -->
- Any `mcp_github_create_*` / `mcp_github_merge_*` / `mcp_github_push_*` / `mcp_github_update_*` tool

**Counts as explicit** (proceed): "提交" / "commit" / "push" / "推送" / "创建 PR" / "开 PR" / "合并" / "merge" / "git add"
<!-- 以下不算明确指令，禁止触发任何写操作 -->
**Does NOT count** (deny): "改完了" / "做好了" / "完成了" / "写好了"

## Git Operation Rules

<!-- git 操作规则 -->

NEVER commit or push directly to `master`.
<!-- 任何情况下禁止直接在 master 分支 commit 或 push -->

Always create a feature branch before any commit:
<!-- 所有变更走功能分支，命名规范如下 -->
```text
feat/<description>   # new feature
fix/<description>    # bug fix
chore/<description>  # maintenance / chore
```

NEVER use Chinese characters in commit messages (subject or body).
<!-- commit message 的 subject 和 body 全部使用英文，禁止出现中文 -->

✅ `feat: add episode search endpoint`
❌ `feat: 新增剧集搜索接口`

## PR Workflow

<!-- PR 工作流 -->

Before `gh pr create`, MUST write the PR body to `tmp/pr-<number>-body.md` and wait for user confirmation.
<!-- 创建 PR 前必须先写临时文件让用户确认，禁止直接执行 gh pr create -->

PR body MUST follow `.github/PULL_REQUEST_TEMPLATE.md` — all sections required, none omitted.
<!-- PR body 必须按模板填写，所有 section 不得省略 -->

If a PR body already exists, MUST append, NEVER overwrite.
<!-- PR 已有 body 时只能追加，禁止覆盖历史内容 -->

Always use merge commit (the only strategy enabled in repo settings).
<!-- 仓库设置中只开启了 Allow merge commits，禁止使用 squash 或 rebase -->
Prefer MCP; fall back to `gh` only when MCP is unavailable:

```text
# 1st choice — MCP
mcp_github_merge_pull_request  number=<number>  merge_method=merge

# 2nd choice — gh CLI fallback
gh pr merge <number> --merge --delete-branch
```

## gh CLI Rules

<!-- gh CLI 操作规则 -->

Always prefer GitHub MCP tools over `gh` CLI for any GitHub operation (issues, PRs, files, branches):
<!-- GitHub 操作优先用 MCP 工具，其次才是 gh CLI，最后才是裸 git 命令 -->

```text
1st choice: mcp_github_*   # structured API, no shell needed
2nd choice: gh <command>   # requires GH_TOKEN from .env
3rd choice: git <command>  # local operations only (log / diff / status)
```

Always load the auth token from `.env` before running any `gh` command:
<!-- 执行任何 gh 命令前必须先加载 .env 中的 GH_TOKEN -->
```bash
export GH_TOKEN="$(grep '^GH_TOKEN=' .env | cut -d= -f2- | tr -d '\r')"
```

NEVER use `curl https://api.github.com/...` — use `gh api ...` instead.
<!-- 禁止直接 curl GitHub API，统一用 gh api -->

NEVER push to `master` via `git push` or `mcp_github_push_files` targeting the `master` branch.
<!-- 禁止通过任何方式直接推送到 master 分支 -->

## Violation Handling

<!-- 违规处理：即将违规时的兜底行为 -->

If about to execute a blocked operation without explicit user instruction:
<!-- 如果即将在没有明确指令的情况下执行受限操作，必须停下来按以下步骤处理 -->

1. STOP — do not execute. <!-- 立即停止 -->
2. State which rule would be violated. <!-- 说明即将违反哪条规则 -->
3. Ask the user for explicit confirmation. <!-- 请用户明确确认 -->

The `git-guard.sh` hook provides physical interception as a safety net, but these rules apply regardless of whether the hook fires.
<!-- git-guard.sh 是物理兜底，但 AI 必须在 hook 触发前就遵守规则，不能依赖 hook 来约束自己 -->
