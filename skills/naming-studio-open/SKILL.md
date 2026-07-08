---
name: naming-studio-open
description: Start the Codex Naming Studio workbench and open it in the Codex built-in browser, then wait for GUI generate requests. Use when the user asks to open, launch, start, or use the naming workbench, the baby naming GUI, or 起名工作台.
---

# Naming Studio Open

The workbench is a local web app backed by a state file in the user's project. Codex starts it, opens it in the built-in browser, then watches the state file for generate requests. No API key is involved at any point.

## Workflow

1. Start the workbench server in the background from the plugin directory, pointing state at the user's active workspace:

```bash
NAMING_PROJECT_DIR=/absolute/path/to/user/workspace node scripts/start-workbench.mjs
```

It serves `http://127.0.0.1:43318` (override with `NAMING_WORKBENCH_PORT`). The startup script first probes `/api/naming-state`; if the port is already serving this same project, it exits 0 and prints the reused URL. If the port belongs to another project or another service, it exits non-zero so Codex should choose a different `NAMING_WORKBENCH_PORT` instead of blindly retrying.

2. Open `http://127.0.0.1:43318` in the Codex built-in browser so the user can fill the profile panel.

3. Arm the request watcher (blocks until the user clicks 生成好名). The watcher only reports the active latest pending request; older pending requests are superseded by the state layer:

```bash
node scripts/watch-naming-request.mjs --project-dir /absolute/path/to/user/workspace --timeout 1800
```

- Exit 0: it prints the latest pending request JSON (profile + plan). Handle it with `$codex-naming-studio:naming-studio-generate`, then re-arm the watcher for the next request. The watcher polls every 300ms by default; override with `--interval` only if needed.
- Exit 2: timeout with no request. Tell the user the workbench is still open and they can say "继续等待起名请求" to re-arm.
- Exit for any other reason (harness command limit, interruption): the watcher is gone and GUI clicks will sit pending until the user speaks. Whenever your watcher stops for any reason, end your reply by telling the user: 工作台仍然打开；之后点击「生成好名」后，对我说「处理起名请求」即可继续。

**Important — the watcher is the only ear Codex has.** The GUI cannot wake Codex by itself. Every time you finish a turn in a session where the workbench is open, first call `get_naming_product_state` (or run the watcher with a short `--timeout 5`) to check for a stranded `latestPendingRequest` and handle it before answering anything else.

4. State lives in `<workspace>/.naming-product/state.json`. The GUI polls it through the server; you write results into it via the `save_naming_product_result` MCP tool.

## Constraints

Never ask for an OPENAI_API_KEY or call external model APIs — Codex's own reasoning is the model. Do not edit `state.json` by hand; always go through the MCP state tools so candidates get normalized.
