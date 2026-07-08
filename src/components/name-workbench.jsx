/**
 * - [INPUT]: 依赖 react 状态钩子、@phosphor-icons/react 状态图标、api-client 状态协议、默认宝宝信息与工作台面板组件。
 * - [OUTPUT]: 对外提供 NameWorkbench 三栏起名产品组件。
 * - [POS]: components 的产品状态机，协调左栏输入、中栏候选、右栏解析，不承载具体面板渲染细节。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import * as React from "react";
import { Leaf } from "@phosphor-icons/react";
import { loadNameState, submitNameRequest } from "@/lib/api-client.js";
import { DEFAULT_PROFILE } from "@/lib/name-engine.js";
import { CandidatePanel } from "./workbench/candidate-panel.jsx";
import { DetailPanel } from "./workbench/detail-panel.jsx";
import { HeaderNav } from "./workbench/header-nav.jsx";
import { ProfilePanel } from "./workbench/profile-panel.jsx";

const idleStatus = {
  provider: "idle",
  model: "Codex",
  notice: "填写左侧信息后，点击生成交给 Codex 测算。",
};

export function NameWorkbench() {
  const [profile, setProfile] = React.useState(DEFAULT_PROFILE);
  const [batch, setBatch] = React.useState(0);
  const [names, setNames] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [favorites, setFavorites] = React.useState(() => new Set());
  const [comparedIds, setComparedIds] = React.useState([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [pendingRequestId, setPendingRequestId] = React.useState("");
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
    if (!pendingRequestId) return undefined;
    let cancelled = false;
    let inFlight = false;

    async function pollResult() {
      if (inFlight) return;
      inFlight = true;
      try {
        const state = await loadNameState();
        if (cancelled) return;
        const request = state.requests?.[pendingRequestId];
        if (!request) return;
        if (request.status === "completed" && request.result?.candidates?.length) {
          applyNames(request.result.candidates, {
            provider: request.result.provider || "codex",
            model: request.result.model || "Codex",
            notice: request.result.notice || "Codex 已完成命名测算，结果已回写到 GUI。",
          });
          setProfile((current) => request.result.profile || current);
          setPendingRequestId("");
          setIsGenerating(false);
          setError("");
        }
        if (request.status === "error") {
          setError(request.error || "Codex 未能完成本次测算。");
          setPendingRequestId("");
          setIsGenerating(false);
          setStatus({
            provider: "pending-codex",
            model: "Codex",
            notice: "Codex 返回了错误，工作台已退出 loading。",
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
    setIsGenerating(true);

    try {
      const pending = await submitNameRequest(nextProfile, nextBatch);
      setPendingRequestId(pending.requestId);
      setStatus({
        provider: pending.provider,
        model: pending.model,
        notice: pending.notice,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法提交起名请求。");
      setIsGenerating(false);
      setStatus(idleStatus);
    }
  };

  return (
    <main className="min-h-screen paper-grid">
      <HeaderNav />
      <div className="mx-auto grid max-w-[1560px] gap-4 px-5 py-4 xl:grid-cols-[390px_minmax(610px,1fr)_430px]">
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
      <div className="mx-auto mb-5 max-w-[1560px] px-5 text-xs text-muted-foreground">
        <Leaf className="mr-1 inline h-3.5 w-3.5" />
        {status.notice}
      </div>
    </main>
  );
}
