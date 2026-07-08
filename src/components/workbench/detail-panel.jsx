/**
 * - [INPUT]: 依赖 @phosphor-icons/react 解析图标、候选名详情数据、METRIC_LABELS 指标、Button 与 workbench/common 展示工具。
 * - [OUTPUT]: 对外提供 DetailPanel 当前名字解析面板（全高列布局，评分构成 + 八字 + 各维度解析纵向铺开）。
 * - [POS]: components/workbench 的右栏解释面板，负责空白/loading 与当前名字全维度详情。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import * as React from "react";
import { FileText, Star } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button.jsx";
import { METRIC_LABELS } from "@/lib/name-engine.js";
import { cn } from "@/lib/utils.js";
import { ElementPill, elementStyles } from "./common.jsx";

function Section({ title, children }) {
  return (
    <div className="space-y-2 border-t border-border/70 px-4 py-3.5">
      <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
      {children}
    </div>
  );
}

function Distribution({ name }) {
  return (
    <div className="grid gap-4 rounded-lg border border-border bg-background p-3 md:grid-cols-[1fr_1fr]">
      <div>
        <p className="mb-2.5 text-[13px] font-medium">五行分布（喜用：{name.complement}）</p>
        <div className="flex items-end gap-5">
          {name.distribution.map(([element, count]) => (
            <div key={element} className="space-y-1.5 text-center">
              <span className={cn("grid h-7 w-7 place-items-center rounded-md font-serif text-sm font-semibold", elementStyles[element])}>{element}</span>
              <span className="block text-xs tabular-nums text-muted-foreground">{count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-border md:border-l md:pl-4">
        <p className="mb-2.5 text-[13px] font-medium">五行补益</p>
        <div className="mb-2 flex gap-1.5">{name.elements.map((item) => <ElementPill key={item} value={item} />)}</div>
        <p className="text-[13px] leading-5 text-muted-foreground">此名补益 {name.complement}，与命局喜用相合，有助平衡。</p>
      </div>
    </div>
  );
}

function BranchGrid({ name }) {
  return (
    <div className="grid grid-cols-2 gap-y-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-4">
      {name.branches.map(([label, stem, elements]) => (
        <div key={label} className="border-border text-center sm:border-r sm:last:border-r-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1.5 font-serif text-lg font-semibold">{stem}</p>
          <p className="mt-1.5 flex justify-center gap-1.5 text-sm">
            {elements.map((item) => (
              <span key={item} className={cn("font-semibold", elementStyles[item])}>{item}</span>
            ))}
          </p>
        </div>
      ))}
    </div>
  );
}

function MetricBars({ name }) {
  return (
    <div className="space-y-2">
      {METRIC_LABELS.map(([label, key], index) => {
        const max = [25, 20, 15, 20, 10, 10][index];
        const value = name.metrics[index];
        if (value == null) return null;
        return (
          <div key={key} className="grid grid-cols-[64px_1fr_44px] items-center gap-2.5 text-[13px]">
            <span className="text-muted-foreground">{label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <span className="block h-full rounded-full bg-foreground/80" style={{ width: `${(value / max) * 100}%` }} />
            </span>
            <span className="text-right text-xs tabular-nums text-muted-foreground">
              {value}/{max}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DetailEmptyState({ isGenerating }) {
  return (
    <section className="grid bg-card place-items-center px-6 py-16 text-center">
      <div className="max-w-[280px] space-y-3">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-lg border border-border bg-card text-muted-foreground shadow-paper">
          <FileText weight="duotone" className={cn("h-5 w-5", isGenerating && "animate-pulse text-foreground")} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{isGenerating ? "解析正在生成" : "解析区等待结果"}</p>
          <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
            {isGenerating ? "Codex 会把名字、评分与命理分析写回这里。" : "生成完成后，这里会展示名字详情、评分构成、五行分布与各维度解析。"}
          </p>
        </div>
      </div>
    </section>
  );
}

export function DetailPanel({ name, favorite, toggleFavorite, isGenerating }) {
  if (!name) return <DetailEmptyState isGenerating={isGenerating} />;

  return (
    <section className="flex flex-col bg-card">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">名字解析</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="font-serif text-[1.75rem] font-semibold leading-none tracking-wide">{name.fullName}</span>
            <span className="text-lg font-semibold tabular-nums leading-none text-emerald-600">{name.score}</span>
            <span className="text-xs text-muted-foreground">{name.grade}</span>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => toggleFavorite(name.id)}>
          <Star weight={favorite ? "fill" : "regular"} className={cn("h-3.5 w-3.5", favorite && "text-amber-500")} />
          {favorite ? "已收藏" : "收藏"}
        </Button>
      </div>
      <Section title="评分构成">
        <MetricBars name={name} />
      </Section>
      {name.branches ? (
        <Section title="八字五行">
          <Distribution name={name} />
          <BranchGrid name={name} />
          <p className="text-[13px] leading-6 text-muted-foreground">{name.analysis}</p>
        </Section>
      ) : null}
      <Section title="音律分析">
        <p className="text-[13px] leading-6 text-muted-foreground">
          “{name.fullName}”声母开合有序，尾音清亮，读来不拗口，适合日常高频呼唤。
        </p>
      </Section>
      <Section title="字形结构">
        <p className="text-[13px] leading-6 text-muted-foreground">字形左右疏密均衡，笔画不过重，签名与屏幕显示都有较好识别度。</p>
      </Section>
      <Section title="寓意解析">
        <p className="text-[13px] leading-6 text-muted-foreground">{name.summary}</p>
      </Section>
      <Section title="出处典故">
        <p className="text-[13px] leading-6 text-muted-foreground">{name.poems}</p>
      </Section>
      <Section title="避讳提醒">
        <p className="text-[13px] leading-6 text-muted-foreground">
          {name.risk}。未命中常见谐音、生肖冲突与负面联想，建议继续结合家族避讳复核。
        </p>
      </Section>
      <div className="border-t border-border/70 p-4">
        <Button type="button" variant="outline" className="w-full">
          <FileText className="h-3.5 w-3.5" />
          查看完整解析报告
        </Button>
      </div>
    </section>
  );
}
