/**
 * - [INPUT]: 依赖 MCP client、临时目录与 Naming Product stdio MCP server。
 * - [OUTPUT]: 对外提供 MCP 状态工具与约束路由的快速探针。
 * - [POS]: scripts 的质量门禁，验证 Codex 侧读请求、写结果的闭环不是假成功。
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
    "get_naming_product_state",
    "save_naming_product_request",
    "save_naming_product_result",
  ];
  for (const toolName of requiredTools) {
    if (!toolNames.includes(toolName)) throw new Error(`${toolName} not found. Tools: ${toolNames.join(", ")}`);
  }

  const projectDir = await mkdtemp(path.join(tmpdir(), "naming-product-probe-"));
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
          preferredChars: "家",
          filters: { popularName: true },
        },
      },
    },
  });
  if (saveRequest.isError) {
    throw new Error(saveRequest.content?.find((item) => item.type === "text")?.text || "save_naming_product_request failed.");
  }
  const planIds = (saveRequest.structuredContent?.request?.plan || []).map((step) => step.id);
  for (const expected of ["bazi-analysis", "research-popular-names", "include-preferred-chars"]) {
    if (!planIds.includes(expected)) {
      throw new Error(`Constraint routing did not derive plan step ${expected}. Got: ${planIds.join(", ")}`);
    }
  }
  if (planIds.includes("skip-bazi")) {
    throw new Error("skip-bazi step must not appear when useBazi is enabled.");
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
    throw new Error("Saved result was not normalized and exposed to workbench state.");
  }
  if (state.structuredContent?.requests?.[requestId]?.status !== "completed") {
    throw new Error("Request did not reach completed status after result save.");
  }

  console.log("OK: Naming Product MCP state tools and constraint routing are working.");
} finally {
  await client.close();
}
