# skills/

> L2 | 父级: ../README.md

成员清单
naming-studio-open/SKILL.md: 打开工作台的操作协议——主路径调 render_naming_workbench_widget 渲染原生 widget，兜底路径启 localhost 服务器 + 内置浏览器 + 请求监听器，禁止索要 API key。
naming-studio-open/agents/openai.yaml: open skill 的 Codex interface 元数据与默认提示词。
naming-studio-generate/SKILL.md: 编排生成请求——请求来源含 widget follow-up 消息（指名 requestId 与 projectDir）、watcher 输出与 latestPendingRequest，按 request.plan 先跑研究步骤再生成，含候选数据形状、superseded 防护与分模式收尾（widget 模式不 arm watcher）。
naming-studio-generate/agents/openai.yaml: generate skill 的 Codex interface 元数据与默认提示词。
naming-studio-research/SKILL.md: 外部事实研究协议——热门名字避让清单搜索与普通话谐音审查，只回馈生成流程不写 GUI。
naming-studio-research/agents/openai.yaml: research skill 的 Codex interface 元数据与默认提示词。
naming-studio-bazi/SKILL.md: 八字五行算法协议——节气排四柱、藏干加权统计、日主强弱、喜用神推导与用字五行判定。
naming-studio-bazi/agents/openai.yaml: bazi skill 的 Codex interface 元数据与默认提示词。

法则: skill 只告诉 Codex 怎么行动，不夹带产品源码和冗长文档。一个 skill 对应一个用户动作。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
