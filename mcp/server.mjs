/**
 * - [INPUT]: 依赖 MCP SDK、ext-apps registerAppTool、zod、静态 widget 构建器、name-engine 标准化与 task-plan 约束路由。
 * - [OUTPUT]: 对外注册 render_naming_product_widget、get_naming_product_state、save_naming_product_request、save_naming_product_result 四个 MCP 工具。
 * - [POS]: mcp 的唯一协议入口，连接 Codex 宿主、GUI widget 与项目本地状态文件。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { readFileSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { normalizeCandidates } from "../src/lib/name-engine.js";
import { buildTaskPlan } from "../src/lib/task-plan.js";
import { NAMING_STATIC_BUILD_DIR, namingStaticHtml } from "./lib/naming-static-widget.mjs";
import { pluginPath } from "./lib/plugin-root.mjs";
import { inlineWidget, registerWidgetResource } from "./lib/widget-resource.mjs";

const TOOL_RENDER = "render_naming_product_widget";
const TOOL_GET_STATE = "get_naming_product_state";
const TOOL_SAVE_REQUEST = "save_naming_product_request";
const TOOL_SAVE_RESULT = "save_naming_product_result";
const WIDGET_URI = "ui://widget/naming-product/workbench.html";
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
      "Render the Naming Product native widget and persist GUI requests/results. Use save_naming_product_result after Codex has produced structured name candidates so the widget can leave loading state.",
  },
);

registerNamingWidget(server);
registerStateTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);

function nonEmpty(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function resolveNamingPaths(args = {}) {
  const projectDir = path.resolve(nonEmpty(args.projectDir) || process.cwd());
  const stateDir = path.resolve(nonEmpty(args.stateDir) || path.join(projectDir, ".naming-product"));
  return {
    projectDir,
    stateDir,
    stateFile: path.join(stateDir, "state.json"),
  };
}

function emptyState() {
  return {
    version: 1,
    requests: {},
    latestRequestId: null,
    latestResultId: null,
    updatedAt: null,
  };
}

async function readState(args = {}) {
  const paths = resolveNamingPaths(args);
  try {
    const parsed = JSON.parse(await readFile(paths.stateFile, "utf8"));
    return { ...emptyState(), ...parsed, paths };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { ...emptyState(), paths };
  }
}

async function writeState(args, state) {
  const paths = resolveNamingPaths(args);
  await mkdir(paths.stateDir, { recursive: true });
  const payload = {
    version: 1,
    requests: state.requests || {},
    latestRequestId: state.latestRequestId || null,
    latestResultId: state.latestResultId || null,
    updatedAt: new Date().toISOString(),
  };
  const tempFile = `${paths.stateFile}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(payload, null, 2)}\n`);
  await rename(tempFile, paths.stateFile);
  return { ...payload, paths };
}

function publicState(state) {
  const latestRequest = state.latestRequestId ? state.requests[state.latestRequestId] || null : null;
  const latestResult = state.latestResultId ? state.requests[state.latestResultId]?.result || null : null;
  return {
    version: state.version,
    requests: state.requests,
    latestRequestId: state.latestRequestId,
    latestResultId: state.latestResultId,
    latestRequest,
    latestResult,
    updatedAt: state.updatedAt,
    projectDir: state.paths.projectDir,
    stateDir: state.paths.stateDir,
    stateFile: state.paths.stateFile,
  };
}

function registerNamingWidget(mcpServer) {
  registerWidgetResource(mcpServer, {
    name: "naming-product-widget",
    uri: WIDGET_URI,
    title: "Naming Product",
    description: "A native Codex widget for collecting naming constraints and rendering Codex-generated name analysis.",
    resourceDomains: ["data:", "blob:"],
    html: async () => inlineWidget({
      html: await namingStaticHtml(),
      initialDisplayMode: DEFAULT_DISPLAY_MODE,
    }),
  });

  registerAppTool(
    mcpServer,
    TOOL_RENDER,
    {
      title: "Render Naming Product Widget",
      description: "Open the native Naming Product widget for the active Codex project. Pass projectDir so request/result state is stored in that workspace.",
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
          resourceUri: WIDGET_URI,
          visibility: ["model", "app"],
        },
        "ui/resourceUri": WIDGET_URI,
        "openai/outputTemplate": WIDGET_URI,
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Opening Naming Product...",
        "openai/toolInvocation/invoked": "Naming Product ready",
      },
    },
    async (input = {}) => {
      const paths = resolveNamingPaths(input);
      const title = nonEmpty(input.title) || "Naming Product";
      const preferredDisplayMode = input.displayMode === "inline" ? "inline" : DEFAULT_DISPLAY_MODE;
      return {
        content: [{ type: "text", text: "Rendered Naming Product widget." }],
        structuredContent: {
          version: 1,
          widget: "naming-product-widget",
          title,
          rendering: "native-widget",
          staticDir: NAMING_STATIC_BUILD_DIR,
          projectDir: paths.projectDir,
          stateDir: paths.stateDir,
          preferredDisplayMode,
        },
        _meta: {
          "openai/outputTemplate": WIDGET_URI,
          widgetData: {
            title,
            rendering: "native-widget",
            staticDir: NAMING_STATIC_BUILD_DIR,
            projectDir: paths.projectDir,
            stateDir: paths.stateDir,
            preferredDisplayMode,
          },
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
      description: "Read pending requests and completed results for the Naming Product widget.",
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
      description: "Persist a GUI-submitted naming request so Codex can read it and later write structured results.",
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
      const state = await readState(input);
      const now = new Date().toISOString();
      const id = nonEmpty(input.request?.id);
      if (!id) {
        return {
          isError: true,
          content: [{ type: "text", text: "request.id is required." }],
        };
      }
      const profile = input.request.profile || {};
      state.requests[id] = {
        id,
        profile,
        plan: buildTaskPlan(profile),
        batch: Number.isFinite(input.request.batch) ? input.request.batch : 0,
        source: nonEmpty(input.request.source) || "widget",
        status: "pending",
        createdAt: state.requests[id]?.createdAt || now,
        updatedAt: now,
        result: null,
        error: null,
      };
      state.latestRequestId = id;
      const saved = await writeState(input, state);
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
      description: "Write Codex-generated naming candidates back to the GUI state file, ending the widget loading state.",
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

      const now = new Date().toISOString();
      const result = input.result || {};
      const profile = result.profile || request.profile || {};
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
              notice: nonEmpty(result.notice) || "Codex 已完成命名测算，结果已回写到 GUI。",
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
