/**
 * - [INPUT]: 依赖 react 状态钩子、api-client 状态协议、name-engine 默认/合并/归一化 profile 能力、styles.css 工作台壳子与面板组件。
 * - [OUTPUT]: 对外提供 NameWorkbench 零缝隙三栏起名产品组件。
 * - [POS]: components 的产品状态机，协调左栏输入、中栏候选、右栏解析、latestResult 复水、pending 元信息、超时降级与响应式工作台布局。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import * as React from "react";
import { loadNameState, submitNameRequest } from "@/lib/api-client.js";
import { DEFAULT_PROFILE, mergeProfile, normalizeProfile } from "@/lib/name-engine.js";
import { CandidatePanel } from "./workbench/candidate-panel.jsx";
import { DetailPanel } from "./workbench/detail-panel.jsx";
import { ProfilePanel } from "./workbench/profile-panel.jsx";

const idleStatus = {
  provider: "idle",
  model: "Codex",
};
const REQUEST_WAIT_TIMEOUT_MS = 120000;

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
  const [comparedIds, setComparedIds] = React.useState([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [pendingRequestId, setPendingRequestId] = React.useState("");
  const [pendingMeta, setPendingMeta] = React.useState(null);
  const [status, setStatus] = React.useState(idleStatus);
  const [error, setError] = React.useState("");

  const applyNames = React.useCallback((nextNames, nextStatus) => {
    setNames(nextNames);
    setSelectedId(nextNames[0]?.id || "");
    setComparedIds(nextNames.slice(0, 3).map((name) => name.id));
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
          setComparedIds([]);
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
          setError(pendingExpired(pending) ? "Codex 还没有接管这个请求。再次点击生成会提交新请求并自动取代旧请求。" : "");
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
          setError("Codex 还没有接管这个请求。再次点击生成会提交新请求并自动取代旧请求。");
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
  const toggleCompare = (id) =>
    setComparedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return [...current.slice(-2), id];
    });

  const resetWorkbench = () => {
    setProfile(DEFAULT_PROFILE);
    setBatch(0);
    setNames([]);
    setSelectedId("");
    setFavorites(new Set());
    setComparedIds([]);
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
    setComparedIds([]);
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法提交起名请求。");
      setIsGenerating(false);
      setPendingMeta(null);
      setStatus(idleStatus);
    }
  };

  return (
    <main className="min-h-screen paper-grid">
      <div className="workbench-shell">
        <ProfilePanel profile={profile} setProfile={setProfile} onClear={resetWorkbench} onGenerate={() => generate()} isGenerating={isGenerating} />
        <CandidatePanel
          names={names}
          selectedId={selectedId}
          favorites={favorites}
          comparedIds={comparedIds}
          setSelectedId={setSelectedId}
          toggleFavorite={toggleFavorite}
          toggleCompare={toggleCompare}
          onRefresh={() => generate()}
          isGenerating={isGenerating}
          status={status}
          error={error}
          pendingMeta={pendingMeta}
        />
        <DetailPanel
          name={selectedName}
          names={names}
          favorite={selectedName ? favorites.has(selectedName.id) : false}
          comparedIds={comparedIds}
          toggleFavorite={toggleFavorite}
          toggleCompare={toggleCompare}
          isGenerating={isGenerating}
        />
      </div>
    </main>
  );
}
