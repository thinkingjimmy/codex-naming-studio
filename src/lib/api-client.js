/**
 * - [INPUT]: 依赖浏览器 fetch 与同源 Vite 状态 middleware（/api/naming-state、/api/naming-request）。
 * - [OUTPUT]: 对外提供 submitNameRequest(profile, batch) 与 loadNameState()。
 * - [POS]: lib 的状态协议层，GUI 通过它把请求写进项目状态文件，并轮询 Codex 回写的结果。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
const OFFLINE_MESSAGE = "本地工作台服务未运行，请在 Codex 里重新说“打开起名工作台”。";

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
  await requestJson("/api/naming-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      request: { id: requestId, profile, batch, source: "gui" },
    }),
  });
  return {
    requestId,
    provider: "pending-codex",
    model: "Codex",
    notice: "请求已写入工作台状态，等待 Codex 测算回写。",
  };
}

export async function loadNameState() {
  return requestJson("/api/naming-state", { method: "GET" });
}

function createRequestId() {
  if (globalThis.crypto?.randomUUID) return `name-${globalThis.crypto.randomUUID()}`;
  return `name-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
