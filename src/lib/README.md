# lib/

> L2 | 父级: ../README.md

成员清单
api-client.js: 状态协议客户端，POST 请求到同源 /api/naming-request 并轮询 /api/naming-state 等待 Codex 回写。
name-engine.js: 起名候选标准化与兜底引擎，输出评分、五行、诗意摘要、命理解释与指标。
task-plan.js: 约束路由层，声明式规则表把 GUI 勾选翻译为 skill 触发步骤与生成硬约束，被 naming-state 状态库消费。
utils.js: cn 工具，合并 clsx 与 tailwind-merge 以消除 className 冲突。

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
