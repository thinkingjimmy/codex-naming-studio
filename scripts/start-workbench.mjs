/**
 * - [INPUT]: 依赖 NAMING_PROJECT_DIR/NAMING_WORKBENCH_PORT 环境变量、已有工作台健康接口、插件根目录的 Vite 与依赖树。
 * - [OUTPUT]: 对外提供起名工作台启动入口——健康复用已有服务，必要时修复依赖并以插件根启动 Vite dev server。
 * - [POS]: scripts 的产品启动器，是 Codex "打开起名工作台" 的唯一入口，对标 Cowart start-canvas.sh。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectDir = path.resolve(process.env.NAMING_PROJECT_DIR || process.cwd());
const port = Number(process.env.NAMING_WORKBENCH_PORT || 43318);
const viteBinary = path.join(pluginRoot, "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite");
const workbenchUrl = `http://127.0.0.1:${port}`;

const existing = await readExistingWorkbench();
if (existing.ok) {
  const servedProjectDir = path.resolve(existing.state.projectDir || "");
  if (servedProjectDir === projectDir) {
    console.log(`Naming workbench already running: ${workbenchUrl}`);
    console.log(`Naming state file: ${existing.state.stateFile}`);
    process.exit(0);
  }
  console.error(`Port ${port} is already serving Naming Studio for another project: ${servedProjectDir}`);
  console.error("Set NAMING_WORKBENCH_PORT to a free port or stop the existing workbench.");
  process.exit(1);
}
if (existing.occupied) {
  console.error(`Port ${port} is already in use by a non-Naming-Studio service.`);
  console.error("Set NAMING_WORKBENCH_PORT to a free port or stop the process using this port.");
  process.exit(1);
}

ensureWorkbenchDependencies();

console.log(`Naming workbench: ${workbenchUrl}`);
console.log(`Naming state file: ${path.join(projectDir, ".naming-product", "state.json")}`);

const child = spawn(viteBinary, ["--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: pluginRoot,
  env: { ...process.env, NAMING_PROJECT_DIR: projectDir },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
for (const event of ["SIGINT", "SIGTERM"]) {
  process.on(event, () => child.kill(event));
}

async function readExistingWorkbench() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 450);
  try {
    const response = await fetch(`${workbenchUrl}/api/naming-state`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, occupied: true };
    const state = await response.json();
    return state?.stateFile ? { ok: true, state } : { ok: false, occupied: true };
  } catch (_error) {
    return { ok: false, occupied: false };
  } finally {
    clearTimeout(timeout);
  }
}

function ensureWorkbenchDependencies() {
  if (existsSync(viteBinary) && viteImportWorks()) return;
  console.log("Installing workbench dependencies...");
  const install = spawnSync("pnpm", ["install", "--config.node-linker=hoisted"], { cwd: pluginRoot, stdio: "inherit" });
  if (install.status !== 0) {
    const npmFallback = spawnSync("npm", ["install"], { cwd: pluginRoot, stdio: "inherit" });
    if (npmFallback.status !== 0) {
      console.error("Failed to install dependencies for the naming workbench.");
      process.exit(1);
    }
  }
  if (!existsSync(viteBinary) || !viteImportWorks()) {
    console.error("Workbench dependencies are still incomplete after install.");
    process.exit(1);
  }
}

function viteImportWorks() {
  const check = spawnSync(process.execPath, ["--input-type=module", "-e", "await import('vite');"], {
    cwd: pluginRoot,
    stdio: "ignore",
  });
  return check.status === 0;
}
