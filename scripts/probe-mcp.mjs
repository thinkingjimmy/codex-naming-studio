/**
 * - [INPUT]: 依赖 MCP client、临时目录与 Naming Product stdio MCP server。
 * - [OUTPUT]: 对外提供 MCP 工具、状态闭环与 native widget HTML 的快速探针。
 * - [POS]: scripts 的质量门禁，验证插件不是“能构建但不能被 Codex 打开”的假成功。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["./scripts/start-mcp.mjs"],
});

const client = new Client({
  name: "naming-product-probe",
  version: "0.1.0",
});

await client.connect(transport);

try {
  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name);
  const requiredTools = [
    "render_naming_product_widget",
    "get_naming_product_state",
    "save_naming_product_request",
    "save_naming_product_result",
  ];
  for (const toolName of requiredTools) {
    if (!toolNames.includes(toolName)) throw new Error(`${toolName} not found. Tools: ${toolNames.join(", ")}`);
  }

  const projectDir = await mkdtemp(path.join(tmpdir(), "naming-product-probe-"));
  const render = await client.callTool({
    name: "render_naming_product_widget",
    arguments: { projectDir, title: "Probe Naming Product" },
  });
  if (render._meta?.["openai/outputTemplate"] !== "ui://widget/naming-product/workbench.html") {
    throw new Error("Render tool did not include expected outputTemplate.");
  }
  if (render.structuredContent?.projectDir !== projectDir) {
    throw new Error("Render tool did not preserve projectDir.");
  }

  const requestId = "probe-request";
  const saveRequest = await client.callTool({
    name: "save_naming_product_request",
    arguments: {
      projectDir,
      request: {
        id: requestId,
        batch: 1,
        source: "probe",
        profile: {
          surname: "林",
          gender: "boy",
          birthDate: "2024-05-20",
          birthTime: "10:18",
        },
      },
    },
  });
  if (saveRequest.isError) {
    throw new Error(saveRequest.content?.find((item) => item.type === "text")?.text || "save_naming_product_request failed.");
  }
  const saveResult = await client.callTool({
    name: "save_naming_product_result",
    arguments: {
      projectDir,
      requestId,
      result: {
        provider: "probe",
        model: "probe-model",
        candidates: [
          {
            given: "景和",
            score: 94,
            grade: "极佳",
            elements: ["木", "火"],
            summary: "景星庆云，惠风和畅。",
            risk: "风险低",
            poems: "景明春和。",
            metrics: [24, 18, 14, 19, 9, 10],
          },
        ],
      },
    },
  });
  if (saveResult.isError) {
    throw new Error(saveResult.content?.find((item) => item.type === "text")?.text || "save_naming_product_result failed.");
  }
  const state = await client.callTool({
    name: "get_naming_product_state",
    arguments: { projectDir },
  });
  if (state.structuredContent?.latestResult?.candidates?.[0]?.fullName !== "林景和") {
    throw new Error("Saved result was not normalized and exposed to widget state.");
  }

  const resource = await client.readResource({ uri: "ui://widget/naming-product/workbench.html" });
  const html = resource.contents?.[0]?.text || "";
  if (!html.includes("window.namingProductMcp") || !html.includes("Naming Product")) {
    throw new Error("Widget HTML does not include the Naming Product bridge and shell.");
  }
  const shell = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
  if (/<script\b[^>]+\bsrc=/i.test(shell) || /<link\b[^>]+\bhref=(?!["']data:)/i.test(shell) || /<iframe\b/i.test(shell)) {
    throw new Error("Widget HTML keeps external shell resources.");
  }

  console.log("OK: Naming Product MCP tools and native widget resource are available.");
} finally {
  await client.close();
}
