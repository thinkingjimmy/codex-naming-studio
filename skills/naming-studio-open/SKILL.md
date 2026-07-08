---
name: naming-studio-open
description: Open the native Naming Studio workbench widget inside Codex, or fall back to the localhost workbench. Use when the user asks to open, launch, start, or use the naming workbench, the baby naming GUI, or 起名工作台.
---

# Naming Studio Open

The workbench is a native Codex widget backed by a state file in the user's project. The widget saves generate requests itself and wakes Codex with a follow-up chat message — no watcher process is needed in this mode. No API key is involved at any point.

## Primary workflow: native widget

1. Call the `render_naming_workbench_widget` MCP tool. Pass the user's active Codex workspace as `projectDir` — never the plugin repository directory:

```json
{
  "projectDir": "/absolute/path/to/user/codex-project"
}
```

The tool returns `openai/outputTemplate: ui://widget/naming/workbench.html`, which tells Codex to render the widget directly. Do not start `scripts/start-workbench.mjs`, do not open a localhost URL, and do not arm the request watcher for normal use. The first render per plugin version builds the widget bundle and can take up to a minute; later renders are cached.

2. Confirm the widget opens. State lives in `<projectDir>/.naming-product/state.json`; the widget reads and writes it through the MCP state tools.

3. Your turn is done after the widget renders. When the user clicks 生成好名, the widget saves the request and posts a chat message like 「处理起名请求 name-xxxx（项目目录 /path）…」 — handle that message with `$codex-naming-studio:naming-studio-generate`. The widget polls `get_naming_product_state` every 1.6s, so results appear automatically after `save_naming_product_result`.

4. If the render tool is not visible in the current session, use tool discovery. If the plugin was just installed or upgraded, tell the user a new Codex conversation may be required for the new MCP tool schema to load.

## Fallback workflow: localhost workbench

Use only when the widget fails to render (for example host session metadata errors) or the user explicitly asks for the browser workbench.

1. Start the workbench server in the background from the plugin directory:

```bash
NAMING_PROJECT_DIR=/absolute/path/to/user/workspace node scripts/start-workbench.mjs
```

It serves `http://127.0.0.1:43318` (override with `NAMING_WORKBENCH_PORT`). The startup script first probes `/api/naming-state`; if the port is already serving this same project, it exits 0 and prints the reused URL. If the port belongs to another project or another service, it exits non-zero so Codex should choose a different `NAMING_WORKBENCH_PORT` instead of blindly retrying.

2. Open `http://127.0.0.1:43318` in the Codex built-in browser.

3. Arm the request watcher (blocks until the user clicks 生成好名). The watcher only reports the active latest pending request; older pending requests are superseded by the state layer:

```bash
node scripts/watch-naming-request.mjs --project-dir /absolute/path/to/user/workspace --timeout 1800
```

- Exit 0: it prints the latest pending request JSON (profile + plan). Handle it with `$codex-naming-studio:naming-studio-generate`, then re-arm the watcher for the next request.
- Exit 2: timeout with no request. Tell the user the workbench is still open and they can say "继续等待起名请求" to re-arm.
- Exit for any other reason (harness command limit, interruption): the watcher is gone and GUI clicks will sit pending until the user speaks. Whenever your watcher stops for any reason, end your reply by telling the user: 工作台仍然打开；之后点击「生成好名」后，对我说「处理起名请求」即可继续。

**Important — in fallback mode the watcher is the only ear Codex has.** The localhost GUI cannot wake Codex by itself. In a fallback session, every time you finish a turn, first call `get_naming_product_state` (or run the watcher with a short `--timeout 5`) to check for a stranded `latestPendingRequest` and handle it before answering anything else. This rule does not apply to widget mode, where the widget posts its own follow-up messages.

## Constraints

Never ask for an OPENAI_API_KEY or call external model APIs — Codex's own reasoning is the model. Do not edit `state.json` by hand; always go through the MCP state tools so candidates get normalized.
