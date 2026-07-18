/**
 * - [INPUT]: 依赖 react、api-client 部分成功提交/纯读状态协议、name-engine profile 归一化与 workbench 面板组件。
 * - [OUTPUT]: 对外提供 NameWorkbench 顶栏 + 三栏全高起名产品组件。
 * - [POS]: components 的产品状态机，以 latestActiveRequest 区分 pending 120s 与 processing 600s 窗口，triggerLagging 仍保持轮询。
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
// 两级等待窗口由持久状态决定：pending 尚未 claim 为 2 分钟；processing
// 已有 claimOwner，允许研究与测算持续 10 分钟。
const REQUEST_WAIT_TIMEOUT_MS = 120000;
const PROCESSING_WAIT_TIMEOUT_MS = 600000;

// 滞留恢复通道是对话消息：widget 模式文案保持等待语气（Codex 可能仍在测算）；
// 兜底（localhost）模式下 watcher 可能已死，必须让用户手动去对话里说话。
function stalledMessage(requestId) {
  if (hasNamingWidgetBridge()) {
    return `等待时间较长。若 Codex 正在测算请稍候，结果会自动出现；若对话中没有动静，请发送「处理起名请求 ${requestId || ""}」。`;
  }
  return "Codex 暂时没有接管这个请求。请回到 Codex 对话发送「处理起名请求」，结果会自动显示在这里。";
}

function mergeResultProfile(current, requestProfile, resultProfile) {
  return normalizeProfile(mergeProfile(mergeProfile(current, requestProfile || {}), resultProfile || {}));
}

function activeExpired(request) {
  const time = Date.parse(request?.updatedAt || request?.createdAt || "");
  const timeout = request?.status === "processing"
    ? PROCESSING_WAIT_TIMEOUT_MS
    : REQUEST_WAIT_TIMEOUT_MS;
  return Number.isFinite(time) && Date.now() - time >= timeout;
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
        if (state.latestActiveRequest) {
          const active = state.latestActiveRequest;
          setProfile((current) => mergeResultProfile(current, active.profile, null));
          setBatch(active.batch || 0);
          setNames([]);
          setSelectedId("");
          setPendingRequestId(active.id);
          setPendingMeta({
            requestId: active.id,
            batch: active.batch || 0,
          });
          setIsGenerating(!activeExpired(active));
          setStatus({
            provider: "pending-codex",
            model: "Codex",
          });
          setError(activeExpired(active) ? stalledMessage(active.id) : "");
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
    let observedStatus = "";

    async function pollResult() {
      if (inFlight) return;
      inFlight = true;
      try {
        const state = await loadNameState();
        if (cancelled) return;
        const request = state.requests?.[pendingRequestId];
        if (!request) return;
        if (request.status !== observedStatus) {
          observedStatus = request.status;
          timedOut = false;
          if (request.status === "pending" || request.status === "processing") {
            setIsGenerating(true);
            setError("");
          }
        }
        const waitTimeoutMs = request.status === "processing"
          ? PROCESSING_WAIT_TIMEOUT_MS
          : REQUEST_WAIT_TIMEOUT_MS;
        const requestTime = Date.parse(request.updatedAt || request.createdAt || "");
        if ((request.status === "pending" || request.status === "processing") && !timedOut && Number.isFinite(requestTime) && Date.now() - requestTime >= waitTimeoutMs) {
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
      if (pending.triggerLagging) {
        setError("请求已保存，通知投递中；工作台会继续等待结果。");
      }
      // widget 模式：请求已落盘，follow-up 消息负责唤醒 Codex。发送成功意味着 Codex 必然接管，
      // 等待窗口放宽；发送失败不清 pending，立即给恢复指引。
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
