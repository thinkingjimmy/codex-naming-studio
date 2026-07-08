/**
 * - [INPUT]: 依赖 @modelcontextprotocol/ext-apps 的资源注册与浏览器 App bridge 包。
 * - [OUTPUT]: 对外提供 registerWidgetResource 与 inlineWidget，把静态 HTML 变成 Codex native widget。
 * - [POS]: mcp/lib 的浏览器宿主桥，负责发布 window.namingProductMcp 与 window.openai 全局能力。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { RESOURCE_MIME_TYPE, registerAppResource } from "@modelcontextprotocol/ext-apps/server";

const require = createRequire(import.meta.url);
let cachedAppsBundle = "";

export function inlineWidget({ html, initialDisplayMode = "fullscreen" }) {
  return injectHostBridge(html, { initialDisplayMode });
}

export function registerWidgetResource(
  server,
  { name, uri, title, description, html, prefersBorder = false, connectDomains = [], resourceDomains = [] },
) {
  const metadata = {
    ui: {
      prefersBorder,
      csp: { connectDomains, resourceDomains },
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

function injectHostBridge(html, { initialDisplayMode }) {
  const bridge = [
    '<script id="namingProductInitialDisplayMode">',
    `window.__NAMING_PRODUCT_INITIAL_DISPLAY_MODE__=${JSON.stringify(initialDisplayMode)};`,
    "</script>",
    '<script id="namingProductMcpAppsBundle">',
    escapeInlineScript(mcpAppsGlobalScript()),
    "</script>",
    '<script id="namingProductHostBridge">',
    hostBridgeScript(),
    "</script>",
  ].join("\n");

  return html.includes("</head>") ? html.replace("</head>", `${bridge}\n</head>`) : `${bridge}\n${html}`;
}

function mcpAppsGlobalScript() {
  if (cachedAppsBundle) return cachedAppsBundle;

  const source = readFileSync(require.resolve("@modelcontextprotocol/ext-apps/app-with-deps"), "utf8");
  const exportStart = source.lastIndexOf("export{");
  if (exportStart === -1) throw new Error("Cannot locate ext-apps browser export block.");

  const exportBlock = source.slice(exportStart).match(/^export\{([^}]+)\};?\s*$/s);
  if (!exportBlock) throw new Error("Cannot parse ext-apps browser export block.");

  const exportMap = parseExportMap(exportBlock[1]);
  const names = ["App", "applyDocumentTheme", "applyHostFonts", "applyHostStyleVariables"];
  for (const name of names) {
    if (!exportMap.has(name)) throw new Error(`Missing ext-apps browser export: ${name}`);
  }

  cachedAppsBundle = [
    source.slice(0, exportStart),
    ";globalThis.__NAMING_PRODUCT_MCP_APPS__={",
    names.map((name) => `${JSON.stringify(name)}:${exportMap.get(name)}`).join(","),
    "};",
  ].join("");
  return cachedAppsBundle;
}

function parseExportMap(body) {
  const map = new Map();
  for (const item of body.split(",")) {
    const entry = item.trim();
    if (!entry) continue;
    const parts = entry.split(/\s+as\s+/);
    const local = parts[0]?.trim();
    const exported = (parts[1] || parts[0])?.trim();
    if (local && exported) map.set(exported, local);
  }
  return map;
}

function escapeInlineScript(source) {
  return source.replaceAll("</script", "<\\/script").replaceAll("</SCRIPT", "<\\/SCRIPT");
}

function hostBridgeScript() {
  return `(() => {
  "use strict";

  const apps = globalThis.__NAMING_PRODUCT_MCP_APPS__;
  if (!apps || typeof apps.App !== "function") return;

  let mcpApp = null;

  function publish(globals) {
    window.openai = Object.assign(window.openai || {}, globals);
    window.dispatchEvent(new CustomEvent("openai:set_globals", {
      detail: { globals: window.openai },
    }));
  }

  function applyHostContext(context) {
    if (!context) return;
    try {
      if (context.theme && typeof apps.applyDocumentTheme === "function") apps.applyDocumentTheme(context.theme);
      if (context.styles?.variables && typeof apps.applyHostStyleVariables === "function") apps.applyHostStyleVariables(context.styles.variables);
      if (context.styles?.css?.fonts && typeof apps.applyHostFonts === "function") apps.applyHostFonts(context.styles.css.fonts);
    } catch (_error) {
      // 宿主主题是增强项，失败不影响业务数据。
    }
    publish({
      hostContext: context,
      displayMode: context.displayMode,
      availableDisplayModes: context.availableDisplayModes,
      widgetInstanceId: context.widgetInstanceId || context.widgetId,
    });
  }

  function normalizeMessage(message) {
    const prompt = typeof message === "string" ? message : String(message?.prompt || message?.content || "");
    const content = Array.isArray(message?.content) ? message.content : [{ type: "text", text: prompt }];
    return { prompt, content };
  }

  function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async function waitReady(app) {
    if (app?.ready) await withTimeout(app.ready, 4000, "Naming Product host bridge did not become ready.");
    if (globalThis.__NAMING_PRODUCT_HOST_ERROR__) throw globalThis.__NAMING_PRODUCT_HOST_ERROR__;
  }

  function currentSize() {
    const root = document.documentElement;
    const body = document.body;
    return {
      width: Math.ceil(window.innerWidth || root.clientWidth || 0),
      height: Math.ceil(Math.max(root.scrollHeight || 0, root.offsetHeight || 0, body?.scrollHeight || 0, body?.offsetHeight || 0)),
    };
  }

  function notifyResize() {
    try {
      if (mcpApp && typeof mcpApp.sendSizeChanged === "function") mcpApp.sendSizeChanged(currentSize());
    } catch (_error) {
      // 老宿主没有 resize 通知也能显示。
    }
  }

  function installApi(app) {
    const api = window.namingProductMcp || {};
    window.namingProductMcp = api;

    api.sendFollowUpMessage = async (message) => {
      const { prompt, content } = normalizeMessage(message);
      if (!prompt) throw new Error("Missing follow-up prompt.");
      if (!app || typeof app.sendMessage !== "function") throw new Error("Host message bridge is unavailable.");
      await waitReady(app);
      return withTimeout(
        app.sendMessage({ role: "user", content }),
        8000,
        "Host did not accept the Naming Product follow-up message.",
      );
    };

    api.callServerTool = async (request, options = {}) => {
      if (!app || typeof app.callServerTool !== "function") throw new Error("Host tool bridge is unavailable.");
      await waitReady(app);
      return withTimeout(
        app.callServerTool(request, options),
        options.timeoutMs || 30000,
        "Naming Product server tool call timed out.",
      );
    };

    api.requestDisplayMode = async (modeOrRequest) => {
      if (!app || typeof app.requestDisplayMode !== "function") return {};
      await waitReady(app);
      const request = typeof modeOrRequest === "string" ? { mode: modeOrRequest } : (modeOrRequest || { mode: "fullscreen" });
      return app.requestDisplayMode(request);
    };

    api.getHostCapabilities = () => {
      try {
        return typeof app?.getHostCapabilities === "function" ? app.getHostCapabilities() : null;
      } catch (_error) {
        return null;
      }
    };

    api.notifyResize = notifyResize;
  }

  function toolPayload(result) {
    const meta = result && typeof result === "object" ? result._meta || {} : {};
    return {
      meta,
      payload: meta.widgetData || result?.structuredContent || result || {},
    };
  }

  function handleToolResult(result) {
    const { meta, payload } = toolPayload(result);
    publish({
      rawToolResult: result,
      toolOutput: payload,
      toolResponseMetadata: meta,
    });
    notifyResize();
  }

  window.addEventListener("message", (event) => {
    const result = event.data?.params?.result;
    if (event.data?.method === "ui/notifications/tool-result" && result) handleToolResult(result);
  });

  try {
    mcpApp = new apps.App(
      { name: "naming-product", version: "0.2.0" },
      { availableDisplayModes: ["inline", "fullscreen"] },
      { autoResize: true },
    );
    globalThis.__NAMING_PRODUCT_MCP_APP__ = mcpApp;
    installApi(mcpApp);
    mcpApp.addEventListener("hostcontextchanged", applyHostContext);
    mcpApp.addEventListener("toolresult", handleToolResult);
    mcpApp.ready = mcpApp.connect()
      .then(() => {
        installApi(mcpApp);
        publish({
          hostCapabilities: mcpApp.getHostCapabilities && mcpApp.getHostCapabilities(),
          hostInfo: mcpApp.getHostVersion && mcpApp.getHostVersion(),
        });
        applyHostContext(mcpApp.getHostContext && mcpApp.getHostContext());
        if (window.__NAMING_PRODUCT_INITIAL_DISPLAY_MODE__ === "fullscreen") {
          mcpApp.requestDisplayMode?.({ mode: "fullscreen" }).catch(() => {});
        }
        notifyResize();
      })
      .catch((error) => {
        globalThis.__NAMING_PRODUCT_HOST_ERROR__ = error;
      });
  } catch (error) {
    globalThis.__NAMING_PRODUCT_HOST_ERROR__ = error;
  }
})();`;
}
