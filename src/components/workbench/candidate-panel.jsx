/**
 * - [INPUT]: 依赖 @phosphor-icons/react 操作图标、候选名数据、pending 元信息、收藏状态、sortCandidates 排序规则与 workbench/common 展示工具。
 * - [OUTPUT]: 对外提供 CandidatePanel 推荐名字扫描表面板（吸顶工具条 + 密排数据行 + 底部分页）。
 * - [POS]: components/workbench 的中栏结果面板，负责空白/loading/等待接管/扫描表/分页五种视觉状态。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import * as React from "react";
import { ArrowClockwise, CaretLeft, CaretRight, Sparkle, Star } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button.jsx";
import { Select } from "@/components/ui/select.jsx";
import { sortCandidates } from "@/lib/name-engine.js";
import { cn } from "@/lib/utils.js";
import { ElementPill, RiskDot } from "./common.jsx";

const candidateGridClass = "grid-cols-[minmax(88px,auto)_56px_minmax(64px,auto)_minmax(140px,1fr)_72px_32px]";

// 评分语义色：92+ 绿、85+ 蓝、其余灰 —— 一眼扫出梯队。
function scoreClass(score) {
  if (score >= 92) return "text-emerald-600";
  if (score >= 85) return "text-blue-600";
  return "text-foreground";
}

function NameRow({ name, selected, favorite, onSelect, onFavorite }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "grid w-full items-center gap-2 border-b border-border/70 px-4 py-3 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30",
        candidateGridClass,
        selected && "bg-secondary/70",
      )}
    >
      <span className="font-serif text-xl font-semibold leading-none tracking-wide text-foreground">{name.fullName}</span>
      <span className="tabular-nums">
        <b className={cn("text-lg font-semibold leading-none", scoreClass(name.score))}>{name.score}</b>
        <em className="block text-[11px] not-italic text-muted-foreground">{name.grade}</em>
      </span>
      <span className="space-y-1">
        {name.elements.length > 0 ? (
          <>
            <span className="flex gap-1">{name.elements.map((item) => <ElementPill key={item} value={item} />)}</span>
            <span className="block text-[11px] text-muted-foreground">补{name.complement}</span>
          </>
        ) : (
          <span className="block text-xs text-muted-foreground">未测五行</span>
        )}
      </span>
      <span className="text-[13px] leading-5 text-muted-foreground">{name.summary}</span>
      <RiskDot risk={name.risk} />
      <Star
        weight={favorite ? "fill" : "regular"}
        onClick={(event) => {
          event.stopPropagation();
          onFavorite();
        }}
        className={cn("h-4 w-4 justify-self-center text-muted-foreground/60 transition-colors hover:text-foreground", favorite && "text-amber-500 hover:text-amber-500")}
      />
    </button>
  );
}

function CandidateEmptyState({ isGenerating }) {
  return (
    <div className="grid flex-1 place-items-center px-6 py-16 text-center">
      <div className="max-w-[340px] space-y-3">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-lg border border-border bg-card text-muted-foreground shadow-paper">
          <Sparkle weight="duotone" className={cn("h-5 w-5", isGenerating && "animate-spin text-foreground")} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{isGenerating ? "Codex 正在测算" : "等待生成名字"}</p>
          <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
            {isGenerating ? "出生信息已提交，结果会在这里自动出现。" : "填写左侧信息后点击生成，Codex 会返回评分、五行、音律与寓意解析。"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CandidatePanel({ names, selectedId, favorites, setSelectedId, toggleFavorite, onRefresh, isGenerating, status, error, pendingMeta }) {
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
    <section className="flex flex-col bg-card">
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">推荐名字</h2>
            <p className="text-xs text-muted-foreground">{names.length > 0 ? `共 ${names.length} 个候选` : "尚未生成"}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
              <option value="score">综合推荐</option>
              <option value="style">风格匹配</option>
              <option value="risk">风险优先</option>
            </Select>
            <Select value={filterMode} onChange={(event) => setFilterMode(event.target.value)}>
              <option value="all">全部</option>
              <option value="high">90 分以上</option>
              <option value="safe">低风险</option>
            </Select>
            <Button type="button" variant="outline" onClick={onRefresh} disabled={isGenerating || names.length === 0}>
              <ArrowClockwise className={cn("h-3.5 w-3.5", isGenerating && "animate-spin")} />
              换一批
            </Button>
          </div>
        </div>
        {pendingMeta && status.provider === "pending-codex" ? (
          <p className="break-all border-t border-border/70 px-4 py-1.5 text-xs text-muted-foreground">
            已提交第 {pendingMeta.batch} 批：{pendingMeta.requestId}
          </p>
        ) : null}
        {error ? <p className="border-t border-border/70 bg-red-50/60 px-4 py-1.5 text-xs text-red-600">{error}</p> : null}
      </div>
      {names.length === 0 ? (
        <CandidateEmptyState isGenerating={isGenerating} />
      ) : (
        <>
          <div className={cn("hidden gap-2 border-b border-border bg-background px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground lg:grid", candidateGridClass)}>
            <span>姓名</span>
            <span>评分</span>
            <span>五行</span>
            <span>寓意</span>
            <span>风险</span>
            <span className="text-center">藏</span>
          </div>
          <div className="flex-1">
            {visible.map((name) => (
              <NameRow
                key={name.id}
                name={name}
                selected={name.id === selectedId}
                favorite={favorites.has(name.id)}
                onSelect={() => setSelectedId(name.id)}
                onFavorite={() => toggleFavorite(name.id)}
              />
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <span>
              第 {currentPage} / {totalPages} 页
            </span>
            <div className="flex items-center gap-1">
              <Button type="button" size="icon" variant="ghost" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                <CaretLeft className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
                <button
                  key={item}
                  className={cn(
                    "h-7 w-7 rounded-md text-xs transition-colors",
                    item === currentPage ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
                  )}
                  onClick={() => setPage(item)}
                  type="button"
                >
                  {item}
                </button>
              ))}
              <Button type="button" size="icon" variant="ghost" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                <CaretRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <span className="hidden sm:inline">点击名字查看解析</span>
          </div>
        </>
      )}
    </section>
  );
}
