# mcp/lib/

> L2 | 父级: ../README.md

成员清单
plugin-root.mjs: 根目录定位器，统一插件文件寻址。
widget-resource.mjs: Codex native widget 资源注册与浏览器 host bridge 注入器。
naming-static-widget.mjs: Vite 构建内联器，把 React 前端压成单 HTML widget。

法则: lib 只提供机制，业务状态留给 mcp/server.mjs。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
