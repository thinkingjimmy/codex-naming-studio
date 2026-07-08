/**
 * - [INPUT]: 依赖 MCP SDK、ext-apps 的 registerAppTool、zod、naming-state 共享状态库、name-engine 标准化能力与 widget-resource/naming-static-widget 的 widget 构建桥接。
 * - [OUTPUT]: 对外注册 render_naming_workbench_widget 渲染工具、ui://widget/naming/workbench.html 资源与 get/save 三个状态工具。
 * - [POS]: mcp 的唯一协议入口；widget 模式下 GUI 经宿主桥直接调状态工具，兜底模式下浏览器 GUI 走 Vite 状态 middleware 读写同一份文件。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { readFileSync } from "node:fs";

import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { mergeProfile, normalizeCandidates, normalizeProfile } from "../src/lib/name-engine.js";
import { NAMING_STATIC_BUILD_DIR, namingStaticHtml } from "./lib/naming-static-widget.mjs";
import {
  nonEmpty,
  publicState,
  readState,
  resolveNamingPaths,
  saveNamingRequest,
  writeState,
} from "./lib/naming-state.mjs";
import { pluginPath } from "./lib/plugin-root.mjs";
import { injectMcpHostBridge, registerWidgetResource } from "./lib/widget-resource.mjs";

const TOOL_GET_STATE = "get_naming_product_state";
const TOOL_SAVE_REQUEST = "save_naming_product_request";
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
      "Use render_naming_workbench_widget to open the naming workbench as a native Codex widget (pass the user's workspace as projectDir). The widget saves requests itself and posts 处理起名请求 follow-up messages; call save_naming_product_result after Codex has produced structured name candidates so the workbench can leave loading state.",
  },
);

registerNamingWidget(server);
registerStateTools(server);

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
      description: "Read pending requests and completed results for the Naming Studio workbench.",
      inputSchema: projectArgsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input = {}) => {
      const state = await readState(input);
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
      description: "Persist a naming request (with derived plan) so Codex can read it and later write structured results.",
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
      const id = saved.latestRequestId;
      return {
        content: [{ type: "text", text: `Saved Naming Product request ${id}.` }],
        structuredContent: {
          request: saved.requests[id],
          ...publicState(saved),
        },
      };
    },
  );

  mcpServer.registerTool(
    TOOL_SAVE_RESULT,
    {
      title: "Save Naming Product Result",
      description: "Write Codex-generated naming candidates back to the state file, ending the workbench loading state.",
      inputSchema: {
        ...projectArgsSchema,
        requestId: z.string().trim(),
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
      const state = await readState(input);
      const requestId = nonEmpty(input.requestId);
      const request = state.requests[requestId];
      if (!request) {
        return {
          isError: true,
          content: [{ type: "text", text: `Unknown Naming Product request: ${requestId}` }],
        };
      }
      if (request.status === "superseded") {
        return {
          isError: true,
          content: [{ type: "text", text: `Naming Product request was superseded: ${requestId}` }],
        };
      }

      const now = new Date().toISOString();
      const result = input.result || {};
      const profile = normalizeProfile(mergeProfile(request.profile || {}, result.profile || {}));
      const batch = Number.isFinite(result.batch) ? result.batch : request.batch || 0;
      const explicitError = nonEmpty(result.error);
      const candidates = Array.isArray(result.candidates)
        ? normalizeCandidates(result.candidates, profile, batch)
        : [];
      const error = explicitError || (candidates.length === 0 ? "Codex did not return any naming candidates." : "");

      state.requests[requestId] = {
        ...request,
        profile,
        batch,
        status: error ? "error" : "completed",
        updatedAt: now,
        error: error || null,
        result: error
          ? null
          : {
              provider: nonEmpty(result.provider) || "codex",
              model: nonEmpty(result.model) || "Codex",
              notice: nonEmpty(result.notice) || "Codex 已完成命名测算，结果已回写到工作台。",
              candidates,
              profile,
              batch,
              completedAt: now,
            },
      };
      if (!error) state.latestResultId = requestId;
      const saved = await writeState(input, state);
      return {
        content: [{ type: "text", text: error ? `Saved Naming Product error for ${requestId}.` : `Saved Naming Product result for ${requestId}.` }],
        structuredContent: {
          request: saved.requests[requestId],
          ...publicState(saved),
        },
      };
    },
  );
}
