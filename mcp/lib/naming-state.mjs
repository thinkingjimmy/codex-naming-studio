/**
 * - [INPUT]: 依赖 node:fs/promises 与 node:path 读写用户项目的 .naming-product/state.json，依赖 name-engine 的 profile 合并/归一化与 task-plan 的约束路由。
 * - [OUTPUT]: 对外提供 nonEmpty、resolveNamingPaths、emptyState、readState、writeState、publicState、latestPendingRequest、saveNamingRequest。
 * - [POS]: mcp/lib 的状态单一真相源，被 MCP server 与 Vite 状态 middleware 共享，保证两端看到同一份请求/结果与唯一活跃 pending。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { mergeProfile, normalizeProfile } from "../../src/lib/name-engine.js";
import { buildTaskPlan } from "../../src/lib/task-plan.js";

export function nonEmpty(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function resolveNamingPaths(args = {}) {
  const projectDir = path.resolve(nonEmpty(args.projectDir) || process.cwd());
  const stateDir = path.resolve(nonEmpty(args.stateDir) || path.join(projectDir, ".naming-product"));
  return {
    projectDir,
    stateDir,
    stateFile: path.join(stateDir, "state.json"),
  };
}

export function emptyState() {
  return {
    version: 1,
    requests: {},
    latestRequestId: null,
    latestResultId: null,
    updatedAt: null,
  };
}

export async function readState(args = {}) {
  const paths = resolveNamingPaths(args);
  try {
    const parsed = JSON.parse(await readFile(paths.stateFile, "utf8"));
    return normalizeStoredState({ ...emptyState(), ...parsed, paths });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { ...emptyState(), paths };
  }
}

export async function writeState(args, state) {
  const paths = resolveNamingPaths(args);
  await mkdir(paths.stateDir, { recursive: true });
  const payload = {
    version: 1,
    requests: state.requests || {},
    latestRequestId: state.latestRequestId || null,
    latestResultId: state.latestResultId || null,
    updatedAt: new Date().toISOString(),
  };
  const tempFile = `${paths.stateFile}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(payload, null, 2)}\n`);
  await rename(tempFile, paths.stateFile);
  return { ...payload, paths };
}

export async function saveNamingRequest(args, requestInput = {}) {
  const id = nonEmpty(requestInput.id);
  if (!id) throw new Error("request.id is required.");
  const state = await readState(args);
  const now = new Date().toISOString();
  const profile = normalizeProfile(requestInput.profile || {});
  supersedeOtherPendingRequests(state, id, now);
  state.requests[id] = {
    id,
    profile,
    plan: buildTaskPlan(profile),
    batch: Number.isFinite(requestInput.batch) ? requestInput.batch : 0,
    source: nonEmpty(requestInput.source) || "gui",
    status: "pending",
    createdAt: state.requests[id]?.createdAt || now,
    updatedAt: now,
    result: null,
    error: null,
  };
  state.latestRequestId = id;
  return writeState(args, state);
}

export function latestPendingRequest(state = {}) {
  const latest = state.latestRequestId ? state.requests?.[state.latestRequestId] : null;
  if (latest?.status === "pending") return latest;
  if (latest) return null;
  const pending = Object.values(state.requests || {}).filter((request) => request?.status === "pending");
  return pending.sort(compareRequestTime).at(-1) || null;
}

export function publicState(state) {
  const latestRequest = state.latestRequestId ? state.requests[state.latestRequestId] || null : null;
  const latestResult = state.latestResultId ? state.requests[state.latestResultId]?.result || null : null;
  return {
    version: state.version,
    requests: state.requests,
    latestRequestId: state.latestRequestId,
    latestResultId: state.latestResultId,
    latestRequest,
    latestResult,
    latestPendingRequest: latestPendingRequest(state),
    updatedAt: state.updatedAt,
    projectDir: state.paths.projectDir,
    stateDir: state.paths.stateDir,
    stateFile: state.paths.stateFile,
  };
}

function normalizeStoredState(state) {
  const requests = {};
  for (const [id, request] of Object.entries(state.requests || {})) {
    requests[id] = normalizeStoredRequest(request);
  }
  return ensureSinglePendingRequest({ ...state, requests });
}

function normalizeStoredRequest(request) {
  if (!request || typeof request !== "object") return request;
  const profile = normalizeProfile(request.profile || {});
  const result = request.result && typeof request.result === "object"
    ? { ...request.result, profile: normalizeProfile(mergeProfile(profile, request.result.profile || {})) }
    : request.result;
  return {
    ...request,
    profile,
    plan: buildTaskPlan(profile),
    result,
  };
}

function ensureSinglePendingRequest(state) {
  const active = latestPendingRequest(state);
  if (active) {
    supersedeOtherPendingRequests(state, active.id, state.updatedAt || active.updatedAt || active.createdAt || "");
    return state;
  }
  if (state.latestRequestId && state.requests?.[state.latestRequestId]) {
    supersedeOtherPendingRequests(state, "", state.updatedAt || state.requests[state.latestRequestId]?.updatedAt || "");
  }
  return state;
}

function supersedeOtherPendingRequests(state, activeId, updatedAt) {
  for (const [id, request] of Object.entries(state.requests || {})) {
    if (id === activeId || request?.status !== "pending") continue;
    state.requests[id] = {
      ...request,
      status: "superseded",
      updatedAt: updatedAt || request.updatedAt || request.createdAt || null,
      error: null,
    };
  }
}

function compareRequestTime(left, right) {
  return requestTime(left) - requestTime(right);
}

function requestTime(request) {
  return Date.parse(request?.updatedAt || request?.createdAt || "") || 0;
}
