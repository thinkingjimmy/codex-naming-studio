/**
 * - [INPUT]: 依赖 MCP client、真实临时目录/状态字节与 Naming Product stdio MCP server。
 * - [OUTPUT]: 验证请求→claimId→栅栏回写、纯读、triggerRevision、约束路由与 widget 资源闭环。
 * - [POS]: scripts 的协议质量门禁，确保 MCP instructions、工具描述与状态事务不是假成功。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { mkdtemp, readFile } from "node:fs/promises";
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
    "claim_naming_product_request",
    "save_naming_product_result",
    "render_naming_workbench_widget",
  ];
  for (const toolName of requiredTools) {
    if (!toolNames.includes(toolName)) throw new Error(`${toolName} not found. Tools: ${toolNames.join(", ")}`);
  }
  const instructions = client.getInstructions() || "";
  for (const keyword of ["claim_naming_product_request", "claimId", "save_naming_product_result", "abandon"]) {
    if (!instructions.includes(keyword)) {
      throw new Error(`Server instructions missing claim chain keyword: ${keyword}`);
    }
  }
  const claimDescription = tools.tools.find((tool) => tool.name === "claim_naming_product_request")?.description || "";
  const resultDescription = tools.tools.find((tool) => tool.name === "save_naming_product_result")?.description || "";
  if (!claimDescription.includes("claimId") || !resultDescription.includes("claimId")) {
    throw new Error("Claim/result tool descriptions must state the claimId writeback chain.");
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
          fullNameLength: 3,
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
  const savedProfile = saveRequest.structuredContent?.request?.profile || {};
  if (savedProfile.fullNameLength !== 3 || Object.hasOwn(savedProfile, "nameLength")) {
    throw new Error("Profile length semantics must persist as fullNameLength only.");
  }
  for (const expected of ["name-length", "bazi-analysis", "research-popular-names", "style-preferences", "include-preferred-chars"]) {
    if (!planIds.includes(expected)) {
      throw new Error(`Constraint routing did not derive plan step ${expected}. Got: ${planIds.join(", ")}`);
    }
  }
  if (planIds.includes("skip-bazi")) {
    throw new Error("skip-bazi step must not appear when useBazi is enabled.");
  }

  const newerRequestId = "probe-request-newer";
  const saveNewerRequest = await client.callTool({
    name: "save_naming_product_request",
    arguments: {
      projectDir,
      request: {
        id: newerRequestId,
        batch: 2,
        source: "probe",
        profile: {
          surname: "林",
          gender: "boy",
          fullNameLength: 3,
          birthDate: "2024-05-20",
          birthTime: "10:18",
          filters: { popularName: true },
        },
      },
    },
  });
  if (saveNewerRequest.isError) {
    throw new Error(saveNewerRequest.content?.find((item) => item.type === "text")?.text || "newer save_naming_product_request failed.");
  }
  if (saveNewerRequest.structuredContent?.requests?.[requestId]?.status !== "superseded") {
    throw new Error("Older pending request must be superseded when a newer request is saved.");
  }
  if (saveNewerRequest.structuredContent?.latestPendingRequest?.id !== newerRequestId) {
    throw new Error("latestPendingRequest must point at the newest active pending request.");
  }

  const stateFile = path.join(projectDir, ".naming-product", "state.json");
  const triggerFile = path.join(projectDir, ".naming-product", "trigger.json");
  const triggerAfterRequests = JSON.parse(await readFile(triggerFile, "utf8"));
  if (triggerAfterRequests.triggerRevision !== 2) {
    throw new Error(`Trigger must advance once per request. Got ${triggerAfterRequests.triggerRevision}.`);
  }

  const firstClaim = await client.callTool({
    name: "claim_naming_product_request",
    arguments: { projectDir, requestId: newerRequestId },
  });
  if (firstClaim.isError || !firstClaim.structuredContent?.claimId) {
    throw new Error("First claim must return claimId.");
  }
  if (firstClaim.structuredContent?.request?.status !== "processing") {
    throw new Error("Claimed request must enter processing.");
  }
  if (firstClaim.structuredContent?.latestPendingRequest !== null) {
    throw new Error("latestPendingRequest must exclude processing.");
  }
  if (firstClaim.structuredContent?.latestActiveRequest?.id !== newerRequestId) {
    throw new Error("latestActiveRequest must expose processing request.");
  }

  const secondClaim = await client.callTool({
    name: "claim_naming_product_request",
    arguments: { projectDir, requestId: newerRequestId },
  });
  const firstClaimId = firstClaim.structuredContent.claimId;
  const secondClaimId = secondClaim.structuredContent?.claimId;
  if (secondClaim.isError || !secondClaimId || secondClaimId === firstClaimId) {
    throw new Error("Processing re-claim must return a fresh claimId.");
  }
  if (secondClaim.structuredContent?.request?.claimOwner?.claimId !== secondClaimId) {
    throw new Error("claimOwner must track the newest claimId.");
  }

  const bytesBeforeGet = await readFile(stateFile);
  await client.callTool({
    name: "get_naming_product_state",
    arguments: { projectDir },
  });
  const bytesAfterGet = await readFile(stateFile);
  if (!bytesBeforeGet.equals(bytesAfterGet)) {
    throw new Error("get_naming_product_state must be byte-for-byte read-only.");
  }

  const staleClaimResult = await client.callTool({
    name: "save_naming_product_result",
    arguments: {
      projectDir,
      requestId: newerRequestId,
      claimId: firstClaimId,
      result: { candidates: [{ given: "旧认领", score: 80 }] },
    },
  });
  if (!staleClaimResult.isError || !JSON.stringify(staleClaimResult).includes("CLAIM_MISMATCH")) {
    throw new Error("Old claimId result write must be rejected explicitly.");
  }

  const staleResult = await client.callTool({
    name: "save_naming_product_result",
    arguments: {
      projectDir,
      requestId,
      claimId: "superseded-has-no-valid-claim",
      result: {
        provider: "probe",
        model: "probe-model",
        candidates: [{ given: "旧名", score: 80 }],
      },
    },
  });
  if (!staleResult.isError) {
    throw new Error("Superseded requests must reject stale result writes.");
  }

  const saveResult = await client.callTool({
    name: "save_naming_product_result",
    arguments: {
      projectDir,
      requestId: newerRequestId,
      claimId: secondClaimId,
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
  if (state.structuredContent?.requests?.[newerRequestId]?.status !== "completed") {
    throw new Error("Request did not reach completed status after result save.");
  }
  if (state.structuredContent?.requests?.[requestId]?.status !== "superseded") {
    throw new Error("Superseded request status did not persist after newer result save.");
  }
  const triggerAfterClaimsAndResult = JSON.parse(await readFile(triggerFile, "utf8"));
  if (triggerAfterClaimsAndResult.triggerRevision !== 2) {
    throw new Error("Claim/result mutations must not advance triggerRevision.");
  }

  const lengthRequestId = "probe-name-length";
  await client.callTool({
    name: "save_naming_product_request",
    arguments: {
      projectDir,
      request: {
        id: lengthRequestId,
        batch: 0,
        source: "probe",
        profile: {
          surname: "王",
          fullNameLength: 3,
        },
      },
    },
  });
  const lengthClaim = await client.callTool({
    name: "claim_naming_product_request",
    arguments: { projectDir, requestId: lengthRequestId },
  });
  await client.callTool({
    name: "save_naming_product_result",
    arguments: {
      projectDir,
      requestId: lengthRequestId,
      claimId: lengthClaim.structuredContent?.claimId,
      result: {
        provider: "probe",
        model: "probe-model",
        candidates: [{ given: "昱", score: 94 }],
      },
    },
  });
  const lengthState = await client.callTool({
    name: "get_naming_product_state",
    arguments: { projectDir },
  });
  const lengthCandidate = lengthState.structuredContent?.requests?.[lengthRequestId]?.result?.candidates?.[0];
  if (Array.from(lengthCandidate?.given || "").length !== 2 || lengthCandidate?.fullName === "王昱") {
    throw new Error(`Three-character-name guard failed. Got: ${lengthCandidate?.fullName || "<empty>"}`);
  }

  // ------------------------------------------------------------
  // Widget 闭环：渲染工具回显 projectDir，资源读取触发真实惰性构建，
  // 断言产物是 CSP 兼容的单文件 HTML 且带宿主桥。
  // ------------------------------------------------------------
  const widgetUri = "ui://widget/naming/workbench.html";
  const renderWidget = await client.callTool({
    name: "render_naming_workbench_widget",
    arguments: { projectDir },
  });
  if (renderWidget.isError) {
    throw new Error(renderWidget.content?.find((item) => item.type === "text")?.text || "render_naming_workbench_widget failed.");
  }
  if (renderWidget.structuredContent?.projectDir !== projectDir) {
    throw new Error("Render tool must echo the absolute projectDir into structuredContent.");
  }
  if (renderWidget.structuredContent?.preferredDisplayMode !== "fullscreen") {
    throw new Error("Render tool must default preferredDisplayMode to fullscreen.");
  }

  const resource = await client.readResource({ uri: widgetUri });
  const widgetContent = resource.contents?.[0];
  if (!widgetContent?._meta?.["openai/widgetCSP"]) {
    throw new Error("Widget resource must carry openai/widgetCSP metadata.");
  }
  const widgetHtml = widgetContent.text || "";
  for (const [marker, label] of [
    ["window.namingMcp", "host bridge api"],
    ["__NAMING_WIDGET_FETCH_GUARD__", "fetch guard"],
    ["__NAMING_MCP_APPS__", "ext-apps bundle"],
  ]) {
    if (!widgetHtml.includes(marker)) throw new Error(`Widget HTML is missing ${label} (${marker}).`);
  }
  const widgetShell = widgetHtml
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
  if (/<script\b[^>]*\btype\s*=\s*["']module["']/i.test(widgetShell) || /<link\b[^>]+\bhref\s*=/i.test(widgetShell)) {
    throw new Error("Widget HTML must not reference module scripts or external stylesheets.");
  }

  console.log("OK: Naming Product MCP state tools, constraint routing, and the native widget resource are working.");
} finally {
  await client.close();
}
