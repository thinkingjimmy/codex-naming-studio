---
name: naming-studio-generate
description: Compute Chinese baby name candidates for a pending Codex Naming Studio request and write structured results back to the workbench. Use when the request watcher reports a pending naming request, or the user asks to handle, retry, or finish a pending naming request.
---

# Naming Studio Generate

## Workflow

A pending request means the user is waiting in the workbench loading state. Work fast and write results back; do not answer in prose only.

1. Take the request from the watcher output (`scripts/watch-naming-request.mjs`), or call `get_naming_product_state` with the active `projectDir` and locate the pending request by id.
2. Read `profile` (surname, gender, calendar, birth date/time, name length, preferred/blocked characters, tone sliders, filters) and `plan` — the ordered steps derived from the user's GUI selections.
3. Execute the plan:
   - Steps with a `skill` field must run first. `naming-studio-bazi` derives the four-pillar chart and favorable elements from the birth time; `naming-studio-research` gathers external facts (popular-name blocklists, homophone audits).
   - Steps without a `skill` field are hard constraints; every generated candidate must satisfy all of them. When the plan contains the skip-bazi step, do not run any five-elements reasoning: leave `elements` as an empty array, `distribution`/`branches` as null, and the first metric as null.
4. Generate 8-12 Chinese given-name candidates yourself, using naming expertise: 姓名学、音律、字形、寓意、五行喜用与避讳. Do not call any external API and never ask for an API key — Codex's own reasoning is the model; research steps use built-in web search only.
5. Call `save_naming_product_result` with the same `requestId` and the candidates.
6. Tell the user briefly that the GUI has been updated.

## Candidate Shape

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

`metrics` order is: 八字五行、音律音调、字形结构、寓意内涵、避讳风险、风格匹配. Keep each value within its UI maximum: `[25, 20, 15, 20, 10, 10]`. `risk` must be one of 风险极低 / 风险低 / 风险中 / 风险高. Scores stay within 80-99 and must be consistent with metrics.

## Failure Path

If generation fails for any reason, still call `save_naming_product_result` with `result.error` set to a short Chinese explanation so the workbench can leave loading state. Never leave the GUI spinning.

## Taste Rules

Return structured data, not prose-only answers. The GUI is the product surface; chat is only the control plane.
