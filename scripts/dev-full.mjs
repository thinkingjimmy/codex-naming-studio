/**
 * - [INPUT]: 依赖 node:child_process 的 spawn，依赖 server/llm-bridge.js 与 Vite CLI。
 * - [OUTPUT]: 启动前端 Vite 与本地 LLM bridge 两个开发进程。
 * - [POS]: scripts 的开发编排器，让项目启动即连上本地后端桥接层。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const processes = [
  ["api", "node", ["server/llm-bridge.js"]],
  ["web", path.join(root, "node_modules", ".bin", "vite"), ["--host", "127.0.0.1"]],
];

function start([label, command, args]) {
  const child = spawn(command, args, {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  child.on("exit", (code, signal) => {
    if (code || signal) process.stderr.write(`[${label}] exited ${code ?? signal}\n`);
  });
  return child;
}

const children = processes.map(start);

function stopAll() {
  for (const child of children) child.kill("SIGTERM");
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopAll();
  process.exit(143);
});
