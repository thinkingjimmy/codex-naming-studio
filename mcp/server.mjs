/**
 * - [INPUT]: 依赖 MCP SDK、ext-apps、zod、naming-state 的纯读/请求/claim/结果事务与 widget 构建桥接。
 * - [OUTPUT]: 注册 widget 资源/渲染工具及 get/save-request/claim/save-result 四个状态工具，instructions 固化 claimId 回写链路。
 * - [POS]: mcp 的唯一协议入口；只做参数/工具边界，所有并发 mutation 与 claim 栅栏下沉到 naming-state。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { readFileSync } from "node:fs";

import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { NAMING_STATIC_BUILD_DIR, namingStaticHtml } from "./lib/naming-static-widget.mjs";
import {
  claimNamingRequest,
  nonEmpty,
  publicState,
  readStateUnlocked,
  repairTriggerFile,
  resolveNamingPaths,
  saveNamingRequest,
  saveNamingResult,
} from "./lib/naming-state.mjs";
import { pluginPath } from "./lib/plugin-root.mjs";
import { injectMcpHostBridge, registerWidgetResource } from "./lib/widget-resource.mjs";

const TOOL_GET_STATE = "get_naming_product_state";
const TOOL_SAVE_REQUEST = "save_naming_product_request";
const TOOL_CLAIM_REQUEST = "claim_naming_product_request";
const TOOL_SAVE_RESULT = "save_naming_product_result";
const TOOL_RENDER_WIDGET = "render_naming_workbench_widget";
const NAMING_WIDGET_URI = "ui://widget/naming/workbench.html";
const DEFAULT_DISPLAY_MODE = "fullscreen";

const manifest = JSON.parse(readFileSync(pluginPath(".codex-plugin", "plugin.json"), "utf8"));
const projectArgsSchema = {
  projectDir: z.string().trim().optional(),
  stateDir: z.string().trim().optional(),
};

const server = new McpServer(
  {
    name: manifest.name,
    version: manifest.version,
  },
  {
    instructions:
      "Use render_naming_workbench_widget to open the workbench. To process a request, first call claim_naming_product_request and retain its claimId, then compute candidates, then call save_naming_product_result with the same requestId and claimId. If claimId is rejected, reload state and abandon that result; never overwrite another claimant.",
  },
);

registerNamingWidget(server);
registerStateTools(server);

await repairTriggerFile().catch((error) => {
  console.error(`[naming-state] MCP startup trigger repair failed: ${error.message}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);

// ============================================================
// Widget 注册：资源惰性构建 + 渲染工具。widgetData 会成为
// window.openai.toolOutput，是 widget 侧所有工具调用的 projectDir 来源。
// ============================================================
function registerNamingWidget(mcpServer) {
  registerWidgetResource(mcpServer, {
    name: "naming-workbench-widget",
    uri: NAMING_WIDGET_URI,
    title: "Naming Studio Workbench",
    description:
      "A native Codex widget that renders the naming workbench directly and persists requests/results in the active project's state file.",
    resourceDomains: ["data:", "blob:"],
    html: async () => injectMcpHostBridge(await namingStaticHtml(), {
      initialDisplayMode: DEFAULT_DISPLAY_MODE,
    }),
  });

  registerAppTool(
    mcpServer,
    TOOL_RENDER_WIDGET,
    {
      title: "Render Naming Workbench Widget",
      description:
        "Open the native naming workbench widget for the active Codex project. Pass projectDir for the user's workspace so state is stored under <projectDir>/.naming-product.",
      inputSchema: {
        ...projectArgsSchema,
        title: z.string().trim().optional(),
        displayMode: z.enum(["fullscreen", "inline"]).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: NAMING_WIDGET_URI,
          visibility: ["model", "app"],
        },
        "ui/resourceUri": NAMING_WIDGET_URI,
        "openai/outputTemplate": NAMING_WIDGET_URI,
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "打开起名工作台...",
        "openai/toolInvocation/invoked": "起名工作台已就绪",
      },
    },
    async (input = {}) => {
      const { projectDir, stateDir, stateFile } = resolveNamingPaths(input);
      const title = nonEmpty(input.title) || "起名工作台";
      const preferredDisplayMode = input.displayMode === "inline" ? "inline" : DEFAULT_DISPLAY_MODE;
      const payload = {
        title,
        rendering: "native-widget",
        staticDir: NAMING_STATIC_BUILD_DIR,
        projectDir,
        stateDir,
        stateFile,
        preferredDisplayMode,
      };

      return {
        content: [{ type: "text", text: "Rendered naming workbench widget." }],
        structuredContent: {
          version: 1,
          widget: "naming-workbench-widget",
          ...payload,
        },
        _meta: {
          "openai/outputTemplate": NAMING_WIDGET_URI,
          widgetData: payload,
        },
      };
    },
  );
}

function registerStateTools(mcpServer) {
  mcpServer.registerTool(
    TOOL_GET_STATE,
    {
      title: "Get Naming Product State",
      description: "Purely read pending/processing requests, claimOwner, and completed results; this tool never repairs files or wakes an Agent.",
      inputSchema: projectArgsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input = {}) => {
      const state = await readStateUnlocked(input);
      return {
        content: [{ type: "text", text: `Loaded Naming Product state from ${state.paths.stateFile}.` }],
        structuredContent: publicState(state),
      };
    },
  );

  mcpServer.registerTool(
    TOOL_SAVE_REQUEST,
    {
      title: "Save Naming Product Request",
      description: "Commit a new pending naming request and publish its trigger. committed=true means callers must poll even when triggerLagging=true.",
      inputSchema: {
        ...projectArgsSchema,
        request: z.object({
          id: z.string().trim(),
          profile: z.any(),
          batch: z.number().optional(),
          source: z.string().trim().optional(),
        }),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input = {}) => {
      let saved;
      try {
        saved = await saveNamingRequest(input, input.request || {});
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: error instanceof Error ? error.message : "Invalid request." }],
        };
      }
      const id = saved.requestId;
      return {
        content: [{ type: "text", text: `Saved Naming Product request ${id}.` }],
        structuredContent: {
          requestId: id,
          committed: saved.committed,
          triggerLagging: saved.triggerLagging,
          request: saved.state.requests[id],
          ...publicState(saved.state),
        },
      };
    },
  );

  mcpServer.registerTool(
    TOOL_CLAIM_REQUEST,
    {
      title: "Claim Naming Product Request",
      description: "Claim a pending or processing request and return a fresh claimId. Keep that claimId and pass it to save_naming_product_result; a later claimant fences stale results.",
      inputSchema: {
        ...projectArgsSchema,
        requestId: z.string().trim().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input = {}) => {
      try {
        const claimed = await claimNamingRequest(input, input.requestId);
        return {
          content: [{ type: "text", text: `Claimed Naming Product request ${claimed.request.id}; retain claimId ${claimed.claimId} for result writeback.` }],
          structuredContent: {
            claimId: claimed.claimId,
            request: claimed.request,
            ...publicState(claimed.state),
          },
        };
      } catch (error) {
        return stateError(error);
      }
    },
  );

  mcpServer.registerTool(
    TOOL_SAVE_RESULT,
    {
      title: "Save Naming Product Result",
      description: "Write candidates only after claim_naming_product_request. requestId and its matching claimId are both required; rejected claimId means reload state and abandon the stale result.",
      inputSchema: {
        ...projectArgsSchema,
        requestId: z.string().trim(),
        claimId: z.string().trim(),
        result: z.object({
          profile: z.any().optional(),
          batch: z.number().optional(),
          provider: z.string().trim().optional(),
          model: z.string().trim().optional(),
          notice: z.string().trim().optional(),
          candidates: z.array(z.any()).optional(),
          error: z.string().trim().optional(),
        }),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input = {}) => {
      try {
        const saved = await saveNamingResult(input, input);
        const requestId = nonEmpty(input.requestId);
        const error = saved.request.status === "error";
        return {
          content: [{ type: "text", text: error ? `Saved Naming Product error for ${requestId}.` : `Saved Naming Product result for ${requestId}.` }],
          structuredContent: {
            request: saved.request,
            ...publicState(saved.state),
          },
        };
      } catch (error) {
        return stateError(error);
      }
    },
  );
}

function stateError(error) {
  const code = nonEmpty(error?.code) || "NAMING_STATE_ERROR";
  const message = error instanceof Error ? error.message : "Invalid naming state mutation.";
  return {
    isError: true,
    content: [{ type: "text", text: `${code}: ${message}` }],
    structuredContent: { code },
  };
}
