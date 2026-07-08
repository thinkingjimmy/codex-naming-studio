/**
 * - [INPUT]: 依赖 naming-state 共享状态库与 --project-dir/--timeout/--interval 命令行参数。
 * - [OUTPUT]: 阻塞等待最新 pending 起名请求，命中则打印请求 JSON 并 exit 0，超时 exit 2。
 * - [POS]: scripts 的 Codex 侧监听器，只消费单一活跃 pending，让用户连续点击生成时旧请求自然退场。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { setTimeout as sleep } from "node:timers/promises";

import { latestPendingRequest, readState } from "../mcp/lib/naming-state.mjs";

const args = process.argv.slice(2);
const options = { projectDir: process.cwd(), timeout: 1800, interval: 300 };
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--project-dir") options.projectDir = args[++index];
  else if (args[index] === "--timeout") options.timeout = Number(args[++index]) || options.timeout;
  else if (args[index] === "--interval") options.interval = Number(args[++index]) || options.interval;
}

const startedAt = Date.now();
while (true) {
  const state = await readState({ projectDir: options.projectDir });
  const pending = latestPendingRequest(state);
  if (pending) report(pending);

  if ((Date.now() - startedAt) / 1000 >= options.timeout) {
    console.error("No new naming request before timeout.");
    process.exit(2);
  }
  await sleep(options.interval);
}

function report(request) {
  console.log(JSON.stringify({ projectDir: options.projectDir, request }, null, 2));
  process.exit(0);
}
