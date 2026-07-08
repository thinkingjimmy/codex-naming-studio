/**
 * - [INPUT]: 依赖 naming-state 共享状态库与 --project-dir/--timeout 命令行参数。
 * - [OUTPUT]: 阻塞等待新的 pending 起名请求，命中则打印请求 JSON 并 exit 0，超时 exit 2。
 * - [POS]: scripts 的 Codex 侧监听器，让 Codex 在用户点击生成后立即拿到请求与执行计划。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { setTimeout as sleep } from "node:timers/promises";

import { readState } from "../mcp/lib/naming-state.mjs";

const args = process.argv.slice(2);
const options = { projectDir: process.cwd(), timeout: 1800 };
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--project-dir") options.projectDir = args[++index];
  else if (args[index] === "--timeout") options.timeout = Number(args[++index]) || options.timeout;
}

const startedAt = Date.now();
// 只报告启动之后仍处于 pending 的请求，避免重复消费历史请求；
// 启动时已存在的 pending 请求视为待处理立即返回。
const seenPending = new Set();
let first = true;

while (true) {
  const state = await readState({ projectDir: options.projectDir });
  const pending = Object.values(state.requests || {}).filter((request) => request.status === "pending");

  if (first) {
    if (pending.length > 0) {
      report(pending[pending.length - 1]);
    }
    for (const request of pending) seenPending.add(request.id);
    first = false;
  } else {
    const fresh = pending.find((request) => !seenPending.has(request.id));
    if (fresh) report(fresh);
    for (const request of pending) seenPending.add(request.id);
  }

  if ((Date.now() - startedAt) / 1000 >= options.timeout) {
    console.error("No new naming request before timeout.");
    process.exit(2);
  }
  await sleep(1000);
}

function report(request) {
  console.log(JSON.stringify({ projectDir: options.projectDir, request }, null, 2));
  process.exit(0);
}
