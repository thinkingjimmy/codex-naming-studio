/**
 * - [INPUT]: 依赖 Vite 构建脚本、插件源码文件与临时目录文件系统。
 * - [OUTPUT]: 对外提供 namingStaticHtml 与 NAMING_STATIC_BUILD_DIR，返回可被 Codex widget 直接渲染的单 HTML。
 * - [POS]: mcp/lib 的静态 widget 构建器，把 React/Tailwind 构建物内联为 CSP 友好的资源。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { pluginPath, pluginRoot } from "./plugin-root.mjs";

const manifest = JSON.parse(readFileSync(pluginPath(".codex-plugin", "plugin.json"), "utf8"));
const BUILD_MARKER_FILE = ".naming-product-widget-build.json";

export const NAMING_STATIC_BUILD_DIR =
  process.env.NAMING_WIDGET_STATIC_DIR || path.join(tmpdir(), `naming-product-widget-v${manifest.version}`);

let cachedHtml = "";
let pendingHtml = null;

export async function namingStaticHtml() {
  if (cachedHtml) return cachedHtml;
  pendingHtml ??= buildStaticHtml().finally(() => {
    pendingHtml = null;
  });
  cachedHtml = await pendingHtml;
  return cachedHtml;
}

async function buildStaticHtml() {
  await ensureViteBinary();
  await ensureBuildDir();
  return inlineViteBuild(NAMING_STATIC_BUILD_DIR);
}

async function ensureViteBinary() {
  if (existsSync(viteBinaryPath())) return;
  await runInstall();
  if (!existsSync(viteBinaryPath())) {
    throw new Error("Missing Vite dependency after install in Naming Product plugin directory.");
  }
}

function viteBinaryPath() {
  return pluginPath("node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite");
}

function runInstall() {
  const isWin = process.platform === "win32";
  return runCommand(
    isWin ? "cmd.exe" : "npm",
    isWin ? ["/d", "/s", "/c", "npm", "install"] : ["install"],
    {
      cwd: pluginRoot(),
      failureLabel: "npm install failed while preparing Naming Product widget",
    },
  );
}

async function ensureBuildDir() {
  const sourceHash = await buildSourceHash();
  const marker = await readBuildMarker();
  if (existsSync(path.join(NAMING_STATIC_BUILD_DIR, "index.html")) && marker?.sourceHash === sourceHash) return;

  await runCommand(process.execPath, [
    pluginPath("scripts", "vite-build-once.mjs"),
    pluginRoot(),
    "--outDir",
    NAMING_STATIC_BUILD_DIR,
    "--emptyOutDir",
  ], {
    cwd: pluginRoot(),
    env: { NAMING_WIDGET_BUILD: "1" },
    failureLabel: "Vite build failed while preparing Naming Product widget",
  });
  await writeFile(
    path.join(NAMING_STATIC_BUILD_DIR, BUILD_MARKER_FILE),
    `${JSON.stringify({ sourceHash }, null, 2)}\n`,
  );
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
      if (code === 0) resolve();
      else reject(new Error(`${failureLabel} (${signal || `code ${code}`}).\n${logs.join("")}`));
    });
  });
}

async function readBuildMarker() {
  try {
    return JSON.parse(await readFile(path.join(NAMING_STATIC_BUILD_DIR, BUILD_MARKER_FILE), "utf8"));
  } catch (_error) {
    return null;
  }
}

async function buildSourceHash() {
  const hash = createHash("sha256");
  hash.update(manifest.version);

  const files = [
    pluginPath(".codex-plugin", "plugin.json"),
    pluginPath("index.html"),
    pluginPath("package.json"),
    pluginPath("pnpm-lock.yaml"),
    pluginPath("vite.config.mjs"),
    pluginPath("tailwind.config.js"),
    ...(await listFilesIfExists(pluginPath("src"))),
    ...(await listFilesIfExists(pluginPath("public"))),
  ].sort();

  for (const file of files) {
    hash.update(path.relative(pluginRoot(), file));
    hash.update(await readFile(file));
  }
  return hash.digest("hex");
}

async function listFilesIfExists(root) {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await listFilesIfExists(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

async function inlineViteBuild(outDir) {
  let html = await readFile(path.join(outDir, "index.html"), "utf8");
  const scripts = [];
  const consumed = new Set();

  html = html.replace(/<link\s+rel="modulepreload"[^>]+href="([^"]+)"[^>]*>\s*/g, "");
  html = await replaceAsync(html, /<link\s+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g, async (_match, href) => {
    const css = await readBuildAsset(outDir, href, consumed);
    return `<style>\n${escapeStyle(css)}\n</style>`;
  });
  html = await replaceAsync(html, /<script\s+type="module"[^>]+src="([^"]+)"[^>]*><\/script>/g, async (_match, src) => {
    const js = await readBuildAsset(outDir, src, consumed);
    scripts.push(`<script>\n(() => {\n${escapeScript(js)}\n})();\n</script>`);
    return "";
  });

  const assetsDir = path.join(outDir, "assets");
  if (existsSync(assetsDir)) {
    const leftovers = (await readdir(assetsDir)).filter((name) => !consumed.has(`assets/${name}`));
    if (leftovers.length > 0) {
      throw new Error(`Naming Product widget emitted non-inlined assets: ${leftovers.join(", ")}`);
    }
  }

  if (scripts.length > 0) {
    html = html.includes("</body>")
      ? html.replace("</body>", `${scripts.join("\n")}\n</body>`)
      : `${html}\n${scripts.join("\n")}`;
  }

  assertStaticHtml(html);
  return html;
}

async function readBuildAsset(outDir, assetPath, consumed) {
  const normalized = assetPath.replace(/^\//, "");
  consumed.add(normalized);
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

function assertStaticHtml(html) {
  const shell = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
  const forbidden = [
    [/<script\b[^>]+\bsrc\s*=/i, "external script"],
    [/<script\b[^>]*\btype\s*=\s*["']module["']/i, "module script"],
    [/<iframe\b/i, "iframe"],
    [/<(?:object|embed|base)\b/i, "embedded/base tag"],
  ];

  for (const [pattern, label] of forbidden) {
    if (pattern.test(shell)) throw new Error(`Naming Product widget is not CSP-compatible: ${label}.`);
  }
  for (const value of resourceValues(shell)) {
    if (isExternal(value)) throw new Error(`Naming Product widget keeps an external resource: ${value}`);
  }
}

function resourceValues(markup) {
  return Array.from(markup.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi), (match) => match[2].trim());
}

function isExternal(value) {
  if (!value) return false;
  if (/^(?:#|data:|blob:|about:blank\b)/i.test(value)) return false;
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|\.{1,2}\/)/i.test(value);
}

function escapeScript(source) {
  return source.replaceAll("</script", "<\\/script").replaceAll("</SCRIPT", "<\\/SCRIPT");
}

function escapeStyle(source) {
  return source.replaceAll("</style", "<\\/style").replaceAll("</STYLE", "<\\/STYLE");
}
