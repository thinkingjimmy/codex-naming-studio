/**
 * - [INPUT]: 依赖 @modelcontextprotocol/ext-apps/server 的 registerAppResource/RESOURCE_MIME_TYPE、ext-apps/app-with-deps 浏览器 bundle 与 plugin-root 的 pluginPath。
 * - [OUTPUT]: 对外提供 registerWidgetResource（双格式 CSP 元数据的 widget 资源注册）与 injectMcpHostBridge（向 HTML head 注入 ext-apps bundle + window.namingMcp 宿主桥）。
 * - [POS]: mcp/lib 的 widget 宿主桥层，移植自 Cowart widget-resource.mjs，被 server.mjs 的 registerNamingWidget 消费。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
} from "@modelcontextprotocol/ext-apps/server";

import { pluginPath } from "./plugin-root.mjs";

const require = createRequire(import.meta.url);
let cachedMcpAppsGlobalScript = "";
let cachedAppInfo = null;

// ============================================================
// 资源注册：ui.csp 与 openai/widgetCSP 双格式并发，兼容不同宿主版本。
// ============================================================
export function registerWidgetResource(
  server,
  {
    name,
    uri,
    title,
    description,
    html,
    prefersBorder = false,
    connectDomains = [],
    resourceDomains = [],
  },
) {
  const metadata = {
    ui: {
      prefersBorder,
      csp: {
        connectDomains,
        resourceDomains,
      },
    },
    "openai/widgetDescription": description,
    "openai/widgetPrefersBorder": prefersBorder,
    "openai/widgetCSP": {
      connect_domains: connectDomains,
      resource_domains: resourceDomains,
    },
  };

  registerAppResource(
    server,
    name,
    uri,
    {
      title,
      description,
      _meta: metadata,
    },
    async () => {
      const text = typeof html === "function" ? await html() : html;
      return {
        contents: [
          {
            uri,
            mimeType: RESOURCE_MIME_TYPE,
            text,
            _meta: metadata,
          },
        ],
      };
    },
  );
}

// ============================================================
// 桥注入：三段 head 脚本——初始显示模式、ext-apps 浏览器 bundle、桥 IIFE。
// ============================================================
export function injectMcpHostBridge(html, { initialDisplayMode = "" } = {}) {
  const bridge = [
    '<script id="namingInitialDisplayMode">',
    `window.__NAMING_INITIAL_DISPLAY_MODE__=${JSON.stringify(initialDisplayMode)};`,
    "</script>",
    '<script id="namingMcpAppsBundle">',
    escapeInlineScript(mcpAppsGlobalScript()),
    "</script>",
    '<script id="namingMcpHostBridge">',
    mcpHostBridgeScript(),
    "</script>",
  ].join("\n");

  if (html.includes("</head>")) {
    return html.replace("</head>", () => `${bridge}\n</head>`);
  }
  return `${bridge}\n${html}`;
}

function pluginAppInfo() {
  if (cachedAppInfo) return cachedAppInfo;
  const manifest = JSON.parse(readFileSync(pluginPath(".codex-plugin", "plugin.json"), "utf8"));
  cachedAppInfo = {
    name: manifest.name || "codex-naming-studio",
    version: manifest.version || "0.0.0",
  };
  return cachedAppInfo;
}

// ext-apps 浏览器 bundle 是 ESM，widget 里无法 import：
// 截断尾部 export 块，把所需导出改写为 globalThis 全局。
function mcpAppsGlobalScript() {
  if (cachedMcpAppsGlobalScript) return cachedMcpAppsGlobalScript;

  const sourcePath = require.resolve("@modelcontextprotocol/ext-apps/app-with-deps");
  const source = readFileSync(sourcePath, "utf8");
  const exportStart = source.lastIndexOf("export{");
  if (exportStart === -1) {
    throw new Error("Could not find ext-apps browser export block.");
  }

  const exportBlock = source.slice(exportStart).match(/^export\{([^}]+)\};?\s*$/s);
  if (!exportBlock) {
    throw new Error("Could not parse ext-apps browser export block.");
  }

  const exportMap = parseExportMap(exportBlock[1]);
  const requiredExports = [
    "App",
    "applyDocumentTheme",
    "applyHostFonts",
    "applyHostStyleVariables",
  ];
  for (const name of requiredExports) {
    if (!exportMap.has(name)) throw new Error(`Missing ext-apps browser export: ${name}`);
  }

  cachedMcpAppsGlobalScript = [
    source.slice(0, exportStart),
    ";globalThis.__NAMING_MCP_APPS__={",
    requiredExports.map((name) => `${JSON.stringify(name)}:${exportMap.get(name)}`).join(","),
    "};",
  ].join("");
  return cachedMcpAppsGlobalScript;
}

function parseExportMap(body) {
  const exportMap = new Map();
  for (const rawEntry of body.split(",")) {
    const entry = rawEntry.trim();
    if (!entry) continue;
    const parts = entry.split(/\s+as\s+/);
    const local = parts[0]?.trim();
    const exported = (parts[1] || parts[0])?.trim();
    if (local && exported) exportMap.set(exported, local);
  }
  return exportMap;
}

function escapeInlineScript(source) {
  return source.replaceAll("</script", "<\\/script").replaceAll("</SCRIPT", "<\\/SCRIPT");
}

// 桥 IIFE：构造 ext-apps App、发布 window.openai 全局与 openai:set_globals 事件、
// 安装 window.namingMcp API（follow-up 消息 / 服务端工具调用 / 宿主能力查询）。
function mcpHostBridgeScript() {
  const appInfo = pluginAppInfo();
  return `(() => {
  "use strict";

  const apps = globalThis.__NAMING_MCP_APPS__;
  if (!apps || typeof apps.App !== "function") return;

  let mcpApp = null;

  function publishHostGlobals(globals) {
    window.openai = Object.assign(window.openai || {}, globals);
    window.dispatchEvent(new CustomEvent("openai:set_globals", {
      detail: { globals: window.openai },
    }));
  }

  function applyHostContext(context) {
    if (!context) return;
    try {
      if (context.theme && typeof apps.applyDocumentTheme === "function") {
        apps.applyDocumentTheme(context.theme);
      }
      if (context.styles?.variables && typeof apps.applyHostStyleVariables === "function") {
        apps.applyHostStyleVariables(context.styles.variables);
      }
      if (context.styles?.css?.fonts && typeof apps.applyHostFonts === "function") {
        apps.applyHostFonts(context.styles.css.fonts);
      }
    } catch (_error) {
      // 宿主样式是渐进增强，失败不阻断。
    }

    publishHostGlobals({
      hostContext: context,
      displayMode: context.displayMode,
      availableDisplayModes: context.availableDisplayModes,
      widgetInstanceId: context.widgetInstanceId || context.widgetId,
    });
  }

  function promptFromMessage(message) {
    if (typeof message === "string") return message;
    if (message?.prompt) return String(message.prompt);
    if (typeof message?.content === "string") return message.content;
    return "";
  }

  function contentFromMessage(message, prompt) {
    if (message && Array.isArray(message.content)) return message.content;
    return [{ type: "text", text: prompt }];
  }

  function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function toBridgeError(error) {
    if (error instanceof Error) return error;
    return new Error(String(error || "Naming host bridge is unavailable."));
  }

  function currentSize() {
    const root = document.documentElement;
    const body = document.body;
    return {
      width: Math.ceil(window.innerWidth || root.clientWidth || 0),
      height: Math.ceil(Math.max(
        root.scrollHeight || 0,
        root.offsetHeight || 0,
        body?.scrollHeight || 0,
        body?.offsetHeight || 0,
      )),
    };
  }

  function sendCurrentSize() {
    if (!mcpApp || typeof mcpApp.sendSizeChanged !== "function") return;
    try {
      mcpApp.sendSizeChanged(currentSize());
    } catch (_error) {
      // 宿主不支持尺寸通知时保持默认 widget 尺寸。
    }
  }

  async function waitForReady(app) {
    if (app?.ready) {
      await withTimeout(app.ready, 4000, "Naming host bridge did not become ready.");
    }
    if (globalThis.__NAMING_MCP_HOST_ERROR__) {
      throw toBridgeError(globalThis.__NAMING_MCP_HOST_ERROR__);
    }
  }

  function installNamingApi(app) {
    const api = window.namingMcp || {};
    window.namingMcp = api;

    api.sendFollowUpMessage = async (message) => {
      try {
        const prompt = promptFromMessage(message);
        if (!prompt) throw new Error("Missing follow-up prompt.");
        if (!app || typeof app.sendMessage !== "function") throw new Error("Host bridge is unavailable.");
        await waitForReady(app);
        const result = await withTimeout(app.sendMessage({
          role: "user",
          content: contentFromMessage(message, prompt),
        }), 8000, "Host did not accept the follow-up message.");
        if (result?.isError) throw new Error("Host rejected the follow-up message.");
        return result || {};
      } catch (error) {
        throw toBridgeError(error);
      }
    };

    api.callServerTool = async (request, options) => {
      try {
        if (!app || typeof app.callServerTool !== "function") throw new Error("Host tool bridge is unavailable.");
        await waitForReady(app);
        return await withTimeout(
          app.callServerTool(request, options),
          options?.timeoutMs || 30000,
          "Naming server tool call timed out.",
        );
      } catch (error) {
        throw toBridgeError(error);
      }
    };

    api.getHostCapabilities = () => {
      try {
        return typeof app?.getHostCapabilities === "function" ? app.getHostCapabilities() : null;
      } catch (_error) {
        return null;
      }
    };

    api.requestDisplayMode = async (modeOrRequest) => {
      if (!app || typeof app.requestDisplayMode !== "function") return {};
      const request = typeof modeOrRequest === "string" ? { mode: modeOrRequest } : (modeOrRequest || { mode: "inline" });
      await waitForReady(app);
      return app.requestDisplayMode(request);
    };

    api.notifyResize = sendCurrentSize;
  }

  function payloadFromToolResult(result) {
    const metadata = result && typeof result === "object" ? result._meta || {} : {};
    const payload = metadata.widgetData || result?.structuredContent || result || {};
    return { metadata, payload };
  }

  function handleToolResult(result) {
    const { metadata, payload } = payloadFromToolResult(result);
    publishHostGlobals({
      rawToolResult: result,
      toolOutput: payload,
      toolResponseMetadata: metadata,
    });
    sendCurrentSize();
  }

  window.addEventListener("message", (event) => {
    const result = event.data?.params?.result;
    if (event.data?.method === "ui/notifications/tool-result" && result) {
      handleToolResult(result);
    }
  });

  try {
    mcpApp = new apps.App(
      { name: ${JSON.stringify(appInfo.name)}, version: ${JSON.stringify(appInfo.version)} },
      { availableDisplayModes: ["inline", "fullscreen"] },
      { autoResize: true },
    );
    globalThis.__NAMING_MCP_APP__ = mcpApp;
    installNamingApi(mcpApp);

    mcpApp.addEventListener("hostcontextchanged", applyHostContext);
    mcpApp.addEventListener("toolresult", handleToolResult);

    mcpApp.ready = mcpApp.connect()
      .then(() => {
        installNamingApi(mcpApp);
        publishHostGlobals({
          hostCapabilities: mcpApp.getHostCapabilities && mcpApp.getHostCapabilities(),
          hostInfo: mcpApp.getHostVersion && mcpApp.getHostVersion(),
        });
        applyHostContext(mcpApp.getHostContext && mcpApp.getHostContext());
        const initialMode = window.__NAMING_INITIAL_DISPLAY_MODE__;
        if (initialMode === "fullscreen" && typeof mcpApp.requestDisplayMode === "function") {
          mcpApp.requestDisplayMode({ mode: "fullscreen" }).catch(() => {});
        }
        sendCurrentSize();
      })
      .catch((error) => {
        globalThis.__NAMING_MCP_HOST_ERROR__ = error;
      });
  } catch (error) {
    globalThis.__NAMING_MCP_HOST_ERROR__ = error;
  }
})();`;
}
