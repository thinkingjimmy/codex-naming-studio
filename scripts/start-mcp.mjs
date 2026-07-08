/**
 * - [INPUT]: 依赖 mcp/server.mjs 的 Codex MCP server 副作用启动。
 * - [OUTPUT]: 对外提供 node scripts/start-mcp.mjs 进程入口。
 * - [POS]: scripts 的插件运行入口，被 .mcp.json 作为 stdio server command 调用。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import "../mcp/server.mjs";
