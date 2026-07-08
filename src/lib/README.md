# lib/

> L2 | 父级: ../README.md

成员清单
api-client.js: 双模状态协议客户端——widget 模式经 window.namingMcp 调 MCP 状态工具并以 follow-up 消息唤醒 Codex，兜底模式 POST /api/naming-request 并轮询 /api/naming-state。
name-engine.js: 起名候选标准化与兜底引擎，统一 fullNameLength: 2/3 语义并输出完整 profile、评分、五行、诗意摘要、命理解释与指标。
task-plan.js: 约束路由层，声明式规则表把 GUI 勾选、完整姓名长度与风格强度翻译为 skill 触发步骤与生成硬约束，被 naming-state 状态库消费。
tone-preferences.js: 风格偏好语义层，统一 0-100 数值到强度文案与 plan 摘要。
utils.js: cn 工具，合并 clsx 与 tailwind-merge 以消除 className 冲突。

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
