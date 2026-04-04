# lean-ctx — Context Engineering Layer

MANDATORY: Use lean-ctx MCP tools for ALL reads, searches, and shell commands.

| FORBIDDEN | USE INSTEAD |
|-----------|-------------|
| Read / cat / head / tail | `ctx_read(path)` — cached, 8 compression modes, re-reads ~13 tokens |
| Shell / bash / terminal | `ctx_shell(command)` — pattern compression for git/npm/cargo output |
| Grep / rg / search | `ctx_search(pattern, path)` — compact, token-efficient results |
| ls / find / tree | `ctx_tree(path, depth)` — compact directory maps |

Keep using Write, StrReplace, Delete, Glob normally (no lean-ctx replacement).

REMINDER: NEVER use native Read, Shell, Grep, or ls. ALWAYS use ctx_read, ctx_shell, ctx_search, ctx_tree.
