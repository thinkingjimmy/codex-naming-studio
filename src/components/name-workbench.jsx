/**
 * - [INPUT]: 依赖 react 状态钩子、api-client 双模状态协议（含 widget 桥检测与 follow-up 唤醒）、name-engine 默认/合并/归一化 profile 能力、styles.css 全高工作台壳子、workbench/common 的 providerLabel 与面板组件。
 * - [OUTPUT]: 对外提供 NameWorkbench 顶栏 + 三栏全高起名产品组件。
 * - [POS]: components 的产品状态机，协调顶栏状态、左栏输入、中栏候选、右栏解析、latestResult 复水、pending 元信息、超时降级与响应式工作台布局。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import * as React from "react";
import { hasNamingWidgetBridge, loadNameState, sendGenerateFollowUp, submitNameRequest } from "@/lib/api-client.js";
import { DEFAULT_PROFILE, mergeProfile, normalizeProfile } from "@/lib/name-engine.js";
import { CandidatePanel } from "./workbench/candidate-panel.jsx";
import { providerLabel } from "./workbench/common.jsx";
import { DetailPanel } from "./workbench/detail-panel.jsx";
import { ProfilePanel } from "./workbench/profile-panel.jsx";

function WorkbenchHeader({ status, isGenerating }) {
  const dotClass =
    status.provider === "codex"
      ? "bg-emerald-500"
      : status.provider === "pending-codex"
        ? "bg-amber-500 animate-pulse"
        : "bg-zinc-300";
  return (
    <header className="flex h-12 flex-none items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-primary font-serif text-sm font-semibold text-primary-foreground">名</span>
        <span className="text-sm font-semibold tracking-tight">起名工作台</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        <span>{isGenerating ? "Codex 测算中" : providerLabel(status.provider)}</span>
        <span className="text-border">/</span>
        <span className="font-mono">{status.model}</span>
      </div>
    </header>
  );
}

const idleStatus = {
  provider: "idle",
  model: "Codex",
};
const REQUEST_WAIT_TIMEOUT_MS = 120000;
// 滞留恢复通道是对话消息：widget 模式 follow-up 一般已自动唤醒，此文案仅在唤醒失败时兜底；
// 兜底（localhost）模式下 watcher 可能已死，必须让用户手动去对话里说话。
function stalledMessage(requestId) {
  if (hasNamingWidgetBridge()) {
    return `Codex 暂未接管本次请求。请在对话中发送「处理起名请求 ${requestId || ""}」，结果会自动出现在这里。`;
  }
  return "Codex 暂时没有接管这个请求。请回到 Codex 对话发送「处理起名请求」，结果会自动显示在这里。";
}

function mergeResultProfile(current, requestProfile, resultProfile) {
  return normalizeProfile(mergeProfile(mergeProfile(current, requestProfile || {}), resultProfile || {}));
}

function pendingExpired(request) {
  const time = Date.parse(request?.updatedAt || request?.createdAt || "");
  return Number.isFinite(time) && Date.now() - time >= REQUEST_WAIT_TIMEOUT_MS;
}

export function NameWorkbench() {
  const [profile, setProfile] = React.useState(DEFAULT_PROFILE);
  const [batch, setBatch] = React.useState(0);
  const [names, setNames] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [favorites, setFavorites] = React.useState(() => new Set());
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [pendingRequestId, setPendingRequestId] = React.useState("");
  const [pendingMeta, setPendingMeta] = React.useState(null);
  const [status, setStatus] = React.useState(idleStatus);
  const [error, setError] = React.useState("");

  const applyNames = React.useCallback((nextNames, nextStatus) => {
    setNames(nextNames);
    setSelectedId(nextNames[0]?.id || "");
    setFavorites((current) => new Set([...current].filter((id) => nextNames.some((name) => name.id === id))));
    setStatus(nextStatus);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function hydrateLatestResult() {
      try {
        const state = await loadNameState();
        if (cancelled) return;
        if (state.latestPendingRequest) {
          const pending = state.latestPendingRequest;
          setProfile((current) => mergeResultProfile(current, pending.profile, null));
          setBatch(pending.batch || 0);
          setNames([]);
          setSelectedId("");
          setPendingRequestId(pending.id);
          setPendingMeta({
            requestId: pending.id,
            batch: pending.batch || 0,
          });
          setIsGenerating(!pendingExpired(pending));
          setStatus({
            provider: "pending-codex",
            model: "Codex",
          });
          setError(pendingExpired(pending) ? stalledMessage(pending.id) : "");
          return;
        }
        if (!state.latestResult?.candidates?.length) return;
        applyNames(state.latestResult.candidates, {
          provider: state.latestResult.provider || "codex",
          model: state.latestResult.model || "Codex",
        });
        setProfile((current) => mergeResultProfile(current, state.latestRequest?.profile, state.latestResult.profile));
        setBatch(state.latestResult.batch || state.latestRequest?.batch || 0);
        setError("");
      } catch (_caught) {
        // 初次复水失败不遮挡表单；用户仍可重新生成。
      }
    }

    void hydrateLatestResult();
    return () => {
      cancelled = true;
    };
  }, [applyNames]);

  React.useEffect(() => {
    if (!pendingRequestId) return undefined;
    let cancelled = false;
    let inFlight = false;
    let timedOut = false;
    const startedAt = Date.now();

    async function pollResult() {
      if (inFlight) return;
      inFlight = true;
      try {
        const state = await loadNameState();
        if (cancelled) return;
        const request = state.requests?.[pendingRequestId];
        if (!request) return;
        if (request.status === "pending" && !timedOut && Date.now() - startedAt >= REQUEST_WAIT_TIMEOUT_MS) {
          timedOut = true;
          setIsGenerating(false);
          setError(stalledMessage(pendingRequestId));
          setStatus({
            provider: "pending-codex",
            model: "Codex",
          });
        }
        if (request.status === "completed" && request.result?.candidates?.length) {
          applyNames(request.result.candidates, {
            provider: request.result.provider || "codex",
            model: request.result.model || "Codex",
          });
          setProfile((current) => mergeResultProfile(current, request.profile, request.result.profile));
          setPendingRequestId("");
          setPendingMeta(null);
          setIsGenerating(false);
          setError("");
        }
        if (request.status === "error") {
          setError(request.error || "Codex 未能完成本次测算。");
          setPendingRequestId("");
          setPendingMeta(null);
          setIsGenerating(false);
          setStatus({
            provider: "pending-codex",
            model: "Codex",
          });
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "无法读取工作台状态。");
        }
      } finally {
        inFlight = false;
      }
    }

    void pollResult();
    const timer = window.setInterval(pollResult, 1600);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applyNames, pendingRequestId]);

  const selectedName = names.find((name) => name.id === selectedId) || names[0] || null;
  const toggleFavorite = (id) =>
    setFavorites((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const resetWorkbench = () => {
    setProfile(DEFAULT_PROFILE);
    setBatch(0);
    setNames([]);
    setSelectedId("");
    setFavorites(new Set());
    setPendingRequestId("");
    setPendingMeta(null);
    setIsGenerating(false);
    setError("");
    setStatus(idleStatus);
  };

  const generate = async (nextProfile = profile, nextBatch = batch + 1) => {
    setBatch(nextBatch);
    setError("");
    setNames([]);
    setSelectedId("");
    setPendingRequestId("");
    setPendingMeta(null);
    setIsGenerating(true);

    try {
      const pending = await submitNameRequest(nextProfile, nextBatch);
      setPendingRequestId(pending.requestId);
      setPendingMeta({
        requestId: pending.requestId,
        batch: nextBatch,
      });
      setStatus({
        provider: pending.provider,
        model: pending.model,
      });
      // widget 模式：请求已落盘，follow-up 消息负责唤醒 Codex；发送失败不清 pending，立即给恢复指引。
      if (hasNamingWidgetBridge()) {
        try {
          await sendGenerateFollowUp(pending.requestId);
        } catch (_caught) {
          setError(stalledMessage(pending.requestId));
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法提交起名请求。");
      setIsGenerating(false);
      setPendingMeta(null);
      setStatus(idleStatus);
    }
  };

  return (
    <main className="workbench-app">
      <WorkbenchHeader status={status} isGenerating={isGenerating} />
      <div className="workbench-columns">
        <ProfilePanel profile={profile} setProfile={setProfile} onClear={resetWorkbench} onGenerate={() => generate()} isGenerating={isGenerating} />
        <CandidatePanel
          names={names}
          selectedId={selectedId}
          favorites={favorites}
          setSelectedId={setSelectedId}
          toggleFavorite={toggleFavorite}
          onRefresh={() => generate()}
          isGenerating={isGenerating}
          status={status}
          error={error}
          pendingMeta={pendingMeta}
        />
        <DetailPanel
          name={selectedName}
          favorite={selectedName ? favorites.has(selectedName.id) : false}
          toggleFavorite={toggleFavorite}
          isGenerating={isGenerating}
        />
      </div>
    </main>
  );
}
