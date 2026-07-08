---
name: naming-studio-open
description: Open the native Codex Naming Studio widget. Use when the user asks to open, launch, start, or use the naming workbench, the baby naming GUI, or 起名工作台 inside Codex.
---

# Naming Studio Open

## Workflow

1. Use the Naming Studio MCP `render_naming_product_widget` tool to open the workbench as a native Codex widget. Pass the user's active Codex workspace as `projectDir`; do not pass the plugin repository directory unless the user is developing the plugin itself.

```json
{
  "projectDir": "/absolute/path/to/user/codex-project"
}
```

The tool returns `openai/outputTemplate: ui://widget/naming-product/workbench.html`, which tells Codex to render the GUI directly. Normal use never opens a localhost page.

2. Confirm the widget opens. Request/result state is stored in the active project:

```text
.naming-product/state.json
```

3. Tell the user to fill the left profile panel and click 生成好名. The GUI will hand the request back to Codex automatically; no API key is needed at any point.

4. If the MCP tool is not visible in the current session, use tool discovery for Naming Studio widget/render capabilities. If the plugin was just installed or upgraded, tell the user a new Codex conversation may be required for the new MCP tool schema to load.

## Constraints

Do not run `pnpm dev`, start `server/llm-bridge.js`, open a localhost URL, or ask for an OPENAI_API_KEY. Those belong to the local-development fallback only. The native widget plus Codex's own reasoning is the whole product path.
