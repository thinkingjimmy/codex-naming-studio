/**
 * - [INPUT]: 依赖 GUI profile.tones 的 0-100 数值。
 * - [OUTPUT]: 对外提供 TONE_LABELS、toneStrengthLabel、hasTonePreferences、describeTonePreferences。
 * - [POS]: lib 的风格偏好语义层，统一 UI 强度文案与 Codex 执行计划描述。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
export const TONE_LABELS = {
  classic: "古典文雅",
  gentle: "温润平和",
  bright: "明朗大气",
  poetic: "诗词典故",
  modern: "现代简约",
};

export function toneStrengthLabel(value) {
  const score = normalizeToneValue(value);
  if (score <= 0) return "关闭";
  if (score < 40) return "较弱";
  if (score < 70) return "中等";
  if (score < 85) return "较强";
  return "强";
}

export function hasTonePreferences(tones = {}) {
  return toneEntries(tones).some((entry) => entry.value > 0);
}

export function describeTonePreferences(tones = {}) {
  const active = toneEntries(tones).filter((entry) => entry.value > 0);
  if (active.length === 0) return "无主动风格偏好";
  return active.map((entry) => `${entry.label} ${entry.value}/100（${entry.strength}）`).join("，");
}

function toneEntries(tones = {}) {
  const source = tones && typeof tones === "object" ? tones : {};
  return Object.entries(TONE_LABELS).map(([key, label]) => {
    const value = normalizeToneValue(source[key]);
    return { key, label, value, strength: toneStrengthLabel(value) };
  });
}

function normalizeToneValue(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
