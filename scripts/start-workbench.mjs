/**
 * - [INPUT]: 依赖 NAMING_PROJECT_DIR/NAMING_WORKBENCH_PORT 环境变量、插件根目录的 Vite 与依赖树。
 * - [OUTPUT]: 对外提供起名工作台启动入口——以插件根启动 Vite dev server，状态写入用户项目目录。
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

if (!existsSync(viteBinary)) {
  console.log("Installing workbench dependencies...");
  const install = spawnSync("pnpm", ["install"], { cwd: pluginRoot, stdio: "inherit" });
  if (install.status !== 0) {
    const npmFallback = spawnSync("npm", ["install"], { cwd: pluginRoot, stdio: "inherit" });
    if (npmFallback.status !== 0) {
      console.error("Failed to install dependencies for the naming workbench.");
      process.exit(1);
    }
  }
}

console.log(`Naming workbench: http://127.0.0.1:${port}`);
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
