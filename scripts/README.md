# scripts/

> L2 | 父级: ../README.md

成员清单
dev-full.mjs: 开发进程编排器，同时启动 Vite 前端与 server/llm-bridge.js 后端。
start-mcp.mjs: Codex MCP stdio 入口，启动 mcp/server.mjs。
vite-build-once.mjs: 一次性 Vite 构建适配器，供 native widget 静态内联器调用。
probe-mcp.mjs: MCP 探针，验证 widget 工具、状态闭环与单 HTML 资源。

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
