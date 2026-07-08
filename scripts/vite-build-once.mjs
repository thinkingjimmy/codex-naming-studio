/**
 * - [INPUT]: 依赖 vite build API 与命令行 root/outDir 参数。
 * - [OUTPUT]: 对外提供一次性 Vite 构建脚本，供 MCP widget 静态内联器调用。
 * - [POS]: scripts 的构建适配器，避免 MCP 进程依赖 shell 脚本和交互式命令。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { build } from "vite";

const args = process.argv.slice(2);
let root = process.cwd();
let outDir = null;
let emptyOutDir = undefined;

if (args[0] && !args[0].startsWith("-")) {
  root = args.shift();
}

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--outDir") {
    outDir = args[index + 1];
    index += 1;
  } else if (arg === "--emptyOutDir") {
    emptyOutDir = true;
  }
}

try {
  await build({
    root,
    build: {
      ...(outDir ? { outDir } : {}),
      ...(emptyOutDir === undefined ? {} : { emptyOutDir }),
    },
  });
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
