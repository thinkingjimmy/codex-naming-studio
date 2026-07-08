/**
 * - [INPUT]: 依赖本文件内的候选模板、指标标签与简单评分规则。
 * - [OUTPUT]: 对外提供 DEFAULT_PROFILE、METRIC_LABELS、buildCandidates、normalizeCandidates、sortCandidates。
 * - [POS]: lib 的起名领域引擎与候选标准化层，让 UI 和后端共享同一数据形状。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
export const DEFAULT_PROFILE = {
  surname: "林",
  gender: "boy",
  calendar: "solar",
  birthDate: "2024-05-20",
  birthTime: "10:18",
  province: "浙江省",
  city: "杭州市",
  district: "西湖区",
  nameLength: "double",
  preferredChars: "",
  blockedChars: "",
  tones: {
    classic: 78,
    gentle: 88,
    bright: 62,
    poetic: 88,
    modern: 64,
  },
  filters: {
    rare: true,
    polyphone: true,
    unclear: true,
    strokes: false,
    highScore: false,
  },
};

export const METRIC_LABELS = [
  ["八字五行", "bazi"],
  ["音律音调", "sound"],
  ["字形结构", "shape"],
  ["寓意内涵", "meaning"],
  ["避讳风险", "risk"],
  ["风格匹配", "style"],
];

const CANDIDATE_TEMPLATES = [
  {
    given: "知旻",
    score: 96,
    grade: "极佳",
    elements: ["木", "火"],
    summary: "知书达理，海晏河清，安然自得，光明温润。",
    risk: "风险低",
    poems: "知者乐水，旻天清朗。",
    metrics: [25, 19, 14, 19, 9, 10],
  },
  {
    given: "子安",
    score: 95,
    grade: "极佳",
    elements: ["木", "土"],
    summary: "给予安宁，平安喜乐，心怀善意，温润如玉。",
    risk: "风险低",
    poems: "君子怀安，风止水定。",
    metrics: [24, 19, 14, 18, 10, 9],
  },
  {
    given: "景和",
    score: 94,
    grade: "极佳",
    elements: ["木", "火"],
    summary: "景星庆云，惠风和畅，光明磊落，温和从容。",
    risk: "风险低",
    poems: "景明春和，万物有光。",
    metrics: [24, 18, 14, 19, 9, 10],
  },
  {
    given: "若初",
    score: 92,
    grade: "优秀",
    elements: ["木", "水"],
    summary: "不忘初心，清新如初，纯净美好，温润雅致。",
    risk: "风险极低",
    poems: "人生若只如初见。",
    metrics: [23, 18, 15, 18, 10, 9],
  },
  {
    given: "书昀",
    score: 91,
    grade: "优秀",
    elements: ["木", "火"],
    summary: "书香致远，日光温润，学识渊博，谦和明朗。",
    risk: "风险低",
    poems: "书卷清气，昀日初升。",
    metrics: [23, 18, 13, 18, 9, 10],
  },
  {
    given: "明澈",
    score: 90,
    grade: "优秀",
    elements: ["火", "水"],
    summary: "光明磊落，清澈通透，心思澄明，通达静朗。",
    risk: "风险低",
    poems: "明月澄怀，清流见底。",
    metrics: [22, 19, 13, 18, 9, 9],
  },
  {
    given: "清越",
    score: 89,
    grade: "良好",
    elements: ["水", "木"],
    summary: "清朗高远，声如清越，气质卓然，脱俗雅致。",
    risk: "风险低",
    poems: "清音越石，风骨自成。",
    metrics: [22, 18, 14, 17, 9, 9],
  },
  {
    given: "言蹊",
    score: 88,
    grade: "良好",
    elements: ["木", "土"],
    summary: "妙语如珠，桃李不言，德行修身，低调有光。",
    risk: "风险中",
    poems: "桃李不言，下自成蹊。",
    metrics: [21, 18, 12, 18, 8, 9],
  },
  {
    given: "予宁",
    score: 87,
    grade: "良好",
    elements: ["土", "火"],
    summary: "予人安定，宁静致远，舒朗沉稳，含蓄有度。",
    risk: "风险低",
    poems: "宁静致远，予怀清和。",
    metrics: [21, 18, 13, 17, 9, 9],
  },
  {
    given: "怀瑾",
    score: 86,
    grade: "良好",
    elements: ["水", "金"],
    summary: "怀瑾握瑜，品格清贵，内敛坚韧，温厚有节。",
    risk: "风险中",
    poems: "怀瑾握瑜，穷不知所示。",
    metrics: [21, 17, 13, 18, 8, 9],
  },
  {
    given: "亦舟",
    score: 85,
    grade: "良好",
    elements: ["土", "水"],
    summary: "从容如舟，行稳致远，独立清醒，心有方向。",
    risk: "风险低",
    poems: "轻舟已过，亦有远方。",
    metrics: [20, 18, 13, 17, 9, 8],
  },
  {
    given: "云舒",
    score: 84,
    grade: "良好",
    elements: ["水", "金"],
    summary: "云卷云舒，松弛自然，气韵开阔，温柔坚定。",
    risk: "风险低",
    poems: "行到水穷处，坐看云起时。",
    metrics: [20, 17, 13, 18, 9, 8],
  },
];

const BRANCHES = [
  ["年柱", "甲辰", ["木", "土"]],
  ["月柱", "己巳", ["土", "火"]],
  ["日柱", "己卯", ["土", "木"]],
  ["时柱", "己巳", ["土", "火"]],
];

const DISTRIBUTION = [
  ["木", 2],
  ["火", 2],
  ["土", 1],
  ["金", 0],
  ["水", 1],
];

function rotate(items, offset) {
  return items.map((_, index) => items[(index + offset) % items.length]);
}

function normalizeProfile(profile = {}) {
  const source = profile && typeof profile === "object" ? profile : {};
  return {
    ...DEFAULT_PROFILE,
    ...source,
    tones: {
      ...DEFAULT_PROFILE.tones,
      ...(source.tones || {}),
    },
    filters: {
      ...DEFAULT_PROFILE.filters,
      ...(source.filters || {}),
    },
  };
}

function applyProfileScore(template, profile, index) {
  const genderLift = profile.gender === "girl" && ["若初", "云舒"].includes(template.given) ? 1 : 0;
  const lunarLift = profile.calendar === "lunar" && template.elements.includes("水") ? 1 : 0;
  const modernDrift = Math.round((profile.tones.modern - 64) / 24);
  return Math.min(99, Math.max(80, template.score + genderLift + lunarLift + modernDrift - (index > 8 ? 1 : 0)));
}

export function buildCandidates(profile = DEFAULT_PROFILE, batch = 0) {
  const fullProfile = normalizeProfile(profile);
  const surname = (fullProfile.surname || DEFAULT_PROFILE.surname).trim() || DEFAULT_PROFILE.surname;
  return rotate(CANDIDATE_TEMPLATES, batch % CANDIDATE_TEMPLATES.length).map((template, index) => {
    const score = applyProfileScore(template, fullProfile, index);
    return {
      ...template,
      id: `${surname}-${template.given}-${batch}`,
      fullName: `${surname}${template.given}`,
      surname,
      rank: index + 1,
      score,
      distribution: DISTRIBUTION,
      branches: BRANCHES,
      complement: template.elements.join("、"),
      analysis:
        "日主为己土，生于巳月，火土较旺，木有根，水稍弱。喜用神为木、火，名字中木、火属性有利于平衡命局。",
    };
  });
}

export function normalizeCandidates(candidates, profile = DEFAULT_PROFILE, batch = 0) {
  const fullProfile = normalizeProfile(profile);
  const fallback = buildCandidates(fullProfile, batch);
  const surname = (fullProfile.surname || DEFAULT_PROFILE.surname).trim() || DEFAULT_PROFILE.surname;
  return candidates.map((candidate, index) => {
    const base = fallback[index % fallback.length];
    const given = String(candidate.given || base.given).slice(0, 4);
    const elements = Array.isArray(candidate.elements) && candidate.elements.length >= 2 ? candidate.elements.slice(0, 2) : base.elements;
    const score = Number.isFinite(candidate.score) ? Math.min(99, Math.max(80, Math.round(candidate.score))) : base.score;
    return {
      ...base,
      ...candidate,
      id: `${surname}-${given}-${batch}-${index}`,
      surname,
      given,
      fullName: `${surname}${given}`,
      rank: index + 1,
      score,
      elements,
      metrics: Array.isArray(candidate.metrics) && candidate.metrics.length === 6 ? candidate.metrics : base.metrics,
      distribution: Array.isArray(candidate.distribution) && candidate.distribution.length === 5 ? candidate.distribution : base.distribution,
      branches: Array.isArray(candidate.branches) && candidate.branches.length === 4 ? candidate.branches : base.branches,
      complement: elements.join("、"),
    };
  });
}

export function sortCandidates(candidates, mode) {
  const sorted = [...candidates];
  if (mode === "score") return sorted.sort((a, b) => b.score - a.score);
  if (mode === "risk") return sorted.sort((a, b) => a.risk.localeCompare(b.risk, "zh-Hans-CN"));
  if (mode === "style") return sorted.sort((a, b) => b.metrics[5] - a.metrics[5]);
  return sorted;
}
