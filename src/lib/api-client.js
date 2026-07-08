/**
 * - [INPUT]: 依赖 window.namingMcp 宿主桥（widget 模式，经 openai:set_globals 取 toolOutput.projectDir）或浏览器 fetch + 同源 Vite 状态 middleware（兜底模式）。
 * - [OUTPUT]: 对外提供 submitNameRequest(profile, batch)、loadNameState()、sendGenerateFollowUp(requestId) 与 hasNamingWidgetBridge()。
 * - [POS]: lib 的双模状态协议层，widget 模式走 MCP 服务端工具并用 follow-up 消息唤醒 Codex，兜底模式落状态文件等 watcher。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */

// CSP 断言标记：widget 包内保留的 fetch 兜底代码由它放行。
globalThis.__NAMING_WIDGET_FETCH_GUARD__ = true;

const OFFLINE_MESSAGE = "本地工作台服务未运行，请在 Codex 里重新说“打开起名工作台”。";
const TOOL_GET_STATE = "get_naming_product_state";
const TOOL_SAVE_REQUEST = "save_naming_product_request";
const WIDGET_PAYLOAD_TIMEOUT_MS = 5000;

export const IS_NAMING_WIDGET_BUILD =
  typeof __NAMING_WIDGET_BUILD__ !== "undefined" && __NAMING_WIDGET_BUILD__;

export function hasNamingWidgetBridge() {
  return Boolean(window.namingMcp && typeof window.namingMcp.callServerTool === "function");
}

function currentWidgetPayload() {
  return window.openai?.toolOutput && typeof window.openai.toolOutput === "object"
    ? window.openai.toolOutput
    : {};
}

function serverToolArgs(extra = {}) {
  const payload = currentWidgetPayload();
  return removeUndefined({
    projectDir: payload.projectDir,
    stateDir: payload.stateDir,
    ...extra,
  });
}

function removeUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([_key, item]) => item !== undefined));
}

// widget 渲染后 toolOutput 可能晚于首帧到达：等 openai:set_globals 直到 projectDir 就绪。
async function waitForWidgetPayload() {
  if (!hasNamingWidgetBridge()) return;
  if (currentWidgetPayload().projectDir) return;

  await new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("工作台 widget 尚未就绪（缺少 projectDir），请重新打开起名工作台。"));
    }, WIDGET_PAYLOAD_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("openai:set_globals", handleGlobals);
    };
    const handleGlobals = () => {
      if (currentWidgetPayload().projectDir) {
        cleanup();
        resolve();
      }
    };
    window.addEventListener("openai:set_globals", handleGlobals);
    handleGlobals();
  });
}

async function callNamingServerTool(name, args = {}) {
  await waitForWidgetPayload();
  const result = await window.namingMcp.callServerTool({
    name,
    arguments: serverToolArgs(args),
  });
  if (result?.isError) {
    const text = result.content?.find((item) => item?.type === "text")?.text;
    throw new Error(text || "起名工作台状态工具调用失败。");
  }
  return result?.structuredContent ?? result;
}

async function requestJson(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (_error) {
    throw new Error(OFFLINE_MESSAGE);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(payload?.error || OFFLINE_MESSAGE);
  }
  return payload;
}

export async function submitNameRequest(profile, batch) {
  const requestId = createRequestId();
  if (hasNamingWidgetBridge()) {
    await callNamingServerTool(TOOL_SAVE_REQUEST, {
      request: { id: requestId, profile, batch, source: "widget" },
    });
  } else {
    await requestJson("/api/naming-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request: { id: requestId, profile, batch, source: "gui" },
      }),
    });
  }
  return {
    requestId,
    provider: "pending-codex",
    model: "Codex",
  };
}

export async function loadNameState() {
  if (hasNamingWidgetBridge()) {
    // get_naming_product_state 的 structuredContent 与 /api/naming-state 同形（publicState）。
    return callNamingServerTool(TOOL_GET_STATE);
  }
  return requestJson("/api/naming-state", { method: "GET" });
}

// widget 独有的唤醒通道：把生成请求作为用户消息发进对话，开启 Codex 新回合。
export async function sendGenerateFollowUp(requestId) {
  if (!hasNamingWidgetBridge() || typeof window.namingMcp.sendFollowUpMessage !== "function") {
    throw new Error("宿主桥不可用，无法发送 follow-up 消息。");
  }
  await waitForWidgetPayload();
  const projectDir = currentWidgetPayload().projectDir;
  // 面向用户的确认弹窗会展示这句话：保留「处理起名请求」触发短语与 projectDir，去掉工具与技能术语。
  const prompt = `请帮我处理起名请求 ${requestId}（项目目录 ${projectDir}），测算完成后把结果回写到起名工作台。`;
  return window.namingMcp.sendFollowUpMessage({ prompt });
}

function createRequestId() {
  if (globalThis.crypto?.randomUUID) return `name-${globalThis.crypto.randomUUID()}`;
  return `name-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
