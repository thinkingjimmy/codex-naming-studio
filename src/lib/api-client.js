/**
 * - [INPUT]: 依赖浏览器 fetch，依赖 VITE_NAME_BRIDGE_URL 或默认 127.0.0.1:8787 的本地 LLM bridge。
 * - [OUTPUT]: 对外提供 requestNameCandidates(profile, batch) 本地开发 fallback 异步函数。
 * - [POS]: lib 的 HTTP fallback 协议层；Codex widget 正常路径由 codex-widget-client.js 承担。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
const BRIDGE_URL = import.meta.env.VITE_NAME_BRIDGE_URL || "http://127.0.0.1:8787";

export async function requestNameCandidates(profile, batch) {
  const response = await fetch(`${BRIDGE_URL}/api/generate-names`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profile, batch }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "起名服务暂时不可用");
  }
  return payload;
}
