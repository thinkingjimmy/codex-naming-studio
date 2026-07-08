/**
 * - [INPUT]: 依赖 node:http 提供本地 HTTP 服务，依赖 OPENAI_API_KEY/OPENAI_MODEL 调 OpenAI Responses API，依赖 src/lib/name-engine.js 的兜底候选。
 * - [OUTPUT]: 对外提供 POST /api/generate-names、GET /api/health 本地接口。
 * - [POS]: server 的 LLM 桥接层，把浏览器请求转换为结构化起名结果，前端不直接持有模型密钥。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import http from "node:http";
import { buildCandidates, DEFAULT_PROFILE, normalizeCandidates } from "../src/lib/name-engine.js";

const PORT = Number(process.env.NAME_BRIDGE_PORT || 8787);
const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const OPENAI_URL = "https://api.openai.com/v1/responses";

const RESPONSE_SCHEMA = {
  name: "naming_recommendations",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["candidates"],
    properties: {
      candidates: {
        type: "array",
        minItems: 8,
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "given",
            "score",
            "grade",
            "elements",
            "summary",
            "risk",
            "poems",
            "metrics",
            "distribution",
            "branches",
            "analysis",
          ],
          properties: {
            given: { type: "string" },
            score: { type: "integer", minimum: 80, maximum: 99 },
            grade: { type: "string" },
            elements: {
              type: "array",
              minItems: 2,
              maxItems: 2,
              items: { type: "string", enum: ["木", "火", "土", "金", "水"] },
            },
            summary: { type: "string" },
            risk: { type: "string" },
            poems: { type: "string" },
            metrics: {
              type: "array",
              minItems: 6,
              maxItems: 6,
              items: { type: "integer", minimum: 0, maximum: 25 },
            },
            distribution: {
              type: "array",
              minItems: 5,
              maxItems: 5,
              items: {
                type: "array",
                minItems: 2,
                maxItems: 2,
                prefixItems: [{ type: "string", enum: ["木", "火", "土", "金", "水"] }, { type: "integer" }],
              },
            },
            branches: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                prefixItems: [
                  { type: "string" },
                  { type: "string" },
                  {
                    type: "array",
                    minItems: 2,
                    maxItems: 2,
                    items: { type: "string", enum: ["木", "火", "土", "金", "水"] },
                  },
                ],
              },
            },
            analysis: { type: "string" },
          },
        },
      },
    },
  },
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function sendJson(response, status, value) {
  response.writeHead(status, {
    ...CORS_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function buildPrompt(profile) {
  return [
    "你是严谨的新生儿中文起名顾问。",
    "根据输入生成 8 到 12 个名字候选，必须适合产品 UI 直接展示。",
    "要求：",
    "1. 分数要可解释，80-99 分之间，分数越高越推荐。",
    "2. 五行、音律、字形、寓意、风险、风格指标必须协调，不要自相矛盾。",
    "3. 避免生僻字、负面谐音、多音争议和不雅联想。",
    "4. summary 用一句中文短句，analysis 用一段命理解释。",
    "5. 不要输出 Markdown，只返回符合 schema 的 JSON。",
    "",
    `输入资料：${JSON.stringify(profile)}`,
  ].join("\n");
}

function extractText(apiResponse) {
  if (typeof apiResponse.output_text === "string") return apiResponse.output_text;
  for (const item of apiResponse.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

async function callOpenAI(profile) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: buildPrompt(profile),
      text: {
        format: {
          type: "json_schema",
          ...RESPONSE_SCHEMA,
        },
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI request failed with ${response.status}`;
    throw new Error(message);
  }

  const text = extractText(payload);
  if (!text) throw new Error("OpenAI response did not contain output_text");
  return JSON.parse(text);
}

function fallbackResult(profile, batch) {
  return {
    candidates: buildCandidates(profile, batch),
    provider: "fallback",
    model: "local-name-engine",
    notice: "未检测到 OPENAI_API_KEY，已使用本地兜底候选。设置环境变量后可启用 LLM 评分。",
  };
}

async function generateNames(profile, batch) {
  try {
    const llmResult = await callOpenAI(profile);
    if (!llmResult) return fallbackResult(profile, batch);
    return {
      candidates: normalizeCandidates(llmResult.candidates, profile, batch),
      provider: "openai-responses",
      model: MODEL,
      notice: "评分与解析由 LLM 生成。",
    };
  } catch (error) {
    const result = fallbackResult(profile, batch);
    result.provider = "fallback-after-error";
    result.notice = error instanceof Error ? error.message : "LLM 调用失败，已回退到本地候选。";
    return result;
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, CORS_HEADERS);
    return response.end();
  }
  if (request.method === "GET" && request.url === "/api/health") {
    return sendJson(response, 200, {
      ok: true,
      model: MODEL,
      hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    });
  }

  if (request.method === "POST" && request.url === "/api/generate-names") {
    try {
      const body = await readJson(request);
      const profile = { ...DEFAULT_PROFILE, ...(body.profile || {}) };
      const batch = Number(body.batch || 0);
      return sendJson(response, 200, await generateNames(profile, batch));
    } catch (error) {
      return sendJson(response, 400, {
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  return sendJson(response, 404, { error: "Not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Name LLM bridge listening on http://127.0.0.1:${PORT}`);
});
