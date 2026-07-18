# mcp/

> L2 | 父级: ../README.md

成员清单
server.mjs: Codex MCP server，注册 widget 资源/渲染、纯读状态、部分成功请求保存、claim 与 claimId 栅栏结果回写工具；instructions 固化 claim→claimId→回写链路。
lib/: MCP 内部工具库，封装插件路径、共享状态读写、widget 静态构建与宿主桥注入。

法则: MCP 只处理参数边界；并发状态 mutation 全部下沉 naming-state，纯读工具绝不修复或唤醒 Agent。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
