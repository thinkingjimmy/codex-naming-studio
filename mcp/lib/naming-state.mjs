/**
 * - [INPUT]: 依赖 node:fs/promises 与 node:path 读写用户项目的 .naming-product/state.json，依赖 task-plan 的约束路由。
 * - [OUTPUT]: 对外提供 nonEmpty、resolveNamingPaths、emptyState、readState、writeState、publicState、saveNamingRequest。
 * - [POS]: mcp/lib 的状态单一真相源，被 MCP server 与 Vite 状态 middleware 共享，保证两端看到同一份请求/结果。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

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
    return { ...emptyState(), ...parsed, paths };
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
  const profile = requestInput.profile || {};
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
    updatedAt: state.updatedAt,
    projectDir: state.paths.projectDir,
    stateDir: state.paths.stateDir,
    stateFile: state.paths.stateFile,
  };
}
