# mcp/

> L2 | 父级: ../README.md

成员清单
server.mjs: Codex MCP server，注册 render_naming_workbench_widget 渲染工具、ui://widget/naming/workbench.html 资源与状态读取/请求保存/结果回写三个工具，并拒绝 superseded 旧请求回写覆盖新结果。
lib/: MCP 内部工具库，封装插件路径、共享状态读写、widget 静态构建与宿主桥注入。

法则: MCP 只处理边界协议与持久状态，不替代 Codex 做命名判断。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
