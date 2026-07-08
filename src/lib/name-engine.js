/**
 * - [INPUT]: 依赖本文件内的候选模板、姓名长度选项、指标标签与简单评分规则。
 * - [OUTPUT]: 对外提供 DEFAULT_PROFILE、NAME_LENGTH_OPTIONS、METRIC_LABELS、mergeProfile、normalizeProfile、buildCandidates、normalizeCandidates、sortCandidates。
 * - [POS]: lib 的起名领域引擎与候选标准化层，让 UI 和后端共享同一数据形状。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
export const DEFAULT_PROFILE = {
  surname: "林",
  gender: "boy",
  useBazi: true,
  calendar: "solar",
  birthDate: "2024-05-20",
  birthTime: "10:18",
  fullNameLength: 3,
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
    mandarinHomophone: true,
    popularName: true,
    strokes: false,
    highScore: false,
  },
};

export const NAME_LENGTH_OPTIONS = [
  { value: 2, label: "双字名" },
  { value: 3, label: "三字名" },
];

export const METRIC_LABELS = [
  ["八字五行", "bazi"],
  ["音律音调", "sound"],
  ["字形结构", "shape"],
  ["寓意内涵", "meaning"],
  ["避讳风险", "risk"],
  ["风格匹配", "style"],
];

const DEFAULT_FULL_NAME_LENGTH = 3;

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

function fullNameLengthFrom(source, fallback = DEFAULT_FULL_NAME_LENGTH) {
  const fullNameLength = Number(source?.fullNameLength);
  if (fullNameLength === 2 || fullNameLength === 3) return fullNameLength;
  if (source?.nameLength === "single") return 2;
  if (source?.nameLength === "double") return 3;
  return fallback;
}

function withoutLegacyNameLength(source) {
  const { nameLength: _legacyNameLength, ...clean } = source;
  return clean;
}

export function mergeProfile(base = {}, override = {}) {
  const left = base && typeof base === "object" ? base : {};
  const right = override && typeof override === "object" ? override : {};
  const fullNameLength = fullNameLengthFrom(right, fullNameLengthFrom(left));
  return {
    ...withoutLegacyNameLength(left),
    ...withoutLegacyNameLength(right),
    fullNameLength,
    tones: {
      ...(left.tones || {}),
      ...(right.tones || {}),
    },
    filters: {
      ...(left.filters || {}),
      ...(right.filters || {}),
    },
  };
}

export function normalizeProfile(profile = {}) {
  const source = profile && typeof profile === "object" ? profile : {};
  return mergeProfile(DEFAULT_PROFILE, source);
}

function applyProfileScore(template, profile, index) {
  const genderLift = profile.gender === "girl" && ["若初", "云舒"].includes(template.given) ? 1 : 0;
  const lunarLift = profile.calendar === "lunar" && template.elements.includes("水") ? 1 : 0;
  const modernDrift = Math.round((profile.tones.modern - 64) / 24);
  return Math.min(99, Math.max(80, template.score + genderLift + lunarLift + modernDrift - (index > 8 ? 1 : 0)));
}

function expectedGivenLength(profile) {
  const fullProfile = normalizeProfile(profile);
  const surname = (fullProfile.surname || DEFAULT_PROFILE.surname).trim() || DEFAULT_PROFILE.surname;
  return Math.max(1, fullProfile.fullNameLength - Array.from(surname).length);
}

function hasExpectedGivenLength(value, profile) {
  return Array.from(String(value || "").trim()).length === expectedGivenLength(profile);
}

function normalizeGiven(value, fallback, profile) {
  const source = hasExpectedGivenLength(value, profile) ? value : fallback;
  return Array.from(String(source || "").trim()).slice(0, expectedGivenLength(profile)).join("");
}

export function buildCandidates(profile = DEFAULT_PROFILE, batch = 0) {
  const fullProfile = normalizeProfile(profile);
  const useBazi = fullProfile.useBazi !== false;
  const surname = (fullProfile.surname || DEFAULT_PROFILE.surname).trim() || DEFAULT_PROFILE.surname;
  return rotate(CANDIDATE_TEMPLATES, batch % CANDIDATE_TEMPLATES.length).map((template, index) => {
    const score = applyProfileScore(template, fullProfile, index);
    const given = normalizeGiven(template.given, template.given, fullProfile);
    return {
      ...template,
      id: `${surname}-${given}-${batch}`,
      given,
      fullName: `${surname}${given}`,
      surname,
      rank: index + 1,
      score,
      elements: useBazi ? template.elements : [],
      metrics: useBazi ? template.metrics : [null, ...template.metrics.slice(1)],
      distribution: useBazi ? DISTRIBUTION : null,
      branches: useBazi ? BRANCHES : null,
      complement: useBazi ? template.elements.join("、") : "",
      analysis: useBazi
        ? "日主为己土，生于巳月，火土较旺，木有根，水稍弱。喜用神为木、火，名字中木、火属性有利于平衡命局。"
        : "未启用出生时间测算，本次不做八字五行分析，评分由音律、字形与寓意维度构成。",
    };
  });
}

export function normalizeCandidates(candidates, profile = DEFAULT_PROFILE, batch = 0) {
  const fullProfile = normalizeProfile(profile);
  const useBazi = fullProfile.useBazi !== false;
  const fallback = buildCandidates(fullProfile, batch);
  const surname = (fullProfile.surname || DEFAULT_PROFILE.surname).trim() || DEFAULT_PROFILE.surname;
  return candidates.map((candidate, index) => {
    const base = fallback[index % fallback.length];
    const source = hasExpectedGivenLength(candidate.given, fullProfile) ? candidate : {};
    const given = normalizeGiven(source.given, base.given, fullProfile);
    const elements = useBazi
      ? (Array.isArray(source.elements) && source.elements.length >= 2 ? source.elements.slice(0, 2) : base.elements)
      : [];
    const metrics = Array.isArray(source.metrics) && source.metrics.length === 6 ? source.metrics : base.metrics;
    const score = Number.isFinite(source.score) ? Math.min(99, Math.max(80, Math.round(source.score))) : base.score;
    return {
      ...base,
      ...source,
      id: `${surname}-${given}-${batch}-${index}`,
      surname,
      given,
      fullName: `${surname}${given}`,
      rank: index + 1,
      score,
      elements,
      metrics: useBazi ? metrics : [null, ...metrics.slice(1)],
      distribution: useBazi
        ? (Array.isArray(source.distribution) && source.distribution.length === 5 ? source.distribution : base.distribution)
        : null,
      branches: useBazi
        ? (Array.isArray(source.branches) && source.branches.length === 4 ? source.branches : base.branches)
        : null,
      complement: elements.join("、"),
    };
  });
}

// 风险是序数不是字符串，localeCompare 会把"风险低"排在"风险极低"前面。
const RISK_ORDER = { 风险极低: 0, 风险低: 1, 风险中: 2, 风险高: 3 };

function riskRank(risk) {
  return RISK_ORDER[risk] ?? Object.keys(RISK_ORDER).length;
}

export function sortCandidates(candidates, mode) {
  const sorted = [...candidates];
  if (mode === "score") return sorted.sort((a, b) => b.score - a.score);
  if (mode === "risk") return sorted.sort((a, b) => riskRank(a.risk) - riskRank(b.risk));
  if (mode === "style") return sorted.sort((a, b) => b.metrics[5] - a.metrics[5]);
  return sorted;
}
