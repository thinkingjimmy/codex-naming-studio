# Codex Naming Studio - Codex 原生起名工作台

React 19 + Vite 6 + Tailwind CSS 3 + shadcn 风格组件 + Phosphor Icons + Vite 状态 middleware + Codex MCP state tools

Codex Naming Studio 是一个可安装到 Codex 的中文起名产品。Codex 启动本地工作台并在内置浏览器中打开，用户填写宝宝信息点击生成，请求经状态文件交给 Codex，Codex 运行测算后通过 MCP 工具把结构化结果写回，浏览器自动展示。全程零 API key。

## 安装

正式用法完全发生在 Codex 内：安装为 Codex 插件，内置浏览器里填信息，Codex 自己测算并回写结果，全程不需要任何 API key。

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

## 职责协议

每个阶段谁做什么，一张表说清。Codex 在安装阶段依据本表行动（此时 skill 尚未加载）；启动与生成阶段的 Codex 职责由 `skills/` 内的协议镜像承载。

| 阶段 | 用户做什么 | Codex 做什么 |
| --- | --- | --- |
| 安装 | 把安装提示词发给 Codex；完成后**新开一个对话** | 1. clone 仓库到 `~/plugins/codex-naming-studio` 2. `pnpm install` 3. `pnpm probe:mcp` 验证 MCP 状态工具 4. 确认 `.codex-plugin/plugin.json` 存在 5. 确认 `~/.agents/plugins/marketplace.json` 有插件条目（名字与路径必须与 plugin.json 一致）6. `codex plugin marketplace add ~` 7. `codex plugin add codex-naming-studio@personal` 8. 用 `codex plugin list` 校验状态为 `installed, enabled` 9. 提醒用户新开对话 |
| 启动 | 在新对话中说"打开起名工作台" | 触发 `naming-studio-open`：后台运行 `NAMING_PROJECT_DIR=<用户工作区> node scripts/start-workbench.mjs`，在内置浏览器打开 `http://127.0.0.1:43318`，然后运行 `scripts/watch-naming-request.mjs` 阻塞等待请求。**禁止**索要任何 API key |
| 生成 | 左栏填写宝宝信息，点击"生成好名"，等待右侧 loading 结束 | watcher 打印出 pending 请求后触发 `naming-studio-generate`：按 plan 先执行带 skill 的步骤（`naming-studio-bazi` 排盘、`naming-studio-research` 搜索），再按硬约束生成 8-12 个候选，调用 `save_naming_product_result` 回写，然后重新 arm watcher；失败也必须用 `result.error` 回写，绝不让 GUI 空转 |

## 故障排查

- **浏览器页面打不开或提示"本地工作台服务未运行"**：工作台服务器没在跑。在 Codex 对话中重新说"打开起名工作台"。
- **Codex 说打开了但浏览器没出现**：插件可能未加载——用 `codex plugin list` 确认 `codex-naming-studio@personal` 为 `installed, enabled`，然后新开对话重试。
- **点击生成后一直 loading**：Codex 侧 watcher 可能已超时退出。在对话里说"继续等待起名请求"或"处理待办的起名请求"，或检查 `<工作区>/.naming-product/state.json` 中该请求的 status。
- **端口 43318 被占用**：用 `NAMING_WORKBENCH_PORT` 换端口重启启动器。

## 使用

在 Codex 中说：

```text
打开起名工作台
```

Codex 会启动本地工作台服务器并在内置浏览器打开 `http://127.0.0.1:43318`，不需要任何 API key：

1. 在左栏填写宝宝信息（右侧保持空白状态）。
2. 点击"生成好名"，请求写入状态文件，右侧进入 loading。
3. Codex 的请求监听器立即拿到请求与执行计划，按计划测算后调用 `save_naming_product_result` 回写，浏览器自动展示评分、五行、寓意与对比卡片。

请求与结果状态保存在当前工作区的 `.naming-product/state.json`。

## 技能

- `codex-naming-studio:naming-studio-open`：启动工作台服务器、打开内置浏览器并 arm 请求监听器。
- `codex-naming-studio:naming-studio-generate`：编排 GUI 生成请求——按约束计划先跑八字/研究步骤，再测算候选名并回写结果。
- `codex-naming-studio:naming-studio-research`：外部事实研究——搜索热门名字避让清单、审查普通话谐音。
- `codex-naming-studio:naming-studio-bazi`：八字五行算法——节气排四柱、藏干加权统计五行、日主强弱三参、喜用神推导与用字五行判定。出生时间勾选项关闭时整个五行维度从计划、数据与 UI 中消失。

GUI 的每个勾选与输入由 `src/lib/task-plan.js` 的规则表翻译为执行计划：带 skill 的步骤（如勾选"避开热门名字"触发 `naming-studio-research` 搜索）先执行，其余作为生成硬约束。计划由服务端在请求落盘时推导，写进 `.naming-product/state.json`，Codex 与浏览器看到同一份真相。

## 本地开发

```bash
pnpm install
pnpm probe:mcp   # 验证 MCP 状态工具闭环
pnpm dev         # 启动工作台（默认 http://127.0.0.1:43318，状态写入当前目录）
pnpm quality     # 语法检查 + 构建 + 探针
```

开发时没有 Codex 回写请求，可用 MCP client 或直接调 `save_naming_product_result` 模拟结果；GUI 每 1.6 秒轮询状态文件。

## Architecture

<directory>
.codex-plugin/ - Codex 插件身份声明 (0子目录)
assets/ - 插件展示资产预留位 (0子目录)
mcp/ - Codex 侧请求/结果状态 MCP 边界 (1子目录: lib)
scripts/ - 工作台启动器、请求监听器与 MCP 探针 (0子目录)
skills/ - Codex 操作协议 (4子目录: naming-studio-open, naming-studio-generate, naming-studio-research, naming-studio-bazi)
src/ - 前端产品机器相 (2子目录: components, lib)
</directory>

<config>
package.json - 脚本与依赖声明，含 @phosphor-icons/react 统一图标边界
pnpm-lock.yaml - pnpm 依赖锁定文件
.mcp.json - Codex MCP stdio server 注册入口
.codex-plugin/plugin.json - Codex 插件元数据与 skill/MCP 声明
.gitignore - 开源仓库忽略 node_modules、构建产物、临时截图与状态文件
LICENSE - MIT 开源许可证
.npmrc - 项目级 pnpm 缓存与非交互安装策略
index.html - Vite HTML 入口与空 favicon 声明
vite.config.mjs - Vite 入口、React 插件、@ 路径别名与状态 API middleware
tailwind.config.js - shadcn 语义色、字体、阴影与响应式扫描
postcss.config.js - Tailwind 与 Autoprefixer 编译链
components.json - shadcn 组件生成约定
pnpm-workspace.yaml - pnpm 构建脚本白名单，允许 esbuild 完成 Vite 运行时准备
design-qa.md - 源截图与实现截图的设计 QA 门禁记录
</config>

架构决策: 单一形态——Codex 内置浏览器 + 本地状态服务器 + 文件状态闭环。`.naming-product/state.json` 是唯一真相源：浏览器 GUI 经 Vite middleware 读写它，Codex 经 MCP 状态工具读写它（候选统一走 normalizeCandidates），`scripts/watch-naming-request.mjs` 让 Codex 阻塞等待新请求。没有任何模型密钥；Codex 自身推理就是模型。

开发规范: 新增或改变业务文件时先更新 L3 头部，再检查最近 README.md。

变更日志:
- 2026-07-08: 重构为 Cowart 式浏览器单形态——native widget 与 OpenAI llm-bridge 整体退役，状态 API 内嵌 Vite middleware，新增 start-workbench 启动器与 watch-naming-request 监听器，naming-state 成为 MCP 与 middleware 共享的状态单一真相源，全程零 key。
- 2026-07-08: 新增职责协议表与故障排查——安装/启动/生成三阶段的用户与 Codex 分工，覆盖 fallback 提示误导、widget 未加载、首次构建等待与 loading 卡死四类常见问题。
- 2026-07-08: 出生时间改为勾选项（useBazi），关闭时五行维度从计划/数据/UI 全链路消失；五行算法升级为 naming-studio-bazi skill（节气排盘、藏干加权、喜用神推导），探针新增路由断言。
- 2026-07-08: 新增 task-plan 约束路由层——GUI 勾选经规则表翻译为执行计划（研究 skill 触发 + 生成硬约束），持久化进请求状态并渲染进 follow-up prompt，新增 naming-studio-research skill 与探针断言。
- 2026-07-08: 对齐 Cowart 插件形态——README 改为 Codex 安装优先并声明零 key 用法，skill 拆分为 open/generate 两个并补齐 agents/openai.yaml，follow-up prompt 指向具体 skill。
- 2026-07-08: 删除宝宝信息中的出生地输入，新增普通话谐音与热门名字筛选约束。
- 2026-07-08: 修复姓氏拼音 IME 输入截断，统一前端图标为 Phosphor Icons，并遮罩原生日期时间图标重叠。
- 2026-07-08: 修复开发启动器端口占用语义，健康 bridge 复用、坏占用中止，并补充项目启动文档。
- 2026-07-08: 代码 Review 修复 widget 存储目标监听竞态、轮询闭包依赖、风险排序语义、CORS 204 协议违规与错误响应解析，消除死代码并接通风格重置按钮。
- 2026-07-08: GUI 品牌改为 codex 起名，移除原型阶段的旧品牌文案。
- 2026-07-08: 项目命名为 Codex Naming Studio，整理为可开源仓库。
- 2026-07-08: 升级为 Codex 插件形态，新增 MCP native widget、skill 协议与请求/结果状态闭环。
- 2026-07-08: 播种起名产品原型，建立 L1/L2/L3 分形文档。
