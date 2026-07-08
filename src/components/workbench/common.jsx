/**
 * - [INPUT]: 依赖 Label 与 cn，承载工作台跨面板共享的选项、样式与小型控件。
 * - [OUTPUT]: 对外提供 genderOptions、tabItems、ElementPill、Field、Segment、SliderRow、FilterCheck、providerLabel、updateNested。
 * - [POS]: components/workbench 的共享底座，被 profile/candidate/detail 面板消费。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { Label } from "@/components/ui/label.jsx";
import { cn } from "@/lib/utils.js";

export const genderOptions = [
  ["boy", "男孩"],
  ["girl", "女孩"],
  ["neutral", "中性"],
];

export const tabItems = [
  ["bazi", "八字五行"],
  ["sound", "音律分析"],
  ["shape", "字形结构"],
  ["meaning", "寓意解析"],
  ["source", "出处典故"],
  ["avoid", "避讳提醒"],
];

export const elementStyles = {
  木: "bg-emerald-100 text-emerald-700",
  火: "bg-red-100 text-red-700",
  土: "bg-amber-100 text-amber-700",
  金: "bg-stone-100 text-stone-600",
  水: "bg-sky-100 text-sky-700",
};

export function updateNested(object, key, value) {
  return { ...object, [key]: value };
}

export function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function Segment({ value, options, onChange }) {
  return (
    <div className="grid grid-cols-3 rounded-md border border-border bg-white/70 p-1">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "h-8 rounded-sm text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
            value === id ? "bg-primary text-primary-foreground shadow-inset" : "text-muted-foreground hover:bg-secondary",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function ElementPill({ value }) {
  return (
    <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-sm", elementStyles[value])}>
      {value}
    </span>
  );
}

export function SliderRow({ label, value, suffix, onChange }) {
  return (
    <div className="grid grid-cols-[72px_1fr_42px] items-center gap-3 text-sm">
      <span className="text-foreground">{label}</span>
      <input min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} type="range" />
      <span className="text-right text-xs text-muted-foreground">{suffix}</span>
    </div>
  );
}

export function FilterCheck({ checked, label, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" className="h-4 w-4 accent-primary" />
      <span>{label}</span>
    </label>
  );
}

export function providerLabel(provider) {
  if (provider === "idle") return "等待输入";
  if (provider === "codex") return "Codex 已返回";
  if (provider === "codex-widget") return "等待 Codex";
  if (provider === "openai-responses") return "LLM 已连接";
  if (provider === "fallback-after-error") return "LLM 回退";
  if (provider === "fallback") return "本地兜底";
  return "等待连接";
}
