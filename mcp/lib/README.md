# mcp/lib/

> L2 | 父级: ../README.md

成员清单
plugin-root.mjs: 根目录定位器，统一插件文件寻址。
naming-state.mjs: 并发状态单一真相源——PID+nonce 临时目录与非空锁原子发布、永久代际 fence、私有化释放、新残留按 PID/旧残留按年龄回收、双提交与 claimId 栅栏。
widget-resource.mjs: widget 宿主桥层——registerAppResource 双格式 CSP 元数据注册，向 HTML head 注入 ext-apps bundle 与 window.namingMcp 桥（follow-up 消息 / 服务端工具调用），移植自 Cowart。
naming-static-widget.mjs: widget 静态构建器——tmpdir 惰性构建、SHA-256 源码哈希缓存、样式脚本内联手术与 CSP 兼容断言，产出单文件 widget HTML。

法则: readStateUnlocked 是唯一读实现；mutation 必须持目录代际锁，死代 fence 不清理；新 owner 名携 PID，旧版无 PID 空 owner 仅老化后回收，结果必须携当前 claimId。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
