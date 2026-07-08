/**
 * - [INPUT]: 依赖 node:url 与 node:path 推导当前插件根目录。
 * - [OUTPUT]: 对外提供 pluginRoot、pluginPath 路径工具。
 * - [POS]: mcp/lib 的根路径定位器，被 MCP server 消费。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PLUGIN_ROOT = path.resolve(MODULE_DIR, "..", "..");

export function pluginRoot() {
  return path.resolve(process.env.NAMING_PRODUCT_PLUGIN_ROOT || DEFAULT_PLUGIN_ROOT);
}

export function pluginPath(...parts) {
  return path.join(pluginRoot(), ...parts);
}
