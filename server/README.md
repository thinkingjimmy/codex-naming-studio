# server/

> L2 | 父级: ../README.md

成员清单
llm-bridge.js: Node HTTP LLM 桥接服务，POST /api/generate-names 调 OpenAI Responses API，缺少密钥时回退本地候选。

接口契约: `GET /api/health` 暴露可启动性；`POST /api/generate-names` 接收 `{ profile, batch }` 并返回候选名结构。

运行参数: `NAME_BRIDGE_PORT` 改变监听端口，默认 `8787`；`OPENAI_API_KEY` 启用 OpenAI Responses API；`OPENAI_MODEL` 覆盖默认模型。

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
