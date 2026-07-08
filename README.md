# Codex Naming Studio - Codex 原生起名工作台

React 19 + Vite 6 + Tailwind CSS 3 + shadcn 风格组件 + Codex MCP widget + Node HTTP fallback + OpenAI Responses API

Codex Naming Studio 是一个可安装到 Codex 的中文起名产品。用户在 Codex 内置 widget 里填写宝宝信息，点击生成后 GUI 将请求交给 Codex，Codex 运行起名测算并通过 MCP 工具把结构化结果写回界面。

## Usage

```bash
pnpm install
pnpm probe:mcp
pnpm dev
```

Codex 插件入口由 `.codex-plugin/plugin.json` 与 `.mcp.json` 声明。安装为 Codex plugin 后，使用 `$codex-naming-studio` 打开原生 widget。

## Architecture

<directory>
.codex-plugin/ - Codex 插件身份声明 (0子目录)
assets/ - 插件展示资产预留位 (0子目录)
mcp/ - Codex native widget 与请求状态 MCP 边界 (1子目录: lib)
scripts/ - 开发、构建与 MCP 探针脚本 (0子目录)
server/ - 普通浏览器开发 fallback 后端 (0子目录)
skills/ - Codex 操作协议 (1子目录: codex-naming-studio)
src/ - 前端产品机器相 (2子目录: components, lib)
</directory>

<config>
package.json - 脚本与依赖声明
pnpm-lock.yaml - pnpm 依赖锁定文件
.mcp.json - Codex MCP stdio server 注册入口
.codex-plugin/plugin.json - Codex 插件元数据与 skill/MCP 声明
.gitignore - 开源仓库忽略 node_modules、构建产物、临时截图与密钥文件
LICENSE - MIT 开源许可证
.env.example - 本地 LLM bridge 环境变量样例
.npmrc - 项目级 pnpm 缓存与非交互安装策略
index.html - Vite HTML 入口与空 favicon 声明
vite.config.mjs - Vite 入口、React 插件、@ 路径别名与 widget 单包构建规则
tailwind.config.js - shadcn 语义色、字体、阴影与响应式扫描
postcss.config.js - Tailwind 与 Autoprefixer 编译链
components.json - shadcn 组件生成约定
pnpm-workspace.yaml - pnpm 构建脚本白名单，允许 esbuild 完成 Vite 运行时准备
design-qa.md - 源截图与实现截图的设计 QA 门禁记录
</config>

架构决策: 正式路径是 Codex native widget。前端只采集约束、显示空白/loading/结果；`mcp/server.mjs` 保存请求与结果；Codex 通过 skill 读取请求、运行测算、调用 `save_naming_product_result` 回写 GUI。`server/llm-bridge.js` 仅保留为普通浏览器本地开发 fallback。模型密钥不进入浏览器。

开发规范: 新增或改变业务文件时先更新 L3 头部，再检查最近 README.md。

变更日志:
- 2026-07-08: 项目命名为 Codex Naming Studio，整理为可开源仓库。
- 2026-07-08: 升级为 Codex 插件形态，新增 MCP native widget、skill 协议与请求/结果状态闭环。
- 2026-07-08: 播种起名产品原型，建立 L1/L2/L3 分形文档。
