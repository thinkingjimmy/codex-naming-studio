# scripts/

> L2 | 父级: ../README.md

成员清单
dev-full.mjs: 开发进程编排器，探测默认或 NAME_BRIDGE_PORT 指定端口的 bridge 健康状态，复用健康服务或启动 server/llm-bridge.js，再启动 Vite。
start-mcp.mjs: Codex MCP stdio 入口，启动 mcp/server.mjs。
vite-build-once.mjs: 一次性 Vite 构建适配器，供 native widget 静态内联器调用。
probe-mcp.mjs: MCP 探针，验证 widget 工具、状态闭环与单 HTML 资源。

架构决策: dev-full.mjs 只接受可证明的 bridge 状态。端口空闲则创建，`/api/health` 健康则复用，端口被坏服务占用则中止；前端通过 `VITE_NAME_BRIDGE_URL` 消费同一个 bridge 地址。

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
