# scripts/

> L2 | 父级: ../README.md

成员清单
start-workbench.mjs: 工作台启动器——先健康复用同项目服务，再修复依赖并以插件根启 Vite（默认 127.0.0.1:43318），NAMING_PROJECT_DIR 指定状态归属的用户项目。
watch-naming-request.mjs: Codex 侧请求监听器——默认 300ms 轮询 latestPendingRequest，命中打印最新请求 JSON（含 plan）exit 0，超时 exit 2。
start-mcp.mjs: Codex MCP stdio 入口，启动 mcp/server.mjs。
probe-mcp.mjs: MCP 探针，验证状态工具闭环、单一 pending 规则与约束路由推导。

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
