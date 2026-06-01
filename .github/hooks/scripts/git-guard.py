#!/usr/bin/env python3
"""
git-guard.py — PreToolUse hook (Windows 原生 / 跨平台 Python 备选)
与 git-guard.sh 逻辑完全一致，但无需 bash，仅依赖 Python 3.6+。

Claude Code hook 调用方式（git-guard.json 中配置）：
    python .github/hooks/scripts/git-guard.py
"""

import json
import os
import re
import shlex
import sys


# ── 全局异常兜底：解析失败时保守拦截而非静默放行 ─────────────────────────────

def _fail_closed(exc_type, exc, tb):
    try:
        _emit_conservative_ask("命令解析失败，保守拦截")
    finally:
        os._exit(0)

sys.excepthook = _fail_closed


# ── 输出工具函数 ──────────────────────────────────────────────────────────────

def _emit_conservative_ask(reason: str = "git-guard.py: 保守拦截") -> None:
    """python3 缺失或运行时异常时的兜底响应，要求用户确认。"""
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def _emit_ask(reason: str, command: str = "") -> None:
    """检测到受限操作时返回 ask，弹出确认对话框。"""
    msg = (
        "⛔ 检测到需要用户明确授权的操作\n"
        f"类型: {reason}\n"
        f"命令: {command}\n\n"
        "根据项目规范，AI 不得自行发起此类操作。\n"
        "请确认：你是否已明确指示执行此命令？"
    )
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": msg,
        }
    }))
    sys.exit(0)


# ── 读取并解析 stdin JSON ─────────────────────────────────────────────────────

try:
    _raw = sys.stdin.read()
    _data = json.loads(_raw)
except Exception:
    sys.exit(0)

_tool_name: str = _data.get("toolName", "")
_tool_input: dict = _data.get("toolInput", {})

if not _tool_name:
    sys.exit(0)


# ── 分支 1：run_in_terminal（git / gh CLI）────────────────────────────────────

if _tool_name == "run_in_terminal":
    cmd: str = _tool_input.get("command", "")
    if not cmd:
        sys.exit(0)

    _env_assign_re = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*=.*$')

    def split_shell_segments(command: str) -> list:
        """
        按 shell 操作符（&&、||、;、|、&、换行）拆分命令为独立片段。
        引号内的操作符不触发拆分，防止误拆 -c 参数内的内容。
        """
        try:
            lexer = shlex.shlex(command, posix=True, punctuation_chars=';|&\n')
            lexer.whitespace = ' \t\r'   # 把 \n 从空白集移出，使其作为操作符 token
            lexer.whitespace_split = True
            raw_tokens = list(lexer)
        except ValueError:
            _emit_conservative_ask("命令含不匹配引号或无法安全解析，保守拦截")
            return []  # unreachable
        operator_tokens = {'&&', '||', ';', '|', '&', '\n'}
        segs: list = []
        current: list = []
        for tok in raw_tokens:
            if tok in operator_tokens:
                if current:
                    segs.append(current)
                    current = []
            else:
                current.append(tok)
        if current:
            segs.append(current)
        return segs

    def strip_env_assignments(tokens: list) -> list:
        idx = 0
        while idx < len(tokens) and _env_assign_re.match(tokens[idx]):
            idx += 1
        return tokens[idx:]

    # env / sudo / xargs 等包装命令：剥离后继续检测真正的可执行文件
    _WRAPPER_CMDS = {'env', 'command', 'sudo', 'xargs'}
    # bash/sh/pwsh 等：遇到 -c / -Command 时递归解析内层命令字符串
    _SHELL_CMDS   = {'bash', 'sh', 'zsh', 'dash', 'pwsh', 'powershell'}
    _WRAPPER_FLAGS_WITH_VALUE: dict = {
        'sudo':    {'-u', '--user', '-g', '--group', '-p', '--prompt',
                    '-C', '--chdir', '-c', '-r', '--role', '-t', '--type',
                    '-U', '--other-user', '-T'},
        'env':     {'-u', '--unset', '-C', '--chdir', '-S', '--split-string'},
        'xargs':   {'-I', '-n', '--max-args', '-P', '--max-procs',
                    '-s', '--max-chars', '-a', '--arg-file',
                    '-d', '--delimiter', '-E', '-L', '--max-lines'},
        'command': set(),
    }

    def strip_wrappers(tokens: list):
        """生成器：剥离包装命令，yield 真正要执行的 token 列表。"""
        while tokens:
            head = tokens[0].lower()
            if head in _SHELL_CMDS:
                # 在剩余 token 中寻找 -c（bash/sh）或 -Command（PowerShell）
                i = 1
                while i < len(tokens):
                    tok = tokens[i]
                    is_bash_c = (
                        tok == '-c' or
                        (tok.startswith('-') and not tok.startswith('--') and 'c' in tok[1:])
                    )
                    is_ps_cmd = (
                        head in {'pwsh', 'powershell'} and
                        tok.lower() in ('-command', '-c')
                    )
                    if (is_bash_c or is_ps_cmd) and i + 1 < len(tokens):
                        inner = tokens[i + 1]
                        for iseg in split_shell_segments(inner):
                            itoks = strip_env_assignments(iseg)
                            yield from strip_wrappers(itoks)
                        return
                    if not tokens[i].startswith('-'):
                        break
                    i += 1
                return
            if head not in _WRAPPER_CMDS:
                break
            value_flags = _WRAPPER_FLAGS_WITH_VALUE.get(head, set())
            tokens = tokens[1:]
            while tokens:
                tok = tokens[0]
                if not tok.startswith('-'):
                    break
                tokens = tokens[1:]            # 消耗标志本身
                if tok in value_flags and tokens:
                    tokens = tokens[1:]        # 消耗标志的参数值
            # 剥离包装命令后可能紧跟的 VAR=val（env VAR=val git push）
            while tokens and _env_assign_re.match(tokens[0]):
                tokens = tokens[1:]
        if tokens:
            yield tokens

    def skip_git_global_options(tokens: list) -> list:
        idx = 1
        _flags_val = {'-C', '--git-dir', '--work-tree', '--namespace',
                      '--exec-path', '--super-prefix', '--config-env', '-c'}
        _flags_noval = {'--bare', '--no-pager', '--paginate',
                        '--no-replace-objects', '--help', '-p', '-P', '--version'}
        while idx < len(tokens):
            tok = tokens[idx]
            if tok == '--':
                idx += 1; break
            if tok in _flags_val:
                idx += 2; continue
            if (tok.startswith('--git-dir=') or tok.startswith('--work-tree=') or
                    tok.startswith('--namespace=') or tok.startswith('--exec-path=') or
                    tok.startswith('--super-prefix=') or tok.startswith('--config-env=') or
                    (tok.startswith('-C') and tok != '-C') or
                    (tok.startswith('-c') and tok != '-c')):
                idx += 1; continue
            if tok in _flags_noval or tok.startswith('-'):
                idx += 1; continue
            break
        return tokens[idx:]

    def skip_gh_global_options(tokens: list) -> list:
        idx = 1
        _flags_val   = {'-R', '--repo', '--hostname', '--config-dir'}
        _flags_noval = {'--help', '-h', '--version'}
        while idx < len(tokens):
            tok = tokens[idx]
            if tok == '--':
                idx += 1; break
            if tok in _flags_val:
                idx += 2; continue
            if (tok.startswith('--repo=') or tok.startswith('--hostname=') or
                    tok.startswith('--config-dir=')):
                idx += 1; continue
            if tok in _flags_noval or tok.startswith('-'):
                idx += 1; continue
            break
        return tokens[idx:]

    def inspect_tokens(tokens: list):
        """返回拦截原因字符串，或 None 表示放行。"""
        if not tokens:
            return None
        # 标准化：剥除前导反斜杠、Windows 路径分隔符、取 basename、去 .exe
        tool_raw = tokens[0].lstrip('\\').replace('\\', '/')
        tool = os.path.basename(tool_raw).lower()
        if tool.endswith('.exe'):
            tool = tool[:-4]
        if not tool:
            return None

        if tool == 'git':
            rest = skip_git_global_options(tokens)
            if not rest:
                return None
            subcmd = rest[0].lower()
            if subcmd in {'add', 'commit', 'push', 'reset', 'restore',
                          'rm', 'merge', 'rebase', 'cherry-pick'}:
                return 'git 写操作 / 历史变更操作'
            if subcmd == 'tag':
                _tag_write = {'-a', '--annotate', '-d', '--delete', '-f', '--force',
                              '-s', '--sign', '-m', '--message', '-u', '--local-user',
                              '-F', '--file'}
                ta = [a.lower() for a in rest[1:]]
                if any(a in _tag_write for a in ta):
                    return 'git tag 写操作（创建/删除标签）'
                # git tag <name> 无任何标志 → 隐式创建
                if not any(a.startswith('-') for a in ta) and any(not a.startswith('-') for a in ta):
                    return 'git tag 写操作（创建/删除标签）'
            if subcmd == 'branch':
                ba = [a.lower() for a in rest[1:]]
                if any(a in {'-d', '-D', '--delete'} for a in ba):
                    return 'git 删除分支'
            if subcmd == 'stash':
                verb = next((a.lower() for a in rest[1:] if not a.startswith('-')), '')
                if verb in {'drop', 'pop', 'clear'}:
                    return 'git stash 销毁操作'

        elif tool == 'gh':
            rest = skip_gh_global_options(tokens)
            if len(rest) >= 2:
                sub, act = rest[0].lower(), rest[1].lower()
                if sub == 'pr' and act in {'create', 'merge', 'close', 'edit'}:
                    return 'gh PR 操作（create/merge/close/edit）'
                if sub == 'release' and act == 'create':
                    return 'gh release create（创建发布版本）'
                if sub == 'repo' and act == 'delete':
                    return 'gh repo delete（删除仓库）'
                if sub == 'issue' and act in {'close', 'delete'}:
                    return 'gh issue close/delete'

        return None

    for seg_tokens in split_shell_segments(cmd):
        tokens = strip_env_assignments(seg_tokens)
        for toks in strip_wrappers(tokens):
            reason = inspect_tokens(toks)
            if reason:
                _emit_ask(reason, cmd)

    sys.exit(0)


# ── 分支 2：GitHub MCP 写操作 ──────────────────────────────────────────────────

_MCP_WRITE_RE = re.compile(
    r'^mcp_github_((create|merge|push|update)_.+|fork_repository|add_issue_comment)$',
    re.IGNORECASE,
)

if _MCP_WRITE_RE.match(_tool_name):
    _keys = ['title', 'path', 'branch', 'base', 'head',
             'pull_number', 'issue_number', 'owner', 'repo']
    _parts = [f"{k}={str(_tool_input.get(k, ''))[:60]}" for k in _keys if k in _tool_input]
    _summary = ', '.join(_parts) if _parts else '(无参数摘要)'
    _emit_ask(f"GitHub MCP 写操作: {_tool_name}", _summary)

sys.exit(0)
