import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

import { publicState, readState, saveNamingRequest } from "./mcp/lib/naming-state.mjs";

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
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || "").split("?")[0];
        try {
          if (req.method === "GET" && url === "/api/naming-state") {
            return sendJson(res, 200, publicState(await readState(stateArgs())));
          }
          if (req.method === "POST" && url === "/api/naming-request") {
            const body = await readBody(req);
            const saved = await saveNamingRequest(stateArgs(), body.request || {});
            return sendJson(res, 200, {
              request: saved.requests[saved.latestRequestId],
              ...publicState(saved),
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
