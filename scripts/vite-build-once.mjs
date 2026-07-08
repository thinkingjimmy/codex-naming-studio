/**
 * - [INPUT]: 依赖 vite 的编程式 build API 与 <root>/--outDir/--emptyOutDir/--widget 命令行参数。
 * - [OUTPUT]: 对外提供一次性 Vite 构建入口；--widget 时置 NAMING_WIDGET_BUILD=1 与 NODE_ENV=production 产出 widget 单文件包。
 * - [POS]: scripts 的构建执行器，被 naming-static-widget.mjs 以子进程调用，也可经 pnpm build:widget 手动触发。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
const args = process.argv.slice(2);
let root = process.cwd();
let outDir = null;
let emptyOutDir;

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
  } else if (arg === "--widget") {
    // widget 包必须在 import vite 前定型环境：define 读 NAMING_WIDGET_BUILD，React 走 production。
    process.env.NAMING_WIDGET_BUILD = "1";
    process.env.NODE_ENV = "production";
  }
}

const { build } = await import("vite");

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
