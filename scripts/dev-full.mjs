/**
 * - [INPUT]: 依赖 node:child_process 的 spawn、node:http/node:net 的本地端口探测，依赖 server/llm-bridge.js 与 Vite CLI。
 * - [OUTPUT]: 启动 Vite，并在本地 LLM bridge 健康时复用、不存在时创建、异常占用时中止。
 * - [POS]: scripts 的开发编排器，统一普通浏览器开发的前端入口与后端桥接生命周期。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = "127.0.0.1";
const bridgePort = Number(process.env.NAME_BRIDGE_PORT || 8787);
const bridgeUrl = `http://${host}:${bridgePort}`;
const viteCli = path.join(root, "node_modules", ".bin", "vite");
const children = new Set();
let stopping = false;

function readJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isPermissionError(error) {
  return ["EACCES", "EPERM"].includes(error?.code);
}

function checkBridgeHealth() {
  return new Promise((resolve) => {
    const request = http.get(`${bridgeUrl}/api/health`, { timeout: 800 }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        const payload = readJson(body);
        resolve({ ok: response.statusCode === 200 && payload?.ok === true, status: response.statusCode, payload });
      });
    });

    request.on("timeout", () => request.destroy(Object.assign(new Error("Bridge health check timed out"), { code: "ETIMEDOUT" })));
    request.on("error", (error) => resolve({ ok: false, error }));
  });
}

function canBindBridgePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (error) => {
      if (error.code === "EADDRINUSE") return resolve(false);
      return reject(error);
    });
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(bridgePort, host);
  });
}

async function chooseBridgeMode() {
  const health = await checkBridgeHealth();
  if (health.ok) return "reuse";

  const portIsFree = await canBindBridgePort();
  if (portIsFree) return "start";
  if (isPermissionError(health.error)) return "assume";

  const reason = health.status ? `HTTP ${health.status}` : health.error?.code || health.error?.message || "unknown error";
  throw new Error(`Port ${bridgePort} is occupied, but ${bridgeUrl}/api/health is not healthy (${reason}).`);
}

function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
}

function start(label, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.add(child);
  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  child.on("error", (error) => {
    process.stderr.write(`[${label}] failed to start: ${error.message}\n`);
    stopAll();
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (stopping) return;
    if (code || signal) {
      process.stderr.write(`[${label}] exited ${code ?? signal}\n`);
      stopAll();
      process.exitCode = code || 1;
    }
  });
  return child;
}

async function main() {
  const bridgeMode = await chooseBridgeMode();
  if (bridgeMode === "reuse") {
    process.stdout.write(`[api] reusing healthy bridge on ${bridgeUrl}\n`);
  } else if (bridgeMode === "assume") {
    process.stdout.write(`[api] port ${bridgePort} is busy; health probe was denied, assuming existing bridge on ${bridgeUrl}\n`);
  } else {
    process.stdout.write(`[api] starting bridge on ${bridgeUrl}\n`);
    start("api", "node", ["server/llm-bridge.js"], { NAME_BRIDGE_PORT: String(bridgePort) });
  }

  start("web", viteCli, ["--host", host], { VITE_NAME_BRIDGE_URL: bridgeUrl });
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopAll();
  process.exit(143);
});

main().catch((error) => {
  process.stderr.write(`[dev] ${error.message}\n`);
  process.stderr.write(`[dev] Free the port or run with NAME_BRIDGE_PORT=<free-port> pnpm dev\n`);
  stopAll();
  process.exit(1);
});
