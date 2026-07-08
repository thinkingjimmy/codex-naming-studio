# mcp/lib/

> L2 | 父级: ../README.md

成员清单
plugin-root.mjs: 根目录定位器，统一插件文件寻址。
naming-state.mjs: 状态单一真相源——原子读写 .naming-product/state.json、请求 profile 归一化落盘（含 fullNameLength 与 plan 推导），并维护 latestPendingRequest 与旧 pending 的 superseded 退场规则。

法则: lib 只提供机制，业务状态形状与单一活跃请求规则留给 naming-state.mjs 统一定义。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
