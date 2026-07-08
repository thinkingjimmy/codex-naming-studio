/**
 * - [INPUT]: 依赖 profile 数据形状（useBazi、calendar、birthDate/birthTime、filters、preferredChars、blockedChars）。
 * - [OUTPUT]: 对外提供 buildTaskPlan(profile)，把 GUI 约束翻译为 Codex 执行步骤（skill 触发或生成硬约束）。
 * - [POS]: lib 的约束路由层，是 GUI 勾选与 Codex skill 调度之间的单一真相源，被 naming-state 状态库消费。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */

const RESEARCH_SKILL = "naming-studio-research";
const BAZI_SKILL = "naming-studio-bazi";

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// ============================================================
// 规则表：一条约束 = 一行规则。带 skill 的步骤要求 Codex 先触发
// 对应 skill；不带 skill 的步骤是生成候选时的硬约束。
// 新增 GUI 约束时只加规则行，不加分支。
// ============================================================
const PLAN_RULES = [
  {
    id: "bazi-analysis",
    when: (profile) => profile.useBazi !== false,
    step: (profile) => ({
      skill: BAZI_SKILL,
      topic: "bazi-analysis",
      instruction: `按${profile.calendar === "lunar" ? "农历（先换算公历）" : "公历"}出生时间 ${profile.birthDate || ""} ${profile.birthTime || ""} 排四柱、统计五行、判断日主强弱并推导喜用神；候选名用字必须补益喜用神，并回填 elements、distribution、branches 与 analysis。`,
    }),
  },
  {
    id: "skip-bazi",
    when: (profile) => profile.useBazi === false,
    step: () => ({
      instruction: "用户未启用出生时间测算：跳过八字五行，candidates 的 elements 置空数组、distribution 与 branches 置 null、metrics 首项置 null，评分权重转移到音律、字形与寓意维度。",
    }),
  },
  {
    id: "research-popular-names",
    when: (profile) => Boolean(profile.filters?.popularName),
    step: () => ({
      skill: RESEARCH_SKILL,
      topic: "popular-names",
      instruction: "搜索近三年中国大陆新生儿热门名字与重名率榜单，整理成避让清单，候选名不得命中。",
    }),
  },
  {
    id: "research-mandarin-homophone",
    when: (profile) => Boolean(profile.filters?.mandarinHomophone),
    step: () => ({
      skill: RESEARCH_SKILL,
      topic: "mandarin-homophone",
      instruction: "对每个候选名做普通话谐音审查，必要时搜索验证，确认无负面谐音与绰号联想后才可入选。",
    }),
  },
  {
    id: "include-preferred-chars",
    when: (profile) => nonEmpty(profile.preferredChars),
    step: (profile) => ({
      instruction: `候选名必须包含辈分字：${profile.preferredChars.trim()}。`,
    }),
  },
  {
    id: "exclude-blocked-chars",
    when: (profile) => nonEmpty(profile.blockedChars),
    step: (profile) => ({
      instruction: `候选名不得使用避讳字：${profile.blockedChars.trim()}。`,
    }),
  },
  {
    id: "avoid-rare-chars",
    when: (profile) => Boolean(profile.filters?.rare),
    step: () => ({
      instruction: "只使用《通用规范汉字表》常用字，避开生僻字。",
    }),
  },
  {
    id: "avoid-polyphone",
    when: (profile) => Boolean(profile.filters?.polyphone),
    step: () => ({
      instruction: "避开多音字，名字读音必须唯一无争议。",
    }),
  },
  {
    id: "avoid-unclear-pinyin",
    when: (profile) => Boolean(profile.filters?.unclear),
    step: () => ({
      instruction: "避开拼音易读错、平翘舌易混的字。",
    }),
  },
  {
    id: "limit-strokes",
    when: (profile) => Boolean(profile.filters?.strokes),
    step: () => ({
      instruction: "控制笔画数，单字不超过约 16 画，书写要顺手。",
    }),
  },
  {
    id: "high-score-only",
    when: (profile) => Boolean(profile.filters?.highScore),
    step: () => ({
      instruction: "只保留综合评分 90 分以上的候选。",
    }),
  },
];

export function buildTaskPlan(profile = {}) {
  const source = profile && typeof profile === "object" ? profile : {};
  return PLAN_RULES.filter((rule) => rule.when(source)).map((rule) => ({
    id: rule.id,
    skill: null,
    topic: null,
    ...rule.step(source),
  }));
}
