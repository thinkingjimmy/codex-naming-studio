/**
 * - [INPUT]: 依赖 @phosphor-icons/react 解析/对比图标、候选名详情数据、METRIC_LABELS 指标、Tabs/Card/Button 与 workbench/common 展示工具。
 * - [OUTPUT]: 对外提供 DetailPanel 名字解析与对比面板。
 * - [POS]: components/workbench 的右栏解释面板，负责空白/loading、详情 tabs 与对比卡片。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import * as React from "react";
import { ArrowClockwise, FileText, Plus, Star, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.jsx";
import { METRIC_LABELS } from "@/lib/name-engine.js";
import { cn } from "@/lib/utils.js";
import { ElementPill, elementStyles, tabItems } from "./common.jsx";

function Distribution({ name }) {
  return (
    <div className="grid gap-4 rounded-md border border-border bg-white/58 p-3 md:grid-cols-[1fr_1fr]">
      <div>
        <p className="mb-3 text-sm font-medium">五行分布（喜用：木、火）</p>
        <div className="flex items-end gap-6">
          {name.distribution.map(([element, count]) => (
            <div key={element} className="space-y-2 text-center">
              <span className={cn("block font-serif text-xl font-semibold", elementStyles[element])}>{element}</span>
              <span className="block text-sm text-stone-700">{count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-border md:border-l md:pl-5">
        <p className="mb-3 text-sm font-medium">五行补益</p>
        <div className="mb-3 flex gap-2">{name.elements.map((item) => <ElementPill key={item} value={item} />)}</div>
        <p className="text-sm leading-6 text-stone-700">此名补益 {name.complement}，与命局喜用相合，有助平衡。</p>
      </div>
    </div>
  );
}

function BranchGrid({ name }) {
  return (
    <div className="grid grid-cols-2 gap-y-4 rounded-md border border-border bg-white/58 p-3 sm:grid-cols-4">
      {name.branches.map(([label, stem, elements]) => (
        <div key={label} className="border-border text-center sm:border-r sm:last:border-r-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 font-serif text-xl font-semibold">{stem}</p>
          <p className="mt-2 flex justify-center gap-2">
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
    <div className="space-y-2.5">
      {METRIC_LABELS.map(([label, key], index) => {
        const max = [25, 20, 15, 20, 10, 10][index];
        const value = name.metrics[index];
        return (
          <div key={key} className="grid grid-cols-[74px_1fr_48px] items-center gap-3 text-sm">
            <span>{label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-secondary">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${(value / max) * 100}%` }} />
            </span>
            <span className="text-right text-xs text-stone-700">
              {value}/{max}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DetailContent({ tab, name }) {
  if (tab === "bazi") {
    return (
      <div className="space-y-4">
        <Distribution name={name} />
        <div>
          <p className="mb-2 text-sm font-medium">八字命盘</p>
          <BranchGrid name={name} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">命理简析</p>
          <p className="text-sm leading-6 text-stone-700">{name.analysis}</p>
        </div>
      </div>
    );
  }

  const copy = {
    sound: `“${name.fullName}”声母开合有序，尾音清亮，读来不拗口，适合日常高频呼唤。`,
    shape: "字形左右疏密均衡，笔画不过重，签名与屏幕显示都有较好识别度。",
    meaning: name.summary,
    source: name.poems,
    avoid: `${name.risk}。未命中常见谐音、生肖冲突与负面联想，建议继续结合家族避讳复核。`,
  };

  return (
    <div className="rounded-md border border-border bg-white/58 p-3">
      <p className="text-sm leading-6 text-stone-700">{copy[tab]}</p>
    </div>
  );
}

function ComparePanel({ names, comparedIds, selectedId, toggleCompare }) {
  const compared = comparedIds.map((id) => names.find((name) => name.id === id)).filter(Boolean);
  const fallback = names.find((name) => !comparedIds.includes(name.id) && name.id !== selectedId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">对比名字（最多 3 个）</CardTitle>
        <Button type="button" size="sm" variant="ghost" onClick={() => compared.forEach((name) => toggleCompare(name.id))}>
          <ArrowClockwise className="h-4 w-4" />
          清空
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {compared.map((name) => (
            <button key={name.id} type="button" onClick={() => toggleCompare(name.id)} className="relative rounded-md border border-primary bg-primary/5 p-2.5 text-center">
              <X className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <p className="font-serif text-lg font-semibold">{name.fullName}</p>
              <p className="mt-1 text-xs text-amber-700">{name.score}分</p>
              <p className="mt-2 flex justify-center gap-1">{name.elements.map((item) => <ElementPill key={item} value={item} />)}</p>
            </button>
          ))}
          {compared.length < 3 && fallback ? (
            <button type="button" onClick={() => toggleCompare(fallback.id)} className="grid min-h-[92px] place-items-center rounded-md border border-dashed border-border bg-white/50 text-sm text-stone-700">
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                添加对比
              </span>
            </button>
          ) : null}
        </div>
        <MetricBars name={compared[0] || names[0]} />
        <Button type="button" variant="outline" className="w-full">
          <FileText className="h-4 w-4" />
          查看完整解析报告
        </Button>
      </CardContent>
    </Card>
  );
}

function DetailEmptyState({ isGenerating }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid min-h-[360px] place-items-center p-8 text-center">
          <div className="max-w-[300px] space-y-4">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-primary">
              <FileText weight="duotone" className={cn("h-7 w-7", isGenerating && "animate-pulse")} />
            </div>
            <div>
              <p className="font-serif text-2xl font-semibold text-stone-800">{isGenerating ? "解析正在生成" : "解析区等待结果"}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {isGenerating ? "Codex 会把名字、评分与命理分析写回这里。" : "生成完成后，这里会展示名字详情、五行分布、出处典故和对比卡片。"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function DetailPanel({ name, names, favorite, comparedIds, toggleFavorite, toggleCompare, isGenerating }) {
  const [tab, setTab] = React.useState("bazi");

  if (!name) return <DetailEmptyState isGenerating={isGenerating} />;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>名字解析</CardTitle>
            <span className="font-serif text-3xl font-semibold">{name.fullName}</span>
            <span className="font-serif text-2xl text-amber-600">{name.score}分</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => toggleFavorite(name.id)}>
            <Star weight={favorite ? "fill" : "regular"} className={cn("h-4 w-4", favorite && "text-amber-500")} />
            {favorite ? "已收藏" : "收藏"}
          </Button>
        </CardHeader>
        <TabsList>
          {tabItems.map(([id, label]) => (
            <TabsTrigger key={id} active={tab === id} onClick={() => setTab(id)}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <CardContent className="pt-4">
          <TabsContent active>
            <DetailContent tab={tab} name={name} />
          </TabsContent>
        </CardContent>
      </Card>
      <ComparePanel names={names} comparedIds={comparedIds} selectedId={name.id} toggleCompare={toggleCompare} />
    </div>
  );
}
