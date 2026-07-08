/**
 * - [INPUT]: 依赖 Codex native widget 注入的 window.namingProductMcp / window.openai，以及 MCP state tools。
 * - [OUTPUT]: 对外提供 hasNamingWidgetBridge、submitCodexNameRequest、loadCodexNameState。
 * - [POS]: lib 的 Codex 宿主协议层，让 GUI 点击生成后把任务交给 Codex 而非浏览器内模型。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
const TOOL_GET_STATE = "get_naming_product_state";
const TOOL_SAVE_REQUEST = "save_naming_product_request";
const WIDGET_PAYLOAD_TIMEOUT_MS = 5000;

globalThis.__NAMING_WIDGET_FETCH_GUARD__ = true;

export function hasNamingWidgetBridge() {
  return Boolean(window.namingProductMcp && typeof window.namingProductMcp.callServerTool === "function");
}

export async function submitCodexNameRequest(profile, batch) {
  await waitForWidgetPayload();
  const requestId = createRequestId();
  await callNamingTool(TOOL_SAVE_REQUEST, {
    request: {
      id: requestId,
      profile,
      batch,
      source: "widget",
    },
  });

  const prompt = buildFollowUpPrompt({ requestId, profile, batch });
  const sender = followUpSender();
  if (!sender) throw new Error("当前 Naming Product 没有可用的 Codex 消息桥。");

  await sender({
    prompt,
    content: [{ type: "text", text: prompt }],
  });

  return {
    requestId,
    provider: "codex-widget",
    model: "Codex",
    notice: "请求已提交给 Codex，GUI 正在等待结构化结果回写。",
  };
}

export async function loadCodexNameState(options = {}) {
  return callNamingTool(TOOL_GET_STATE, {}, options);
}

async function callNamingTool(name, args = {}, options = {}) {
  await waitForWidgetPayload(options.signal);
  if (options.signal?.aborted) throw abortError();
  const result = await window.namingProductMcp.callServerTool({
    name,
    arguments: withWidgetTarget(args),
  }, options);
  if (result?.isError) {
    const message = result.content?.find((item) => item.type === "text")?.text;
    throw new Error(message || `Naming Product server tool failed: ${name}`);
  }
  return result.structuredContent ?? result;
}

function currentPayload() {
  return window.openai?.toolOutput && typeof window.openai.toolOutput === "object" ? window.openai.toolOutput : {};
}

function withWidgetTarget(args) {
  const payload = currentPayload();
  return removeUndefined({
    projectDir: payload.projectDir,
    stateDir: payload.stateDir,
    ...args,
  });
}

function removeUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([_key, item]) => item !== undefined));
}

async function waitForWidgetPayload(signal) {
  if (!hasNamingWidgetBridge()) return;
  if (currentPayload().projectDir || currentPayload().stateDir) return;

  await new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Naming Product widget storage target was not ready."));
    }, WIDGET_PAYLOAD_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("openai:set_globals", handleGlobals);
      signal?.removeEventListener("abort", handleAbort);
    };
    const finish = () => {
      cleanup();
      resolve();
    };
    const handleGlobals = () => {
      if (currentPayload().projectDir || currentPayload().stateDir) finish();
    };
    const handleAbort = () => {
      cleanup();
      reject(abortError());
    };

    window.addEventListener("openai:set_globals", handleGlobals, { once: true });
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

function followUpSender() {
  if (typeof window.namingProductMcp?.sendFollowUpMessage === "function") {
    return (message) => window.namingProductMcp.sendFollowUpMessage(message);
  }
  if (typeof window.openai?.sendFollowUpMessage === "function") {
    return (message) => window.openai.sendFollowUpMessage(message);
  }
  return null;
}

function buildFollowUpPrompt({ requestId, profile, batch }) {
  return [
    `NAMING_PRODUCT_REQUEST_ID: ${requestId}`,
    "",
    "请使用 $codex-naming-studio 处理这个 GUI 生成请求。",
    "用户正在 Codex Naming Studio widget 中等待 loading，请不要只在聊天里回答。",
    "",
    "操作要求：",
    "1. 调用 get_naming_product_state 读取这个 requestId 的 profile。",
    "2. 基于姓名学、音律、字形、寓意、五行偏好与避讳生成 8-12 个中文名字。",
    "3. 调用 save_naming_product_result，把 candidates 写回 GUI。",
    "4. 完成后只简短说明 GUI 已更新。",
    "",
    "请求快照：",
    JSON.stringify({ requestId, batch, profile }, null, 2),
  ].join("\n");
}

function createRequestId() {
  if (globalThis.crypto?.randomUUID) return `name-${globalThis.crypto.randomUUID()}`;
  return `name-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function abortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}
