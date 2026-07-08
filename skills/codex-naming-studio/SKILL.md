---
name: codex-naming-studio
description: Open and operate the native Codex Naming Studio widget. Use when the user asks to open, launch, install, or use the naming product GUI, or when a widget follow-up message contains NAMING_PRODUCT_REQUEST_ID and Codex must compute Chinese baby name candidates and write results back to the GUI.
---

# Codex Naming Studio

## Open The Widget

Use the MCP `render_naming_product_widget` tool. Pass the user's active workspace as `projectDir`; do not pass the plugin repository unless the user is developing the plugin itself.

```json
{
  "projectDir": "/absolute/path/to/user/workspace"
}
```

The tool returns `openai/outputTemplate: ui://widget/naming-product/workbench.html`, which tells Codex to render the GUI as a native widget. Normal use does not require starting a localhost page.

## Handle A GUI Generate Request

When a follow-up message contains `NAMING_PRODUCT_REQUEST_ID: <id>`, the user is waiting in the widget loading state.

1. Call `get_naming_product_state` with the active `projectDir`.
2. Locate the pending request by id and read `profile`.
3. Generate 8-12 Chinese name candidates with concise but complete reasoning.
4. Call `save_naming_product_result` with the same `requestId`.
5. Tell the user the GUI has been updated.

Use this candidate shape:

```json
{
  "given": "景和",
  "score": 94,
  "grade": "极佳",
  "elements": ["木", "火"],
  "summary": "景星庆云，惠风和畅，光明温润。",
  "risk": "风险低",
  "poems": "景明春和，万物有光。",
  "metrics": [24, 18, 14, 19, 9, 10],
  "analysis": "日主与出生时空的简析。"
}
```

`metrics` order is: 八字五行、音律音调、字形结构、寓意内涵、避讳风险、风格匹配. Keep scores within their UI maxima: `[25, 20, 15, 20, 10, 10]`.

If generation fails, still call `save_naming_product_result` with `result.error` so the widget can leave loading state.

## Taste Rules

Return structured data, not prose-only answers. The GUI is the product surface; chat is only the control plane.
