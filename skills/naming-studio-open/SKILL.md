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

It serves `http://127.0.0.1:43318` (override with `NAMING_WORKBENCH_PORT`). If the port is already serving the workbench, reuse it instead of starting a second copy.

2. Open `http://127.0.0.1:43318` in the Codex built-in browser so the user can fill the profile panel.

3. Arm the request watcher (blocks until the user clicks 生成好名):

```bash
node scripts/watch-naming-request.mjs --project-dir /absolute/path/to/user/workspace --timeout 1800
```

- Exit 0: it prints the pending request JSON (profile + plan). Handle it with `$codex-naming-studio:naming-studio-generate`, then re-arm the watcher for the next request.
- Exit 2: timeout with no request. Tell the user the workbench is still open and they can say "继续等待起名请求" to re-arm.

4. State lives in `<workspace>/.naming-product/state.json`. The GUI polls it through the server; you write results into it via the `save_naming_product_result` MCP tool.

## Constraints

Never ask for an OPENAI_API_KEY or call external model APIs — Codex's own reasoning is the model. Do not edit `state.json` by hand; always go through the MCP state tools so candidates get normalized.
