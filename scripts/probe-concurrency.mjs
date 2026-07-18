/**
 * - [INPUT]: 依赖 child_process、真实临时目录与 naming-state 的 link/rename 锁、request/claim mutation API。
 * - [OUTPUT]: 四幕并发探针：双接管、SIGSTOP fail-safe、ABA 恢复、双 claim 栅栏，并验证四进程交错守恒。
 * - [POS]: scripts 的代际 CAS 质量门禁；同文件兼任隔离子进程 worker，避免新增测试专用模块。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  claimNamingRequest,
  readStateUnlocked,
  saveNamingRequest,
  saveNamingResult,
  withStateLock,
} from "../mcp/lib/naming-state.mjs";

const script = fileURLToPath(import.meta.url);
const [mode, projectDir, ...workerArgs] = process.argv.slice(2);

if (mode === "--worker") {
  await runWorker(projectDir, ...workerArgs);
} else {
  await runProbe();
}

async function runProbe() {
  const root = await mkdtemp(path.join(tmpdir(), "naming-concurrency-"));
  try {
    const interleaved = path.join(root, "interleaved");
    await mkdir(interleaved);
    const writers = Array.from({ length: 4 }, (_, index) =>
      child(["save", `parallel-${index}`], interleaved)
    );
    const writerResults = await Promise.all(writers.map(waitChild));
    writerResults.forEach(assertSuccess);
    const interleavedState = await readStateUnlocked({ projectDir: interleaved });
    if (Object.keys(interleavedState.requests).length !== 4) {
      throw new Error("Four-process interleave lost a request.");
    }
    if (interleavedState.triggerRevision !== 4) {
      throw new Error(`Revision conservation failed: ${interleavedState.triggerRevision}.`);
    }
    assertLegalStatuses(interleavedState);
    await assertNoLockResidue(interleaved);

    // 第一幕：获取后崩溃留下完整 owner；两个接管者竞争，只有一个收割该 inode。
    const takeover = path.join(root, "takeover");
    await mkdir(takeover);
    const crashed = await waitChild(
      child(["save", "crash-owner"], takeover, {
        NAMING_CRASH_AFTER_ACQUIRE: "1",
      })
    );
    if (crashed.code === 0) throw new Error("Crash-after-acquire worker unexpectedly succeeded.");
    const owner = JSON.parse(
      await readFile(path.join(takeover, ".naming-product", "state.lock"), "utf8")
    );
    if (!owner.pid || !owner.nonce || !owner.startedAt) {
      throw new Error("Published lock must contain a complete owner.");
    }
    const contenders = await Promise.all([
      waitChild(child(["save", "takeover-a"], takeover)),
      waitChild(child(["save", "takeover-b"], takeover)),
    ]);
    contenders.forEach(assertSuccess);
    const reaps = contenders
      .map((result) => result.stderr)
      .join("\n")
      .match(/reaped dead lock/g)?.length || 0;
    if (reaps !== 1) throw new Error(`Exactly one dead-lock reap expected, got ${reaps}.`);
    await assertNoLockResidue(takeover);

    // 第二幕：活持有者 SIGSTOP 仍被 kill(pid,0) 视为活；竞争写入 5s 明确超时。
    const stopped = path.join(root, "stopped");
    await mkdir(stopped);
    const ready = path.join(root, "stopped.ready");
    const release = path.join(root, "stopped.release");
    const holder = child(["hold", ready, release], stopped);
    await waitForFile(ready);
    process.kill(holder.pid, "SIGSTOP");
    const blocked = await waitChild(child(["save", "blocked"], stopped));
    if (blocked.code === 0 || !blocked.stderr.includes("LOCK_TIMEOUT")) {
      throw new Error(`SIGSTOP holder must cause explicit timeout: ${blocked.stderr}`);
    }
    process.kill(holder.pid, "SIGCONT");
    await writeFile(release, "release\n");
    assertSuccess(await waitChild(holder));
    assertSuccess(await waitChild(child(["save", "after-resume"], stopped)));
    await assertNoLockResidue(stopped);

    // 第三幕：接管者验尸后暂停；锁路径换成活 owner，rename 后审视并恢复活锁。
    const aba = path.join(root, "aba");
    await mkdir(aba);
    await waitChild(
      child(["save", "dead-generation"], aba, {
        NAMING_CRASH_AFTER_ACQUIRE: "1",
      })
    );
    const reapReady = path.join(root, "reap.ready");
    const reapContinue = path.join(root, "reap.continue");
    const reaper = child(["save", "reaper"], aba, {
      NAMING_REAP_READY_FILE: reapReady,
      NAMING_REAP_CONTINUE_FILE: reapContinue,
    });
    await waitForFile(reapReady);
    await unlink(path.join(aba, ".naming-product", "state.lock"));
    const liveReady = path.join(root, "live.ready");
    const liveRelease = path.join(root, "live.release");
    const live = child(["hold", liveReady, liveRelease], aba);
    await waitForFile(liveReady);
    await writeFile(reapContinue, "continue\n");
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    await writeFile(liveRelease, "release\n");
    assertSuccess(await waitChild(live));
    const reaperResult = await waitChild(reaper);
    assertSuccess(reaperResult);
    if (!reaperResult.stderr.includes("ABA detected; restored live lock")) {
      throw new Error(`ABA restore path not observed: ${reaperResult.stderr}`);
    }
    await assertNoLockResidue(aba);

    // 第四幕：后 claim 覆盖 claimOwner，旧 claimId 拒绝，恰一份结果提交。
    const claims = path.join(root, "claims");
    await mkdir(claims);
    await saveNamingRequest({ projectDir: claims }, {
      id: "claim-target",
      profile: { surname: "林", fullNameLength: 3 },
    });
    const first = await claimNamingRequest({ projectDir: claims }, "claim-target");
    const second = await claimNamingRequest({ projectDir: claims }, "claim-target");
    if (first.claimId === second.claimId) throw new Error("Re-claim must rotate claimId.");
    await assertRejectCode(
      saveNamingResult(
        { projectDir: claims },
        resultInput("claim-target", first.claimId, "旧结果")
      ),
      "CLAIM_MISMATCH"
    );
    await saveNamingResult(
      { projectDir: claims },
      resultInput("claim-target", second.claimId, "景和")
    );
    const claimState = await readStateUnlocked({ projectDir: claims });
    if (
      claimState.requests["claim-target"].status !== "completed" ||
      claimState.requests["claim-target"].result.candidates.length !== 1
    ) {
      throw new Error("Exactly one fenced result must reach terminal state.");
    }
    await assertNoLockResidue(claims);

    console.log("OK: concurrency lock generations, ABA recovery, and claim fencing are sound.");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function runWorker(workerProjectDir, action, ...args) {
  try {
    if (action === "save") {
      const id = args[0];
      const result = await saveNamingRequest(
        { projectDir: workerProjectDir },
        { id, profile: { surname: "林", fullNameLength: 3 }, source: "probe" }
      );
      console.log(JSON.stringify({ committed: result.committed, triggerLagging: result.triggerLagging }));
      return;
    }
    if (action === "hold") {
      const [ready, release] = args;
      await withStateLock({ projectDir: workerProjectDir }, async ({ owner, paths }) => {
        await writeFile(ready, "ready\n");
        await waitForFile(release, 15_000);
        const current = JSON.parse(await readFile(paths.lockFile, "utf8"));
        if (current.nonce !== owner.nonce) {
          throw Object.assign(new Error("LOCK_FENCE_LOST in holder"), { code: "LOCK_FENCE_LOST" });
        }
      });
      console.log("held-and-released");
      return;
    }
    throw new Error(`Unknown worker action: ${action}`);
  } catch (error) {
    console.error(`${error.code || "ERROR"}: ${error.message}`);
    process.exitCode = 2;
  }
}

function child(args, cwd, extraEnv = {}) {
  return spawn(process.execPath, [script, "--worker", cwd, ...args], {
    cwd: path.dirname(script),
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function waitChild(childProcess) {
  let stdout = "";
  let stderr = "";
  childProcess.stdout.on("data", (chunk) => { stdout += chunk; });
  childProcess.stderr.on("data", (chunk) => { stderr += chunk; });
  return new Promise((resolvePromise, reject) => {
    childProcess.once("error", reject);
    childProcess.once("close", (code, signal) =>
      resolvePromise({ code, signal, stdout, stderr })
    );
  });
}

function assertSuccess(result) {
  if (result.code !== 0) {
    throw new Error(`Child failed code=${result.code} signal=${result.signal}: ${result.stderr}`);
  }
}

async function waitForFile(file, timeout = 2_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      await readFile(file);
      return;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
  }
  throw new Error(`Timed out waiting for ${file}.`);
}

async function assertNoLockResidue(projectDir) {
  const stateDir = path.join(projectDir, ".naming-product");
  const names = await readdir(stateDir).catch(() => []);
  const residue = names.filter(
    (name) => name === "state.lock" || name.startsWith("state.reap-") || name.startsWith("owner-")
  );
  if (residue.length) throw new Error(`Lock residue remains: ${residue.join(", ")}`);
}

function assertLegalStatuses(state) {
  const legal = new Set(["pending", "processing", "completed", "error", "superseded"]);
  for (const request of Object.values(state.requests)) {
    if (!legal.has(request.status)) throw new Error(`Illegal request status: ${request.status}`);
  }
}

async function assertRejectCode(promise, code) {
  try {
    await promise;
  } catch (error) {
    if (error.code === code) return;
    throw error;
  }
  throw new Error(`Expected rejection code ${code}.`);
}

function resultInput(requestId, claimId, given) {
  return {
    requestId,
    claimId,
    result: { candidates: [{ given, score: 94 }] },
  };
}
