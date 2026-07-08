/**
 * - [INPUT]: 依赖 @phosphor-icons/react 操作图标、候选名数据、收藏/对比状态、sortCandidates 排序规则与 workbench/common 展示工具。
 * - [OUTPUT]: 对外提供 CandidatePanel 推荐名字列表面板。
 * - [POS]: components/workbench 的中栏结果面板，负责空白/loading/列表/分页四种视觉状态。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import * as React from "react";
import { ArrowClockwise, CaretLeft, CaretRight, Check, Sparkle, Star } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Select } from "@/components/ui/select.jsx";
import { sortCandidates } from "@/lib/name-engine.js";
import { cn } from "@/lib/utils.js";
import { ElementPill, providerLabel } from "./common.jsx";

function NameRow({ name, selected, favorite, compared, onSelect, onFavorite, onCompare }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "grid w-full grid-cols-[34px_minmax(110px,1fr)_72px_96px_minmax(145px,1.3fr)_72px_38px] items-center gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors hover:bg-secondary/45",
        selected && "rounded-md border border-primary bg-primary/5 shadow-inset",
      )}
    >
      <span className="flex items-center gap-2">
        <span
          role="checkbox"
          aria-checked={compared}
          onClick={(event) => {
            event.stopPropagation();
            onCompare();
          }}
          className={cn("grid h-5 w-5 place-items-center rounded border border-border bg-white", compared && "border-primary bg-primary text-primary-foreground")}
        >
          {compared ? <Check className="h-3.5 w-3.5" /> : null}
        </span>
        <Star
          weight={favorite ? "fill" : "regular"}
          onClick={(event) => {
            event.stopPropagation();
            onFavorite();
          }}
          className={cn("h-5 w-5 text-muted-foreground", favorite && "text-amber-500")}
        />
      </span>
      <span className="font-serif text-[2rem] font-semibold leading-none text-stone-800">{name.fullName}</span>
      <span>
        <b className="font-serif text-3xl font-semibold text-amber-600">{name.score}</b>
        <em className="block text-sm not-italic text-stone-700">{name.grade}</em>
      </span>
      <span className="space-y-1">
        <span className="flex gap-1.5">{name.elements.map((item) => <ElementPill key={item} value={item} />)}</span>
        <span className="block text-xs text-muted-foreground">补{name.complement}</span>
      </span>
      <span className="text-sm leading-7 text-stone-700">{name.summary}</span>
      <Badge className={name.risk === "风险中" ? "bg-amber-100 text-amber-700" : ""}>{name.risk}</Badge>
      <Star weight={favorite ? "fill" : "regular"} className={cn("h-5 w-5 justify-self-center text-muted-foreground", favorite && "text-amber-500")} />
    </button>
  );
}

function CandidateEmptyState({ isGenerating }) {
  return (
    <div className="grid min-h-[460px] place-items-center px-6 py-10 text-center">
      <div className="max-w-[360px] space-y-4">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-600">
          <Sparkle weight="duotone" className={cn("h-7 w-7", isGenerating && "animate-spin")} />
        </div>
        <div>
          <p className="font-serif text-2xl font-semibold text-stone-800">{isGenerating ? "Codex 正在测算" : "等待生成名字"}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isGenerating ? "出生信息已提交，结果会在这里自动出现。" : "填写左侧信息后点击生成，Codex 会返回评分、五行、音律与寓意解析。"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CandidatePanel({ names, selectedId, favorites, comparedIds, setSelectedId, toggleFavorite, toggleCompare, onRefresh, isGenerating, status, error }) {
  const [sortMode, setSortMode] = React.useState("score");
  const [filterMode, setFilterMode] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const sorted = sortCandidates(names, sortMode).filter((name) => {
    if (filterMode === "high") return name.score >= 90;
    if (filterMode === "safe") return name.risk !== "风险中";
    return true;
  });
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  React.useEffect(() => setPage(1), [sortMode, filterMode, names]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="items-start pb-3">
        <div>
          <CardTitle>为您推荐的名字</CardTitle>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{names.length > 0 ? `共 ${names.length} 个好名` : "尚未生成"}</span>
            <Badge variant={status.provider === "openai-responses" || status.provider === "codex" ? "default" : "gold"}>{providerLabel(status.provider)}</Badge>
            <span>{status.model}</span>
          </p>
          {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="score">综合推荐</option>
            <option value="style">风格匹配</option>
            <option value="risk">风险优先</option>
          </Select>
          <Select value={filterMode} onChange={(event) => setFilterMode(event.target.value)}>
            <option value="all">筛选</option>
            <option value="high">90 分以上</option>
            <option value="safe">低风险</option>
          </Select>
          <Button type="button" variant="outline" onClick={onRefresh} disabled={isGenerating || names.length === 0}>
            <ArrowClockwise className={cn("h-4 w-4", isGenerating && "animate-spin")} />
            {isGenerating ? "生成中" : "换一批"}
          </Button>
        </div>
      </CardHeader>
      {names.length === 0 ? (
        <CandidateEmptyState isGenerating={isGenerating} />
      ) : (
        <>
          <div className="hidden grid-cols-[34px_minmax(110px,1fr)_72px_96px_minmax(145px,1.3fr)_72px_38px] gap-3 border-y border-border bg-secondary/35 px-4 py-3 text-sm font-medium text-stone-700 lg:grid">
            <span>推荐</span>
            <span>姓名</span>
            <span>综合评分</span>
            <span>五行补益</span>
            <span>寓意摘要</span>
            <span>谐音风险</span>
            <span>收藏</span>
          </div>
          <div>
            {visible.map((name) => (
              <NameRow
                key={name.id}
                name={name}
                selected={name.id === selectedId}
                favorite={favorites.has(name.id)}
                compared={comparedIds.includes(name.id)}
                onSelect={() => setSelectedId(name.id)}
                onFavorite={() => toggleFavorite(name.id)}
                onCompare={() => toggleCompare(name.id)}
              />
            ))}
          </div>
          <div className="flex items-center justify-center gap-4 px-5 py-3 text-sm text-muted-foreground">
            <Button type="button" size="icon" variant="ghost" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <CaretLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
              <button
                key={item}
                className={cn("h-8 w-8 rounded-md", item === currentPage ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}
                onClick={() => setPage(item)}
                type="button"
              >
                {item}
              </button>
            ))}
            <Button type="button" size="icon" variant="ghost" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              <CaretRight className="h-4 w-4" />
            </Button>
            <span>共 {totalPages} 页</span>
          </div>
          <p className="border-t border-border px-5 py-2.5 text-center text-sm text-muted-foreground">
            小贴士：点击名字可查看详细解析，点击 <Star className="mx-1 inline h-4 w-4" /> 可加入对比
          </p>
        </>
      )}
    </Card>
  );
}
