/**
 * - [INPUT]: 依赖 MCP SDK、zod、naming-state 共享状态库与 name-engine 标准化能力。
 * - [OUTPUT]: 对外注册 get_naming_product_state、save_naming_product_request、save_naming_product_result 三个 MCP 工具。
 * - [POS]: mcp 的唯一协议入口，是 Codex 侧读请求、写结果的通道；浏览器 GUI 走 Vite 状态 middleware 读写同一份文件。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { readFileSync } from "node:fs";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { normalizeCandidates } from "../src/lib/name-engine.js";
import {
  nonEmpty,
  publicState,
  readState,
  saveNamingRequest,
  writeState,
} from "./lib/naming-state.mjs";
import { pluginPath } from "./lib/plugin-root.mjs";

const TOOL_GET_STATE = "get_naming_product_state";
const TOOL_SAVE_REQUEST = "save_naming_product_request";
const TOOL_SAVE_RESULT = "save_naming_product_result";

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
      "Read and persist Naming Studio GUI requests/results in the project state file. Use save_naming_product_result after Codex has produced structured name candidates so the browser workbench can leave loading state.",
  },
);

registerStateTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);

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
