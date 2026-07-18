/**
 * - [INPUT]: 依赖 node:fs/promises、node:path/crypto，读取用户项目状态并依赖 name-engine/task-plan 归一化业务数据。
 * - [OUTPUT]: 提供纯读 readStateUnlocked/publicState、link+rename 代际锁、显式 trigger 修复、请求保存/认领/claimId 栅栏结果提交。
 * - [POS]: mcp/lib 的并发状态单一真相源；所有 mutation 串行且提交前验 nonce，读操作绝不写文件或触发 Agent。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import crypto from "node:crypto";
import {
  link,
  mkdir,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  mergeProfile,
  normalizeCandidates,
  normalizeProfile,
} from "../../src/lib/name-engine.js";
import { buildTaskPlan } from "../../src/lib/task-plan.js";

const LOCK_RETRY_MS = 25;
const LOCK_TIMEOUT_MS = 5_000;
const TRIGGER_RETRY_MIN_MS = 50;
const TRIGGER_RETRY_MAX_MS = 5_000;
const triggerRepairs = new Map();
let triggerRenameFailures = parseFailureCount(
  process.env.NAMING_FAIL_TRIGGER_RENAME
);

export class NamingStateError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "NamingStateError";
    this.code = code;
  }
}

export function nonEmpty(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function resolveNamingPaths(args = {}) {
  const projectDir = path.resolve(nonEmpty(args.projectDir) || process.cwd());
  const stateDir = path.resolve(
    nonEmpty(args.stateDir) || path.join(projectDir, ".naming-product")
  );
  return {
    projectDir,
    stateDir,
    stateFile: path.join(stateDir, "state.json"),
    triggerFile: path.join(stateDir, "trigger.json"),
    lockFile: path.join(stateDir, "state.lock"),
  };
}

export function emptyState() {
  return {
    version: 1,
    triggerRevision: 0,
    requests: {},
    latestRequestId: null,
    latestResultId: null,
    updatedAt: null,
  };
}

// ============================================================================
// 纯读边界：这里是唯一状态读实现。缺失返回空状态，不修复 trigger、不加锁。
// ============================================================================
export async function readStateUnlocked(args = {}) {
  const paths = resolveNamingPaths(args);
  try {
    const parsed = JSON.parse(await readFile(paths.stateFile, "utf8"));
    return normalizeStoredState({ ...emptyState(), ...parsed, paths });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { ...emptyState(), paths };
  }
}

export function latestPendingRequest(state = {}) {
  return latestRequestWithStatuses(state, new Set(["pending"]));
}

export function latestActiveRequest(state = {}) {
  return latestRequestWithStatuses(state, new Set(["pending", "processing"]));
}

export function publicState(state) {
  const latestRequest = state.latestRequestId
    ? state.requests[state.latestRequestId] || null
    : null;
  const latestResult = state.latestResultId
    ? state.requests[state.latestResultId]?.result || null
    : null;
  return {
    version: state.version,
    triggerRevision: state.triggerRevision,
    requests: state.requests,
    latestRequestId: state.latestRequestId,
    latestResultId: state.latestResultId,
    latestRequest,
    latestResult,
    latestPendingRequest: latestPendingRequest(state),
    latestActiveRequest: latestActiveRequest(state),
    updatedAt: state.updatedAt,
    projectDir: state.paths.projectDir,
    stateDir: state.paths.stateDir,
    stateFile: state.paths.stateFile,
    triggerFile: state.paths.triggerFile,
  };
}

// ============================================================================
// mutation API：入口先建 stateDir、获取代际锁、修复落后 trigger，再提交业务状态。
// ============================================================================
export async function saveNamingRequest(args, requestInput = {}) {
  const id = nonEmpty(requestInput.id);
  if (!id) throw new NamingStateError("INVALID_REQUEST", "request.id is required.");
  const outcome = await withStateLock(args, async ({ owner, paths }) => {
    const state = await readStateUnlocked(args);
    const now = new Date().toISOString();
    const profile = normalizeProfile(requestInput.profile || {});
    supersedeOtherActiveRequests(state, id, now);
    state.requests[id] = {
      id,
      profile,
      plan: buildTaskPlan(profile),
      batch: Number.isFinite(requestInput.batch) ? requestInput.batch : 0,
      source: nonEmpty(requestInput.source) || "gui",
      status: "pending",
      claimOwner: null,
      createdAt: state.requests[id]?.createdAt || now,
      updatedAt: now,
      result: null,
      error: null,
    };
    state.latestRequestId = id;
    state.triggerRevision = (state.triggerRevision || 0) + 1;
    const saved = await writeStateUnlocked(state, paths, owner);

    if (process.env.NAMING_CRASH_BETWEEN_COMMITS === "1") {
      process.exit(92);
    }
    let triggerLagging = false;
    try {
      await writeTriggerUnlocked(saved, paths, owner);
    } catch (error) {
      triggerLagging = true;
      console.error(
        `[naming-state] trigger commit lagging revision=${saved.triggerRevision}: ${error.message}`
      );
    }
    return { requestId: id, committed: true, triggerLagging, state: saved };
  });
  if (outcome.triggerLagging) scheduleTriggerRepair(args);
  return outcome;
}

export async function claimNamingRequest(args, requestId = "") {
  return withStateLock(args, async ({ owner, paths }) => {
    const state = await readStateUnlocked(args);
    const requested = nonEmpty(requestId);
    const request = requested
      ? state.requests[requested]
      : latestActiveRequest(state);
    if (!request) {
      throw new NamingStateError(
        "REQUEST_NOT_FOUND",
        requested
          ? `Unknown Naming Product request: ${requested}`
          : "No active Naming Product request."
      );
    }
    if (request.status !== "pending" && request.status !== "processing") {
      throw new NamingStateError(
        "REQUEST_NOT_ACTIVE",
        `Naming Product request is not active: ${request.id}`
      );
    }
    const now = new Date().toISOString();
    const claimId = crypto.randomUUID();
    state.requests[request.id] = {
      ...request,
      status: "processing",
      claimOwner: { claimId, pid: process.pid, claimedAt: now },
      updatedAt: now,
    };
    const saved = await writeStateUnlocked(state, paths, owner);
    return { claimId, request: saved.requests[request.id], state: saved };
  });
}

export async function saveNamingResult(args, input = {}) {
  return withStateLock(args, async ({ owner, paths }) => {
    const state = await readStateUnlocked(args);
    const requestId = nonEmpty(input.requestId);
    const claimId = nonEmpty(input.claimId);
    const request = state.requests[requestId];
    if (!request) {
      throw new NamingStateError(
        "REQUEST_NOT_FOUND",
        `Unknown Naming Product request: ${requestId}`
      );
    }
    if (request.status === "superseded") {
      throw new NamingStateError(
        "REQUEST_SUPERSEDED",
        `Naming Product request was superseded: ${requestId}`
      );
    }
    if (request.status !== "processing") {
      throw new NamingStateError(
        "REQUEST_NOT_ACTIVE",
        `Naming Product request is not processing: ${requestId}`
      );
    }
    if (!claimId || request.claimOwner?.claimId !== claimId) {
      throw new NamingStateError(
        "CLAIM_MISMATCH",
        `Naming Product claimId was rejected for ${requestId}; reload state and abandon this result.`
      );
    }

    const now = new Date().toISOString();
    const result = input.result || {};
    const profile = normalizeProfile(
      mergeProfile(request.profile || {}, result.profile || {})
    );
    const batch = Number.isFinite(result.batch)
      ? result.batch
      : request.batch || 0;
    const explicitError = nonEmpty(result.error);
    const candidates = Array.isArray(result.candidates)
      ? normalizeCandidates(result.candidates, profile, batch)
      : [];
    const error =
      explicitError ||
      (candidates.length === 0
        ? "Codex did not return any naming candidates."
        : "");

    state.requests[requestId] = {
      ...request,
      profile,
      batch,
      status: error ? "error" : "completed",
      claimOwner: request.claimOwner,
      updatedAt: now,
      error: error || null,
      result: error
        ? null
        : {
            provider: nonEmpty(result.provider) || "codex",
            model: nonEmpty(result.model) || "Codex",
            notice:
              nonEmpty(result.notice) ||
              "Codex 已完成命名测算，结果已回写到工作台。",
            candidates,
            profile,
            batch,
            completedAt: now,
          },
    };
    if (!error) state.latestResultId = requestId;
    const saved = await writeStateUnlocked(state, paths, owner);
    return { request: saved.requests[requestId], state: saved };
  });
}

export async function repairTriggerFile(args = {}) {
  return withStateLock(
    args,
    async ({ owner, paths }) => repairTriggerUnlocked(args, paths, owner),
    { repairFirst: false }
  );
}

// ============================================================================
// link 原子发布 + rename-审视-恢复：锁可见即含完整 owner；接管检查的就是
// 被移到私有 reap 路径的 inode。每次数据 rename 前再次校验 nonce。
// ============================================================================
export async function withStateLock(
  args,
  mutation,
  { repairFirst = true } = {}
) {
  const paths = resolveNamingPaths(args);
  await mkdir(paths.stateDir, { recursive: true });
  const owner = await acquireStateLock(paths);
  try {
    if (repairFirst) await repairTriggerUnlocked(args, paths, owner);
    return await mutation({ owner, paths });
  } finally {
    await releaseStateLock(paths, owner);
  }
}

async function acquireStateLock(paths) {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const owner = {
      pid: process.pid,
      nonce: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
    };
    const ownerFile = path.join(paths.stateDir, `owner-${owner.nonce}.tmp`);
    await writeFile(ownerFile, `${JSON.stringify(owner)}\n`, { flag: "wx" });
    try {
      await link(ownerFile, paths.lockFile);
      await unlink(ownerFile);
      if (process.env.NAMING_CRASH_AFTER_ACQUIRE === "1") process.exit(93);
      return owner;
    } catch (error) {
      await rm(ownerFile, { force: true });
      if (error.code !== "EEXIST") throw error;
    }
    await reapDeadLock(paths);
    await delay(LOCK_RETRY_MS);
  }
  throw new NamingStateError(
    "LOCK_TIMEOUT",
    `Naming state lock timed out after ${LOCK_TIMEOUT_MS}ms.`
  );
}

async function reapDeadLock(paths) {
  let observed;
  try {
    observed = await readOwner(paths.lockFile);
  } catch (error) {
    if (error.code === "ENOENT") return;
    return;
  }
  if (isProcessAlive(observed.pid)) return;
  await pauseBeforeReapForProbe();

  const reapFile = path.join(paths.stateDir, `state.reap-${crypto.randomUUID()}`);
  try {
    await rename(paths.lockFile, reapFile);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  let reaped;
  try {
    reaped = await readOwner(reapFile);
  } catch (error) {
    console.error(`[naming-state] invalid private reap file kept: ${reapFile}`);
    return;
  }
  if (!isProcessAlive(reaped.pid)) {
    await unlink(reapFile);
    console.error(
      `[naming-state] reaped dead lock pid=${reaped.pid} nonce=${reaped.nonce}`
    );
    return;
  }

  try {
    await rename(reapFile, paths.lockFile);
    console.error(
      `[naming-state] ABA detected; restored live lock pid=${reaped.pid} nonce=${reaped.nonce}`
    );
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    console.error(
      `[naming-state] ABA restore conflict; kept ${reapFile}; live owner will fail its nonce fence`
    );
  }
}

async function assertLockOwner(paths, owner) {
  let current;
  try {
    current = await readOwner(paths.lockFile);
  } catch (error) {
    throw new NamingStateError(
      "LOCK_FENCE_LOST",
      "Naming state lock disappeared before commit.",
      { cause: error }
    );
  }
  if (current.nonce !== owner.nonce) {
    throw new NamingStateError(
      "LOCK_FENCE_LOST",
      "Naming state lock generation changed before commit."
    );
  }
}

async function releaseStateLock(paths, owner) {
  try {
    const current = await readOwner(paths.lockFile);
    if (current.nonce !== owner.nonce) return;
    await unlink(paths.lockFile);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function writeStateUnlocked(state, paths, owner) {
  const payload = {
    version: 1,
    triggerRevision: state.triggerRevision || 0,
    requests: state.requests || {},
    latestRequestId: state.latestRequestId || null,
    latestResultId: state.latestResultId || null,
    updatedAt: new Date().toISOString(),
  };
  await atomicJsonCommit(paths.stateFile, payload, paths, owner, "state");
  return normalizeStoredState({ ...payload, paths });
}

async function writeTriggerUnlocked(state, paths, owner) {
  const request = state.latestRequestId
    ? state.requests[state.latestRequestId]
    : null;
  const payload = {
    version: 1,
    triggerRevision: state.triggerRevision || 0,
    requestId: request?.id || null,
    updatedAt: state.updatedAt || new Date().toISOString(),
  };
  await atomicJsonCommit(paths.triggerFile, payload, paths, owner, "trigger");
}

async function atomicJsonCommit(file, payload, paths, owner, kind) {
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temp, `${JSON.stringify(payload, null, 2)}\n`);
    await assertLockOwner(paths, owner);
    if (kind === "trigger" && triggerRenameFailures > 0) {
      triggerRenameFailures -= 1;
      throw new NamingStateError(
        "TRIGGER_RENAME_INJECTED",
        "Injected trigger rename failure."
      );
    }
    await rename(temp, file);
  } finally {
    await rm(temp, { force: true });
  }
}

async function repairTriggerUnlocked(args, paths, owner) {
  const state = await readStateUnlocked(args);
  if (!state.triggerRevision) return { repaired: false, state };
  const currentRevision = await readTriggerRevision(paths.triggerFile);
  if (currentRevision >= state.triggerRevision) {
    return { repaired: false, state };
  }
  await writeTriggerUnlocked(state, paths, owner);
  return { repaired: true, state };
}

function scheduleTriggerRepair(args) {
  const paths = resolveNamingPaths(args);
  if (triggerRepairs.has(paths.triggerFile)) return;
  const task = (async () => {
    let waitMs = TRIGGER_RETRY_MIN_MS;
    while (true) {
      await delay(waitMs);
      try {
        await repairTriggerFile(args);
        return;
      } catch (error) {
        console.error(
          `[naming-state] background trigger repair failed: ${error.message}`
        );
        waitMs = Math.min(TRIGGER_RETRY_MAX_MS, waitMs * 2);
      }
    }
  })().finally(() => triggerRepairs.delete(paths.triggerFile));
  triggerRepairs.set(paths.triggerFile, task);
}

function normalizeStoredState(state) {
  const requests = {};
  for (const [id, request] of Object.entries(state.requests || {})) {
    requests[id] = normalizeStoredRequest(request);
  }
  return { ...state, triggerRevision: state.triggerRevision || 0, requests };
}

function normalizeStoredRequest(request) {
  if (!request || typeof request !== "object") return request;
  const profile = normalizeProfile(request.profile || {});
  const result =
    request.result && typeof request.result === "object"
      ? {
          ...request.result,
          profile: normalizeProfile(
            mergeProfile(profile, request.result.profile || {})
          ),
        }
      : request.result;
  return {
    ...request,
    claimOwner: request.claimOwner || null,
    profile,
    plan: buildTaskPlan(profile),
    result,
  };
}

function latestRequestWithStatuses(state, statuses) {
  const latest = state.latestRequestId
    ? state.requests?.[state.latestRequestId]
    : null;
  if (statuses.has(latest?.status)) return latest;
  const candidates = Object.values(state.requests || {}).filter((request) =>
    statuses.has(request?.status)
  );
  return candidates.sort(compareRequestTime).at(-1) || null;
}

function supersedeOtherActiveRequests(state, activeId, updatedAt) {
  for (const [id, request] of Object.entries(state.requests || {})) {
    if (
      id === activeId ||
      (request?.status !== "pending" && request?.status !== "processing")
    ) {
      continue;
    }
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

async function readTriggerRevision(file) {
  try {
    const trigger = JSON.parse(await readFile(file, "utf8"));
    return Number.isSafeInteger(trigger.triggerRevision)
      ? trigger.triggerRevision
      : 0;
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return 0;
    throw error;
  }
}

async function readOwner(file) {
  const owner = JSON.parse(await readFile(file, "utf8"));
  if (
    !Number.isSafeInteger(owner.pid) ||
    owner.pid <= 0 ||
    !nonEmpty(owner.nonce) ||
    !nonEmpty(owner.startedAt)
  ) {
    throw new NamingStateError("INVALID_LOCK_OWNER", "Invalid lock owner.");
  }
  return owner;
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    return true;
  }
}

async function pauseBeforeReapForProbe() {
  const ready = nonEmpty(process.env.NAMING_REAP_READY_FILE);
  const proceed = nonEmpty(process.env.NAMING_REAP_CONTINUE_FILE);
  if (!ready || !proceed) return;
  await writeFile(ready, "ready\n");
  while (true) {
    try {
      await readFile(proceed);
      return;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await delay(10);
  }
}

function parseFailureCount(value) {
  const count = Number(value || 0);
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}
