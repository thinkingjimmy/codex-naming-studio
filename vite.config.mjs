/**
 * - [INPUT]: 依赖 Vite/React、NAMING_PROJECT_DIR 与 naming-state 纯读/请求/显式 trigger 修复 API。
 * - [OUTPUT]: 提供前端构建配置与 localhost GET 纯读、POST 部分成功状态 middleware。
 * - [POS]: 根构建边界；server 启动修复一次 trigger，读请求绝不修复或间接唤醒 Agent。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

import {
  publicState,
  readStateUnlocked,
  repairTriggerFile,
  saveNamingRequest,
} from "./mcp/lib/naming-state.mjs";

// ============================================================
// 状态 middleware：GUI 与 Codex 共享用户项目里的 state.json。
// GET  /api/naming-state   → 读取全部请求/结果
// POST /api/naming-request → 落盘请求并推导执行计划
// ============================================================
const stateArgs = () => ({ projectDir: process.env.NAMING_PROJECT_DIR || process.cwd() });

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function namingStatePlugin() {
  return {
    name: "naming-state-api",
    async configureServer(server) {
      await repairTriggerFile(stateArgs()).catch((error) => {
        console.error(`[naming-state] workbench startup trigger repair failed: ${error.message}`);
      });
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || "").split("?")[0];
        try {
          if (req.method === "GET" && url === "/api/naming-state") {
            return sendJson(
              res,
              200,
              publicState(await readStateUnlocked(stateArgs()))
            );
          }
          if (req.method === "POST" && url === "/api/naming-request") {
            const body = await readBody(req);
            const saved = await saveNamingRequest(
              stateArgs(),
              body.request || {}
            );
            return sendJson(res, 200, {
              requestId: saved.requestId,
              committed: saved.committed,
              triggerLagging: saved.triggerLagging,
              request: saved.state.requests[saved.requestId],
              ...publicState(saved.state),
            });
          }
        } catch (error) {
          return sendJson(res, 400, {
            error: error instanceof Error ? error.message : "Invalid naming request",
          });
        }
        next();
      });
    },
  };
}

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
    __NAMING_WIDGET_BUILD__: JSON.stringify(process.env.NAMING_WIDGET_BUILD === "1"),
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  build: {
    modulePreload: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [react(), namingStatePlugin()],
});
