# Codex Naming Studio - Codex 原生起名工作台

React 19 + Vite 6 + Tailwind CSS 3 + shadcn 风格组件 + Phosphor Icons + Codex MCP widget + Node HTTP fallback + OpenAI Responses API

Codex Naming Studio 是一个可安装到 Codex 的中文起名产品。用户在 Codex 内置 widget 里填写宝宝信息，点击生成后 GUI 将请求交给 Codex，Codex 运行起名测算并通过 MCP 工具把结构化结果写回界面。

## 安装

正式用法完全发生在 Codex 内：安装为 Codex 插件，原生 widget 里填信息，Codex 自己测算并回写结果，全程不需要任何 API key。

### 让 Codex 自动安装

把下面这段发给 Codex：

```text
请从 https://github.com/thinkingjimmy/codex-naming-studio.git 安装 Codex Naming Studio 插件。
请 clone 仓库到 ~/plugins/codex-naming-studio，进入目录运行 pnpm install 和 pnpm probe:mcp，
确认 .codex-plugin/plugin.json 存在，把插件加入 personal marketplace，
先运行 codex plugin marketplace add ~，再运行 codex plugin add codex-naming-studio@personal。
安装后请校验插件，并告诉我是否需要开启一个新对话来加载新技能和 MCP 工具。
```

### 手动安装

```bash
mkdir -p ~/plugins
git clone https://github.com/thinkingjimmy/codex-naming-studio.git ~/plugins/codex-naming-studio
cd ~/plugins/codex-naming-studio
pnpm install
pnpm probe:mcp
```

确保 `~/.agents/plugins/marketplace.json` 中有插件条目：

```json
{
  "name": "personal",
  "interface": { "displayName": "Personal" },
  "plugins": [
    {
      "name": "codex-naming-studio",
      "source": { "source": "local", "path": "./plugins/codex-naming-studio" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Productivity"
    }
  ]
}
```

然后注册并安装：

```bash
codex plugin marketplace add ~
codex plugin add codex-naming-studio@personal
```

安装后建议开启一个新的 Codex 对话，让新的 skill 和 MCP 工具完整加载。

## 使用

在 Codex 中说：

```text
打开起名工作台
```

Codex 会通过 `render_naming_product_widget` 打开原生 widget，不需要启动本地网页服务，也不需要任何 API key：

1. 在左栏填写宝宝信息（右侧保持空白状态）。
2. 点击"生成好名"，请求交给 Codex，右侧进入 loading。
3. Codex 运行测算后调用 `save_naming_product_result` 回写，GUI 自动展示评分、五行、寓意与对比卡片。

请求与结果状态保存在当前项目的 `.naming-product/state.json`。

## 技能

- `codex-naming-studio:naming-studio-open`：打开起名工作台原生 widget。
- `codex-naming-studio:naming-studio-generate`：处理 GUI 生成请求，测算候选名并回写结果。

## 本地开发 fallback

不经 Codex、在普通浏览器里开发调试时才需要这条路径：

```bash
pnpm install
pnpm probe:mcp
pnpm dev
```

`pnpm dev` 会启动 Vite 前端，并确保本地 LLM bridge 可用:

- 默认 bridge 地址: `http://127.0.0.1:8787`
- 默认前端地址: Vite 从 `http://127.0.0.1:5173/` 开始选择，端口被占用时自动顺延
- 若 `8787` 已有健康的 `/api/health` 服务，启动器会直接复用
- 若 `8787` 被非健康服务占用，启动器会中止并提示换端口
- 若未设置 `OPENAI_API_KEY`，后端自动使用本地兜底候选，界面仍可完整体验

换用自定义 bridge 端口:

```bash
NAME_BRIDGE_PORT=8790 pnpm dev
```

手动只跑前端时，必须显式告诉 Vite 后端地址:

```bash
VITE_NAME_BRIDGE_URL=http://127.0.0.1:8790 pnpm dev:vite
```

健康检查:

```bash
curl http://127.0.0.1:8787/api/health
```

## Architecture

<directory>
.codex-plugin/ - Codex 插件身份声明 (0子目录)
assets/ - 插件展示资产预留位 (0子目录)
mcp/ - Codex native widget 与请求状态 MCP 边界 (1子目录: lib)
scripts/ - 开发、构建与 MCP 探针脚本 (0子目录)
server/ - 普通浏览器开发 fallback 后端 (0子目录)
skills/ - Codex 操作协议 (2子目录: naming-studio-open, naming-studio-generate)
src/ - 前端产品机器相 (2子目录: components, lib)
</directory>

<config>
package.json - 脚本与依赖声明，含 @phosphor-icons/react 统一图标边界
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
- 2026-07-08: 对齐 Cowart 插件形态——README 改为 Codex 安装优先并声明零 key 用法，skill 拆分为 open/generate 两个并补齐 agents/openai.yaml，follow-up prompt 指向具体 skill。
- 2026-07-08: 删除宝宝信息中的出生地输入，新增普通话谐音与热门名字筛选约束。
- 2026-07-08: 修复姓氏拼音 IME 输入截断，统一前端图标为 Phosphor Icons，并遮罩原生日期时间图标重叠。
- 2026-07-08: 修复开发启动器端口占用语义，健康 bridge 复用、坏占用中止，并补充项目启动文档。
- 2026-07-08: 代码 Review 修复 widget 存储目标监听竞态、轮询闭包依赖、风险排序语义、CORS 204 协议违规与错误响应解析，消除死代码并接通风格重置按钮。
- 2026-07-08: GUI 品牌改为 codex 起名，移除原型阶段的旧品牌文案。
- 2026-07-08: 项目命名为 Codex Naming Studio，整理为可开源仓库。
- 2026-07-08: 升级为 Codex 插件形态，新增 MCP native widget、skill 协议与请求/结果状态闭环。
- 2026-07-08: 播种起名产品原型，建立 L1/L2/L3 分形文档。
