# skills/

> L2 | 父级: ../README.md

成员清单
naming-studio-open/SKILL.md: 启动工作台服务器、打开内置浏览器并 arm 请求监听器的操作协议，禁止索要 API key。
naming-studio-open/agents/openai.yaml: open skill 的 Codex interface 元数据与默认提示词。
naming-studio-generate/SKILL.md: 编排 NAMING_PRODUCT_REQUEST_ID 生成请求——按 request.plan 先跑研究步骤再生成，含候选数据形状与失败回写要求。
naming-studio-generate/agents/openai.yaml: generate skill 的 Codex interface 元数据与默认提示词。
naming-studio-research/SKILL.md: 外部事实研究协议——热门名字避让清单搜索与普通话谐音审查，只回馈生成流程不写 GUI。
naming-studio-research/agents/openai.yaml: research skill 的 Codex interface 元数据与默认提示词。
naming-studio-bazi/SKILL.md: 八字五行算法协议——节气排四柱、藏干加权统计、日主强弱、喜用神推导与用字五行判定。
naming-studio-bazi/agents/openai.yaml: bazi skill 的 Codex interface 元数据与默认提示词。

法则: skill 只告诉 Codex 怎么行动，不夹带产品源码和冗长文档。一个 skill 对应一个用户动作。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
