# scripts/

> L2 | 父级: ../README.md

成员清单
start-workbench.mjs: 兜底工作台启动器——先健康复用同项目服务，再修复依赖并以插件根启 Vite（默认 127.0.0.1:43318），NAMING_PROJECT_DIR 指定状态归属的用户项目；主形态为原生 widget，本脚本仅供开发与降级。
watch-naming-request.mjs: 兜底模式 Codex 侧请求监听器——默认 300ms 轮询 latestPendingRequest，命中打印最新请求 JSON（含 plan）exit 0，超时 exit 2；widget 模式无需监听器。
start-mcp.mjs: Codex MCP stdio 入口，启动 mcp/server.mjs。
vite-build-once.mjs: 一次性 Vite 构建执行器，--widget 时置 NAMING_WIDGET_BUILD=1 与 production 产出 widget 单文件包，被 naming-static-widget.mjs 子进程调用。
probe-mcp.mjs: MCP 探针，验证状态工具闭环、单一 pending 规则、约束路由推导与 widget 资源/渲染工具的 CSP 兼容单文件产物。
probe-concurrency.mjs: 四进程交错与四幕目录代际锁探针，覆盖双接管、SIGSTOP、陈旧 reaper + 第三写入者提交窗和双 claim 栅栏。
probe-crash.mjs: acquire/state-trigger/trigger-rename 故障注入探针，验证目录/旧文件死锁 fence 接管、显式修复与零读取后台补投。

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
