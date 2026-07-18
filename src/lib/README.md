# lib/

> L2 | 父级: ../README.md

成员清单
api-client.js: 双模状态协议客户端——统一校验 committed/triggerLagging 部分成功响应，纯读轮询状态，widget 模式另发 follow-up。
name-engine.js: 起名候选标准化与兜底引擎，统一 fullNameLength: 2/3 语义并输出完整 profile、评分、五行、诗意摘要、命理解释与指标。
task-plan.js: 约束路由层，声明式规则表把 GUI 勾选、完整姓名长度与风格强度翻译为 skill 触发步骤与生成硬约束，被 naming-state 状态库消费。
tone-preferences.js: 风格偏好语义层，统一 0-100 数值到强度文案与 plan 摘要。
utils.js: cn 工具，合并 clsx 与 tailwind-merge 以消除 className 冲突。

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
