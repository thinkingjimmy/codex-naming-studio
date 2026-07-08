/**
 * - [INPUT]: 依赖 plugin-root 的路径定位、scripts/vite-build-once.mjs 子进程构建与 NAMING_WIDGET_STATIC_DIR 环境变量。
 * - [OUTPUT]: 对外提供 NAMING_STATIC_BUILD_DIR 与 namingStaticHtml——惰性构建、SHA-256 源码哈希缓存、内联手术与 CSP 断言后的 widget 单文件 HTML。
 * - [POS]: mcp/lib 的 widget 静态构建器，移植自 Cowart cowart-static-widget.mjs，被 server.mjs 的 widget 资源读取回调消费。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { pluginPath, pluginRoot } from "./plugin-root.mjs";

const pluginVersion = JSON.parse(
  readFileSync(pluginPath(".codex-plugin", "plugin.json"), "utf8"),
).version;

export const NAMING_STATIC_BUILD_DIR = process.env.NAMING_WIDGET_STATIC_DIR
  || path.join(tmpdir(), `naming-widget-build-v${pluginVersion}`);

const BUILD_MARKER_FILE = ".naming-widget-build.json";

let cachedStaticHtml = "";
let pendingStaticHtml = null;

export async function namingStaticHtml() {
  if (cachedStaticHtml) return cachedStaticHtml;

  pendingStaticHtml ??= buildNamingStaticHtml().finally(() => {
    pendingStaticHtml = null;
  });
  cachedStaticHtml = await pendingStaticHtml;
  return cachedStaticHtml;
}

async function buildNamingStaticHtml() {
  ensureViteBinary();
  await ensureStaticBuildDir();
  return inlineViteBuild(NAMING_STATIC_BUILD_DIR);
}

async function ensureStaticBuildDir() {
  const sourceHash = await buildSourceHash();
  if (existsSync(path.join(NAMING_STATIC_BUILD_DIR, "index.html"))) {
    const marker = await readBuildMarker();
    if (marker?.sourceHash === sourceHash) return;
  }

  await runViteBuild(NAMING_STATIC_BUILD_DIR);
  await writeBuildMarker(sourceHash);
}

// 依赖引导与 start-workbench.mjs 同策略：pnpm hoisted 优先，npm 兜底。
function ensureViteBinary() {
  if (existsSync(viteBinaryPath())) return;

  const install = spawnSync("pnpm", ["install", "--config.node-linker=hoisted"], {
    cwd: pluginRoot(),
    stdio: "ignore",
  });
  if (install.status !== 0) {
    spawnSync("npm", ["install"], { cwd: pluginRoot(), stdio: "ignore" });
  }
  if (!existsSync(viteBinaryPath())) {
    throw new Error("Missing Vite dependency after install in the naming plugin directory.");
  }
}

function viteBinaryPath() {
  return pluginPath(
    "node_modules",
    ".bin",
    process.platform === "win32" ? "vite.cmd" : "vite",
  );
}

function runViteBuild(outDir) {
  return runCommand(process.execPath, [
    pluginPath("scripts", "vite-build-once.mjs"),
    pluginRoot(),
    "--outDir",
    outDir,
    "--emptyOutDir",
    "--widget",
  ], {
    cwd: pluginRoot(),
    failureLabel: "Vite build failed while preparing the naming widget",
  });
}

function runCommand(command, args, { cwd, env = {}, failureLabel }) {
  return new Promise((resolve, reject) => {
    const logs = [];
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env,
        BROWSER: "none",
        FORCE_COLOR: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const capture = (chunk) => {
      logs.push(String(chunk));
      if (logs.length > 120) logs.shift();
    };
    child.stdout?.on("data", capture);
    child.stderr?.on("data", capture);

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${failureLabel} (${signal || `code ${code}`}).\n${logs.join("")}`));
    });
  });
}

async function readBuildMarker() {
  try {
    return JSON.parse(
      await readFile(path.join(NAMING_STATIC_BUILD_DIR, BUILD_MARKER_FILE), "utf8"),
    );
  } catch (_error) {
    return null;
  }
}

async function writeBuildMarker(sourceHash) {
  await writeFile(
    path.join(NAMING_STATIC_BUILD_DIR, BUILD_MARKER_FILE),
    `${JSON.stringify({ sourceHash }, null, 2)}\n`,
  );
}

async function buildSourceHash() {
  const hash = createHash("sha256");
  hash.update(pluginVersion);

  const sourceFiles = [
    pluginPath(".codex-plugin", "plugin.json"),
    pluginPath("index.html"),
    pluginPath("package.json"),
    pluginPath("pnpm-lock.yaml"),
    pluginPath("vite.config.mjs"),
    pluginPath("postcss.config.js"),
    pluginPath("tailwind.config.js"),
    pluginPath("components.json"),
    ...(await listFiles(pluginPath("src"))),
  ].sort();

  for (const file of sourceFiles) {
    hash.update(path.relative(pluginRoot(), file));
    hash.update(await readFile(file));
  }

  return hash.digest("hex");
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

// ============================================================
// 内联手术：modulepreload 剥除、样式内联 <style>、模块脚本转经典
// IIFE，最后做 CSP 兼容断言——widget 不允许任何外部资源。
// ============================================================
async function inlineViteBuild(outDir) {
  let html = await readFile(path.join(outDir, "index.html"), "utf8");
  const inlineScripts = [];
  const consumedAssets = new Set();

  html = html.replace(
    /<link\s+rel="modulepreload"[^>]+href="([^"]+)"[^>]*>\s*/g,
    "",
  );

  // widget 无需 favicon；data: 占位 link 也过不了外壳级 CSP 断言，直接剥除。
  html = html.replace(/<link\s+rel="icon"[^>]*>\s*/gi, "");

  html = await replaceAsync(
    html,
    /<link\s+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g,
    async (_match, href) => {
      const css = await readBuildAsset(outDir, href, consumedAssets);
      return `<style>\n${escapeInlineStyle(css)}\n</style>`;
    },
  );

  html = await replaceAsync(
    html,
    /<script\s+type="module"[^>]+src="([^"]+)"[^>]*><\/script>/g,
    async (_match, src) => {
      const js = await readBuildAsset(outDir, src, consumedAssets);
      inlineScripts.push(`<script>\n(() => {\n${escapeInlineScript(js)}\n})();\n</script>`);
      return "";
    },
  );

  if (/\b(?:src|href)\s*=\s*"[^"]*\/assets\//i.test(html)) {
    throw new Error("The naming widget still references external build assets.");
  }

  const assetsDir = path.join(outDir, "assets");
  if (existsSync(assetsDir)) {
    const leftovers = (await readdir(assetsDir)).filter(
      (name) => !consumedAssets.has(`assets/${name}`),
    );
    if (leftovers.length > 0) {
      throw new Error(
        `The naming widget build emitted non-inlined assets: ${leftovers.join(", ")}`,
      );
    }
  }

  if (inlineScripts.length > 0) {
    const scripts = inlineScripts.join("\n");
    html = html.includes("</body>")
      ? html.replace("</body>", () => `${scripts}\n</body>`)
      : `${html}\n${scripts}`;
  }

  assertCspCompatibleStaticHtml(html);
  return html;
}

function assertCspCompatibleStaticHtml(html) {
  const shellMarkup = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");

  const forbiddenShellPatterns = [
    [/<script\b[^>]+\bsrc\s*=/i, "external script tag"],
    [/<script\b[^>]*\btype\s*=\s*["']module["']/i, "module script tag"],
    [/<link\b[^>]+\bhref\s*=/i, "external link tag"],
    [/<iframe\b/i, "iframe tag"],
    [/<(?:object|embed|base)\b/i, "embedded/base tag"],
  ];
  for (const [pattern, label] of forbiddenShellPatterns) {
    if (pattern.test(shellMarkup)) {
      throw new Error(`The naming widget is not CSP-compatible: found ${label}.`);
    }
  }

  for (const value of resourceAttributeValues(shellMarkup)) {
    if (isExternalResourceValue(value)) {
      throw new Error(
        `The naming widget is not CSP-compatible: found external resource ${value}.`,
      );
    }
  }

  if (/\bfetch\s*\(/i.test(html) && !html.includes("__NAMING_WIDGET_FETCH_GUARD__")) {
    throw new Error(
      "The naming widget is not CSP-compatible: found fetch() without the fetch guard.",
    );
  }
}

function resourceAttributeValues(markup) {
  return Array.from(
    markup.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi),
    (match) => match[2].trim(),
  );
}

function isExternalResourceValue(value) {
  if (!value) return false;
  if (/^(?:#|data:|blob:|about:blank\b)/i.test(value)) return false;
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|\.{1,2}\/)/i.test(value);
}

async function readBuildAsset(outDir, assetPath, consumedAssets) {
  const normalized = assetPath.replace(/^\//, "");
  consumedAssets?.add(normalized);
  return readFile(path.join(outDir, normalized), "utf8");
}

async function replaceAsync(source, pattern, replacer) {
  const matches = Array.from(source.matchAll(pattern));
  let result = "";
  let lastIndex = 0;

  for (const match of matches) {
    result += source.slice(lastIndex, match.index);
    result += await replacer(...match);
    lastIndex = match.index + match[0].length;
  }

  return result + source.slice(lastIndex);
}

function escapeInlineScript(source) {
  return source.replaceAll("</script", "<\\/script").replaceAll("</SCRIPT", "<\\/SCRIPT");
}

function escapeInlineStyle(source) {
  return source.replaceAll("</style", "<\\/style").replaceAll("</STYLE", "<\\/STYLE");
}
