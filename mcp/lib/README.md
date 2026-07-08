# mcp/lib/

> L2 | 父级: ../README.md

成员清单
plugin-root.mjs: 根目录定位器，统一插件文件寻址。
naming-state.mjs: 状态单一真相源——原子读写 .naming-product/state.json、请求落盘（含 plan 推导），被 MCP server 与 Vite middleware 共享。

法则: lib 只提供机制，业务状态形状留给 naming-state.mjs 统一定义。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
