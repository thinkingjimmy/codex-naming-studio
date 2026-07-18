# mcp/lib/

> L2 | 父级: ../README.md

成员清单
plugin-root.mjs: 根目录定位器，统一插件文件寻址。
naming-state.mjs: 并发状态单一真相源——link 原子发布 + rename-审视-恢复代际锁、提交 nonce 栅栏、state→trigger 部分成功双提交、显式修复、pending/processing claimId 栅栏与纯读 publicState。
widget-resource.mjs: widget 宿主桥层——registerAppResource 双格式 CSP 元数据注册，向 HTML head 注入 ext-apps bundle 与 window.namingMcp 桥（follow-up 消息 / 服务端工具调用），移植自 Cowart。
naming-static-widget.mjs: widget 静态构建器——tmpdir 惰性构建、SHA-256 源码哈希缓存、样式脚本内联手术与 CSP 兼容断言，产出单文件 widget HTML。

法则: readStateUnlocked 是唯一读实现；所有 mutation 必须持代际锁，结果必须携当前 claimId，只有新请求推进 triggerRevision。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
