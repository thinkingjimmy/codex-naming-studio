/**
 * - [INPUT]: 依赖 @phosphor-icons/react 操作图标、候选名数据、pending 元信息、收藏/对比状态、sortCandidates 排序规则与 workbench/common 展示工具。
 * - [OUTPUT]: 对外提供 CandidatePanel 推荐名字扫描表面板。
 * - [POS]: components/workbench 的中栏结果面板，负责空白/loading/等待接管/扫描表/分页五种视觉状态。
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

const candidateGridClass = "grid-cols-[28px_minmax(86px,1fr)_56px_58px_minmax(132px,1.4fr)_58px_24px]";

function NameRow({ name, selected, favorite, compared, onSelect, onFavorite, onCompare }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "grid min-h-[82px] w-full items-center gap-2 border-b border-l-4 border-border/70 border-l-transparent px-3 py-2 text-left transition-colors hover:bg-secondary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
        candidateGridClass,
        selected && "border-l-primary bg-primary/5 shadow-inset",
      )}
    >
      <span className="flex items-center">
        <span
          role="checkbox"
          aria-checked={compared}
          onClick={(event) => {
            event.stopPropagation();
            onCompare();
          }}
          className={cn("grid h-4 w-4 place-items-center rounded border border-border bg-white", compared && "border-primary bg-primary text-primary-foreground")}
        >
          {compared ? <Check className="h-3 w-3" /> : null}
        </span>
      </span>
      <span className="font-serif text-[1.6rem] font-semibold leading-none text-stone-800">{name.fullName}</span>
      <span>
        <b className="font-serif text-[1.45rem] font-semibold leading-none text-amber-600">{name.score}</b>
        <em className="block text-xs not-italic text-stone-700">{name.grade}</em>
      </span>
      <span className="space-y-1">
        {name.elements.length > 0 ? (
          <>
            <span className="flex gap-1.5">{name.elements.map((item) => <ElementPill key={item} value={item} />)}</span>
            <span className="block text-xs text-muted-foreground">补{name.complement}</span>
          </>
        ) : (
          <span className="block text-xs text-muted-foreground">未测五行</span>
        )}
      </span>
      <span className="text-sm leading-5 text-stone-700">{name.summary}</span>
      <Badge className={cn("justify-self-start whitespace-nowrap px-1.5", name.risk === "风险中" ? "bg-amber-100 text-amber-700" : "")}>{name.risk}</Badge>
      <Star
        weight={favorite ? "fill" : "regular"}
        onClick={(event) => {
          event.stopPropagation();
          onFavorite();
        }}
        className={cn("h-[18px] w-[18px] justify-self-center text-muted-foreground", favorite && "text-amber-500")}
      />
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

export function CandidatePanel({ names, selectedId, favorites, comparedIds, setSelectedId, toggleFavorite, toggleCompare, onRefresh, isGenerating, status, error, pendingMeta }) {
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
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border/70 !p-3">
        <div>
          <CardTitle className="!text-[1.05rem]">为您推荐的名字</CardTitle>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{names.length > 0 ? `共 ${names.length} 个好名` : "尚未生成"}</span>
            <Badge variant={status.provider === "codex" ? "default" : "gold"}>{providerLabel(status.provider)}</Badge>
            <span>{status.model}</span>
          </p>
          {pendingMeta && status.provider === "pending-codex" ? (
            <p className="mt-2 break-all text-xs text-muted-foreground">
              已提交第 {pendingMeta.batch} 批：{pendingMeta.requestId}
            </p>
          ) : null}
          {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
        </div>
        <div className="grid grid-cols-[7.25rem_6.25rem_5.5rem] gap-2">
          <Select className="!h-8 !w-[7.25rem] !px-2" value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="score">综合推荐</option>
            <option value="style">风格匹配</option>
            <option value="risk">风险优先</option>
          </Select>
          <Select className="!h-8 !w-[6.25rem] !px-2" value={filterMode} onChange={(event) => setFilterMode(event.target.value)}>
            <option value="all">筛选</option>
            <option value="high">90 分以上</option>
            <option value="safe">低风险</option>
          </Select>
          <Button type="button" variant="outline" size="sm" className="!px-2.5" onClick={onRefresh} disabled={isGenerating || names.length === 0}>
            <ArrowClockwise className={cn("h-4 w-4", isGenerating && "animate-spin")} />
            {isGenerating ? "生成中" : "换批"}
          </Button>
        </div>
      </CardHeader>
      {names.length === 0 ? (
        <CandidateEmptyState isGenerating={isGenerating} />
      ) : (
        <>
          <div className={cn("hidden gap-2 border-b border-border bg-secondary/35 px-3 py-2 text-xs font-medium text-stone-700 lg:grid", candidateGridClass)}>
            <span>对比</span>
            <span>姓名</span>
            <span>评分</span>
            <span>五行</span>
            <span>寓意</span>
            <span>风险</span>
            <span>藏</span>
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
          <div className="flex items-center justify-center gap-3 px-5 py-2.5 text-sm text-muted-foreground">
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
          <p className="border-t border-border px-5 py-2 text-center text-xs text-muted-foreground">
            小贴士：点击名字可查看详细解析，点击 <Star className="mx-1 inline h-4 w-4" /> 可加入对比
          </p>
        </>
      )}
    </Card>
  );
}
