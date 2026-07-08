/**
 * - [INPUT]: 依赖 Label、cn 与 tone-preferences 强度映射，承载工作台跨面板共享的选项、样式与小型控件。
 * - [OUTPUT]: 对外提供 genderOptions、elementStyles、ElementPill、RiskDot、Field、Segment、SliderRow、FilterCheck、providerLabel。
 * - [POS]: components/workbench 的共享底座，被 profile/candidate/detail 面板消费。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { Label } from "@/components/ui/label.jsx";
import { toneStrengthLabel } from "@/lib/tone-preferences.js";
import { cn } from "@/lib/utils.js";

export const genderOptions = [
  ["boy", "男孩"],
  ["girl", "女孩"],
  ["neutral", "中性"],
];

export const elementStyles = {
  木: "bg-emerald-50 text-emerald-700",
  火: "bg-red-50 text-red-600",
  土: "bg-amber-50 text-amber-700",
  金: "bg-zinc-100 text-zinc-600",
  水: "bg-sky-50 text-sky-700",
};

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

export function Segment({ value, options, onChange, columns = 3 }) {
  return (
    <div className={cn("grid rounded-lg bg-muted p-0.5", columns === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "h-7 rounded-md text-[13px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
            value === id ? "bg-card font-medium text-foreground shadow-paper" : "text-muted-foreground hover:text-foreground",
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
    <span className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-xs font-medium", elementStyles[value])}>
      {value}
    </span>
  );
}

// 风险语义点：极低/低 → 绿，中 → 琥珀，其余 → 灰。
export function RiskDot({ risk }) {
  const tone = risk === "风险中" ? "bg-amber-500" : risk?.startsWith("风险") ? "bg-emerald-500" : "bg-zinc-300";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", tone)} />
      {risk}
    </span>
  );
}

export function SliderRow({ label, value, onChange }) {
  return (
    <div className="grid grid-cols-[64px_1fr_36px] items-center gap-2.5 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <input min="0" max="100" step="25" value={value} onChange={(event) => onChange(Number(event.target.value))} type="range" className="h-1" />
      <span className="text-right text-xs text-muted-foreground">{toneStrengthLabel(value)}</span>
    </div>
  );
}

export function FilterCheck({ checked, label, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" />
      <span>{label}</span>
    </label>
  );
}

export function providerLabel(provider) {
  if (provider === "idle") return "等待输入";
  if (provider === "codex") return "Codex 已返回";
  if (provider === "pending-codex") return "等待 Codex";
  return "等待连接";
}
