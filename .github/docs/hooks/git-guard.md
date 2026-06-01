# git-guard Hook

`PreToolUse` 生命周期钩子，在 AI Agent 执行终端命令前拦截危险的 `git` / `gh` 写操作，弹出用户确认。

## 文件结构

```text
.github/hooks/
├── git-guard.json          # Hook 注册配置
└── scripts/
    ├── git-guard.sh        # Linux / macOS 拦截脚本（bash + python3）
    └── git-guard.py        # Windows 拦截脚本（纯 Python 3，无需 bash）
```

## 工作原理

```text
AI invokes a tool call
        │
        ▼
  git-guard.sh reads stdin JSON
        │
   ┌────┴───────────────────────────────────────┐
   │                                            │
toolName ==                                    toolName matches
run_in_terminal?                               mcp_github_* write op?
   │                                            │
   ├── no  → exit 0 (allow)                     ├── no  → exit 0 (allow)
   └── yes → shlex-split                        └── yes → extract params
              command                                       │
              │                                             │
        check sub-cmd /                                     │
        options against rules?                              │
              ├── no  → exit 0 (allow)                      │
              └── yes ───────────────────────────────────►──┘
                                 │
                 return permissionDecision: "ask"
                 (Copilot prompts for confirmation)
```

Hook 返回 `ask` 时，Copilot 会暂停执行并弹窗，由用户决定是否放行。用户拒绝后 AI 不会重试。

## 拦截规则

### git 写操作 / 历史变更

| 命令 | 说明 |
| --- | --- |
| `git add` | 暂存文件变更 |
| `git commit` | 提交变更 |
| `git push` | 推送到远程 |
| `git reset` | 重置 HEAD / 工作区 |
| `git restore` | 还原工作区文件 |
| `git rm` | 从索引删除文件 |
| `git merge` | 合并分支 |
| `git rebase` | 变基 |
| `git cherry-pick` | 移植 commit |
| `git tag <name>` | 创建标签（轻量标签） |
| `git tag -a/-s/-f` | 创建附注 / 签名 / 强制覆盖标签 |
| `git tag -d` | 删除标签 |

### git 分支删除

| 命令 | 说明 |
| --- | --- |
| `git branch -d` | 删除已合并分支 |
| `git branch -D` | 强制删除分支 |
| `git branch --delete` | 同 `-d` |

### git stash 销毁

| 命令 | 说明 |
| --- | --- |
| `git stash drop` | 删除指定 stash |
| `git stash pop` | 弹出并删除 stash |
| `git stash clear` | 清空所有 stash |

### gh CLI 操作

| 命令 | 说明 |
| --- | --- |
| `gh pr create` | 创建 Pull Request |
| `gh pr merge` | 合并 Pull Request |
| `gh pr close` | 关闭 Pull Request |
| `gh pr edit` | 修改 Pull Request 信息 |
| `gh release create` | 创建发布版本 |
| `gh repo delete` | 删除仓库 |
| `gh issue close` | 关闭 Issue |
| `gh issue delete` | 删除 Issue |

### GitHub MCP 写操作

| 工具 | 说明 |
| --- | --- |
| `mcp_github_create_pull_request` | 创建 PR |
| `mcp_github_merge_pull_request` | 合并 PR |
| `mcp_github_push_files` | 推送多个文件 |
| `mcp_github_create_or_update_file` | 创建 / 更新单个文件 |
| `mcp_github_create_branch` | 创建分支 |
| `mcp_github_create_repository` | 创建仓库 |
| `mcp_github_fork_repository` | Fork 仓库 |
| `mcp_github_update_pull_request_branch` | 更新 PR 分支 |
| `mcp_github_create_pull_request_review` | 提交 PR Review |
| `mcp_github_add_issue_comment` | 添加 Issue 评论 |
| `mcp_github_update_issue` | 更新 Issue |
| `mcp_github_create_issue` | 创建 Issue |

拦截时展示关键参数摘要（`title`、`branch`、`pull_number` 等）方便用户判断。

### 放行（不拦截）

只读操作直接通过，包括但不限于：

```text
git status / log / diff / show / fetch / clone
git branch / git branch -v/-a/-r（无 -d/-D）
git tag / git tag -l（仅列出）
git stash list / git stash show
gh pr list / gh pr view / gh pr status
gh issue list / gh issue view
gh repo view / gh run list / gh workflow list
mcp_github_get_* / mcp_github_list_* / mcp_github_search_*
```

## 测试方法

### Linux / macOS

```bash
# 应被拦截（输出 JSON 且 permissionDecision == "ask"）
echo '{"toolName":"run_in_terminal","toolInput":{"command":"git add ."}}' \
  | bash .github/hooks/scripts/git-guard.sh

echo '{"toolName":"run_in_terminal","toolInput":{"command":"gh pr merge 42 --merge"}}' \
  | bash .github/hooks/scripts/git-guard.sh

# 应直接放行（无输出，exit 0）
echo '{"toolName":"run_in_terminal","toolInput":{"command":"git log --oneline"}}' \
  | bash .github/hooks/scripts/git-guard.sh && echo "PASS"

echo '{"toolName":"run_in_terminal","toolInput":{"command":"npm install"}}' \
  | bash .github/hooks/scripts/git-guard.sh && echo "PASS"
```

### Windows（PowerShell）

```powershell
# 应被拦截
'{"toolName":"run_in_terminal","toolInput":{"command":"git add ."}}' |
  python .github/hooks/scripts/git-guard.py

'{"toolName":"run_in_terminal","toolInput":{"command":"gh pr merge 42 --merge"}}' |
  python .github/hooks/scripts/git-guard.py

# 应直接放行（无输出，exit 0）
'{"toolName":"run_in_terminal","toolInput":{"command":"git log --oneline"}}' |
  python .github/hooks/scripts/git-guard.py ; if ($LASTEXITCODE -eq 0) { "PASS" }

'{"toolName":"run_in_terminal","toolInput":{"command":"yarn install"}}' |
  python .github/hooks/scripts/git-guard.py ; if ($LASTEXITCODE -eq 0) { "PASS" }
```

## 维护说明

- **新增 `run_in_terminal` 拦截规则**：
  - Linux/macOS：修改 `git-guard.sh` 中内嵌的 Python 检测逻辑（`inspect_tokens` 函数内的 `if tool == 'git'` / `elif tool == 'gh'` 分支）
  - Windows：修改 `git-guard.py` 中的 `inspect_tokens` 函数，逻辑与 `git-guard.sh` 保持一致
- **新增 MCP 工具拦截**：两个脚本均需更新正则表达式（`_MCP_WRITE_RE` 变量 / `grep -qiE` 模式）
- **修改超时**：调整 `git-guard.json` 中的 `timeout`（单位：秒，当前 5s）
- 此 Hook 对全体团队成员生效（配置存于 `.github/hooks/`，随仓库提交）

## 平台说明

| 平台 | 脚本 | 依赖 |
|---|---|---|
| Linux / macOS | `git-guard.sh` | `bash` + `python3` |
| Windows | `git-guard.py` | Python 3.6+（`python` 命令） |

**Windows 前提条件**：安装 [Python 3](https://www.python.org/downloads/windows/) 并在安装时勾选 **"Add Python to PATH"**，确保终端中可执行 `python`。

- 若 `python` 命令不可用，可尝试 `python3` 或 `py`（Python Launcher）；此时需同步修改 `git-guard.json` 中的 `"windows"` 字段
- 若环境中 `python` 指向 Python 2，请改用 `python3` 或 `py -3`
