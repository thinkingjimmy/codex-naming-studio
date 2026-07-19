# Codex Naming Studio - 事件驱动的 Codex 起名工作台

React 19 + Vite 6 + Tailwind CSS 3 + shadcn 风格组件 + Phosphor Icons + Vite 状态 middleware + Codex MCP state tools

Codex Naming Studio 是一个可安装到 Codex、也可由桌面产品托管的中文起名产品。GUI 把请求原子写入状态文件并发布专用 trigger；Codex 单轮 claim 请求、完成测算后携 claimId 回写，浏览器自动展示。原生 widget 仍可用，全程零 API key。

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
| 启动 | 在新对话中说"打开起名工作台" | 触发 `naming-studio-open`：调用 `render_naming_workbench_widget`（projectDir 传用户工作区）把工作台渲染为原生 Codex widget；首次渲染会惰性构建单文件包。widget 渲染失败时才降级到 localhost 兜底（start-workbench + 内置浏览器 + watcher）。**禁止**索要任何 API key |
| 生成 | 左栏填写宝宝信息，点击"生成好名"，等待右侧 loading 结束；连续点击时新请求自动取代旧 pending/processing | 请求先提交 `state.json` 再发布 `trigger.json`；Codex 调 `claim_naming_product_request` 取得 claimId，按 plan 生成 8-12 个候选，再携同一 claimId 调 `save_naming_product_result`。hosted 单轮结束即退出，不启动 watcher/server；失败也必须携 claimId 回写 `result.error` |

## Hosted 状态与并发协议

状态机只有两种在飞态与三种既有终态：

```text
pending --claim(claimId)--> processing --matching claimId--> completed | error
    \                              \
     \--new request----------------> superseded
```

- `.naming-product/state.json` 是业务真相源；`.naming-product/trigger.json` 是只在新请求到达时推进 `triggerRevision` 的调度信号。
- 提交顺序固定为 state 后 trigger。state 成功、trigger 暂败时返回 `{ committed: true, triggerLagging: true }`，GUI 继续轮询，写入进程后台指数退避补投；纯读 API 永不修复。
- 所有 mutation 先在同目录写完整的非空 `state.owner-<pid>-<nonce>.tmp/`，再以 `rename` 原子发布为 `state.lock/`。普通构造失败由 `finally` 清理；新格式残留即使 owner 未写完也可从目录名机械检查 PID，旧版无 PID 的空/损坏残留只有充分老化后才回收，避免误删活跃 mkdir→write 窗口。只有死 PID 可被移入永久保留的 `state.reap-<nonce>/` 代际 fence；历史 release/garbage 可由后继安全收敛。每次数据 rename 前仍重验当前 owner。
- `processing` 可以重新 claim，后一个 claimId 取代前一个。结果回写必须匹配当前 `claimOwner.claimId`；旧轮最多浪费计算，不能覆盖新结果。

## 故障排查

- **浏览器页面打不开或提示"本地工作台服务未运行"**：工作台服务器没在跑。在 Codex 对话中重新说"打开起名工作台"。
- **Codex 说打开了但浏览器没出现**：插件可能未加载——用 `codex plugin list` 确认 `codex-naming-studio@personal` 为 `installed, enabled`，然后新开对话重试。
- **点击生成后 loading 不结束**：pending 超过 2 分钟会提示尚未接管；已经 claim 的 processing 保持“Codex 测算中”并允许 10 分钟。再次点击会创建新 pending，并把旧 pending/processing 标记为 `superseded`。
- **端口 43318 被占用**：启动器会区分同项目工作台、其他项目工作台与非工作台服务；同项目直接复用，其他情况用 `NAMING_WORKBENCH_PORT` 换端口重启。

## 使用

在 Codex 中说：

```text
打开起名工作台
```

Codex 会把工作台渲染为原生 widget（首次渲染需构建，稍等片刻），不需要任何 API key：

1. 在左栏填写宝宝信息（右侧保持空白状态）。
2. 点击"生成好名"，widget 保存请求并自动向对话发送「处理起名请求」消息，右侧进入 loading。
3. Codex 先 claim 拿到 claimId，按计划测算后携 claimId 调用 `save_naming_product_result` 回写，widget 轮询自动展示评分、五行、寓意与全维度解析。

widget 渲染失败时 Codex 会降级到 localhost 兜底：启动本地服务器并在内置浏览器打开 `http://127.0.0.1:43318`，由请求监听器传递生成请求。

请求与结果状态保存在当前工作区的 `.naming-product/state.json`。

## 技能

- `codex-naming-studio:naming-studio-open`：渲染原生工作台 widget；失败时降级为 localhost 服务器 + 内置浏览器 + 请求监听器。
- `codex-naming-studio:naming-studio-generate`：编排 GUI 生成请求——按约束计划先跑八字/研究步骤，再测算候选名并回写结果。
- `codex-naming-studio:naming-studio-research`：外部事实研究——搜索热门名字避让清单、审查普通话谐音。
- `codex-naming-studio:naming-studio-bazi`：八字五行算法——节气排四柱、藏干加权统计五行、日主强弱三参、喜用神推导与用字五行判定。出生时间勾选项关闭时整个五行维度从计划、数据与 UI 中消失。

GUI 的每个勾选、输入与风格强度由 `src/lib/task-plan.js` 的规则表翻译为执行计划：带 skill 的步骤（如勾选"避开热门名字"触发 `naming-studio-research` 搜索）先执行，其余作为生成硬约束。名字字数使用 `fullNameLength: 2 | 3` 表示完整姓名长度，消除历史 `single/double` 枚举歧义。风格强度的 0-100 数值由 `src/lib/tone-preferences.js` 统一映射为"关闭/较弱/中等/较强/强"，UI 与 plan 共用同一真相源。计划由服务端在请求落盘时推导，写进 `.naming-product/state.json`，Codex 与浏览器看到同一份真相。

## 本地开发

```bash
pnpm install
pnpm probe:mcp           # 验证 MCP claimId 与纯读闭环
pnpm probe:concurrency   # 验证目录代际锁、SIGSTOP、第三写入者提交窗与双 claim
pnpm probe:crash         # 验证三类崩溃/部分成功自愈
pnpm dev         # 启动工作台（默认 http://127.0.0.1:43318，状态写入当前目录）
pnpm quality     # 语法检查 + 构建 + 探针
```

开发时没有 Codex 回写请求，可用 MCP client 或直接调 `save_naming_product_result` 模拟结果；GUI 每 1.6 秒轮询结果状态，Codex watcher 默认每 300ms 监听新请求。

## Architecture

<directory>
.codex-plugin/ - Codex 插件身份声明 (0子目录)
assets/ - 插件展示资产预留位 (0子目录)
mcp/ - Codex 侧 widget 渲染与请求/结果状态 MCP 边界 (1子目录: lib)
scripts/ - 兜底工作台启动器、请求监听器、widget 构建器与 MCP 探针 (0子目录)
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

架构决策: 双形态、双文件、单业务真相源。hosted 形态以 `trigger.json` 只表达“何时唤醒”，无头 Agent 单轮只回答“做什么”；原生 widget 以 follow-up 唤醒对话。两者共享 `state.json`，所有 mutation 经“完整非空目录发布 + 永久代际 fence”串行，构造/释放残留按 PID 与年龄收敛；claimId fencing 把并行计算收敛为唯一可提交结果。localhost 只作开发/降级，纯读与修复严格分离。

开发规范: 新增或改变业务文件时先更新 L3 头部，再检查最近 README.md。

变更日志:
- 2026-07-18: v0.6.2 收口锁构造生命周期——owner 临时名携 PID，mkdir/write 全段失败清理，新残留按 PID、旧残留按年龄分级回收，release/garbage 原子私有化收敛；探针覆盖构造失败、活跃残留保护及历史残留回收。
- 2026-07-18: v0.6.1 修复并发审阅缺口——锁改为完整非空目录原子发布、永久 nonce fence 与原子私有化释放，删除依赖 rename 覆盖语义的 ABA 恢复分支；探针加入陈旧 reaper、第三写入者提交窗与释放/获取交错。
- 2026-07-18: v0.6.0 增加 hosted Tier 2 契约——专用 trigger、state→trigger 部分成功提交/后台补投、pending→processing claimId 栅栏、纯读/修复分离及并发/崩溃探针。
- 2026-07-08: 原生 widget 以 Cowart 模式回归（v0.5.0）——新增 render_naming_workbench_widget 渲染工具与 ui://widget/naming/workbench.html 资源，api-client 双模路由（widget 桥 / localhost fetch），生成点击经 sendFollowUpMessage 唤醒 Codex，根治「watcher 死后请求滞留」的结构性缺陷；localhost 全链路保留为兜底，探针覆盖 widget 单文件产物 CSP 断言。
- 2026-07-08: Product Design 审阅后压实工作台——候选中栏改为扫描表，选中态从整块描边改为左侧状态条，右栏解析头部收敛，三栏共享面板阴影退场。
- 2026-07-08: 优化工作台响应式布局——三栏断点提前到 1120px，中间 gutter 归零，候选行与对比卡片压实，宽屏不再误掉单列。
- 2026-07-08: 修复连续生成无响应感——状态层新增单一活跃 pending 与 superseded 退场规则，watcher 只消费 latestPendingRequest，GUI 显示已提交批次与 request id，探针覆盖旧请求防回写。
- 2026-07-08: 收敛产品界面——移除顶部 Header 组件与底部状态描述，工作台首屏直接进入三栏操作区。
- 2026-07-08: 修复名字字数坏味道——内部语义从 `nameLength: single/double` 迁移为 `fullNameLength: 2/3`；GUI pending 超过 2 分钟会退出 loading 并提示重新接管。
- 2026-07-08: 复盘启动与生成链路——启动器新增同项目健康复用、坏依赖树检测与 hoisted 修复；watcher 默认 300ms 响应；profile 保存/回写统一归一化；GUI 支持 latestResult 复水；风格强度 UI 与 plan 改为同一数值映射。
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
