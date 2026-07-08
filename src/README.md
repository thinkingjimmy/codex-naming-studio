# src/

> L2 | 父级: ../README.md

成员清单
App.jsx: 应用根组件，挂载 NameWorkbench，保持入口纯净。
main.jsx: React DOM 启动器，连接 index.html 与 App。
styles.css: Tailwind 入口与 shadcn CSS 变量，定义纸感背景、滑块与焦点规则。
components/: 产品组件层，承载工作台状态机、工作台面板与 shadcn 风格基础件。
lib/: 前端协议层，提供 Codex widget 客户端、HTTP fallback、起名候选标准化与 className 合并工具。

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
