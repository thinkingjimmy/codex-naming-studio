/**
 * - [INPUT]: 依赖 child_process、真实临时目录与 naming-state 的构造/发布/释放/双提交环境故障注入点。
 * - [OUTPUT]: 验证 owner 构造失败清理、历史 owner/release 安全回收、目录/旧文件死锁接管与 state/trigger 自愈。
 * - [POS]: scripts 的崩溃一致性质量门禁；同文件兼任短生命周期故障子进程。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  readStateUnlocked,
  repairTriggerFile,
  saveNamingRequest,
} from "../mcp/lib/naming-state.mjs";

const script = fileURLToPath(import.meta.url);
const [mode, projectDir, requestId] = process.argv.slice(2);

if (mode === "--worker") {
  try {
    const saved = await saveNamingRequest(
      { projectDir },
      {
        id: requestId,
        source: "crash-probe",
        profile: { surname: "林", fullNameLength: 3 },
      }
    );
    console.log(JSON.stringify({
      requestId: saved.requestId,
      committed: saved.committed,
      triggerLagging: saved.triggerLagging,
    }));
  } catch (error) {
    console.error(`${error.code || "ERROR"}: ${error.message}`);
    process.exitCode = 2;
  }
} else {
  await runProbe();
}

async function runProbe() {
  const root = await mkdtemp(path.join(tmpdir(), "naming-crash-"));
  try {
    const failedWrite = path.join(root, "failed-owner-write");
    await mkdir(failedWrite);
    const ownerWriteFailure = await runChild(failedWrite, "failed-owner-write", {
      NAMING_FAIL_OWNER_WRITE: "1",
    });
    if (ownerWriteFailure.code === 0) {
      throw new Error("Owner write failure injection did not fail.");
    }
    await assertNoTransientLockResidues(failedWrite);

    const emptyOwner = path.join(root, "empty-owner");
    await mkdir(emptyOwner);
    const crashedEmptyOwner = await runChild(emptyOwner, "empty-owner", {
      NAMING_CRASH_AFTER_OWNER_MKDIR: "1",
    });
    if (crashedEmptyOwner.code === 0) {
      throw new Error("Owner mkdir crash injection did not exit.");
    }
    await saveNamingRequest(
      { projectDir: emptyOwner },
      { id: "empty-owner-takeover", profile: { surname: "林", fullNameLength: 3 } }
    );
    await assertNoTransientLockResidues(emptyOwner);

    const activeOwner = path.join(root, "active-owner");
    const activeStateDir = path.join(activeOwner, ".naming-product");
    await mkdir(activeStateDir, { recursive: true });
    const activeResidue = path.join(
      activeStateDir,
      `state.owner-${process.pid}-${crypto.randomUUID()}.tmp`
    );
    await mkdir(activeResidue);
    await saveNamingRequest(
      { projectDir: activeOwner },
      { id: "active-owner-preserved", profile: { surname: "林", fullNameLength: 3 } }
    );
    if (await singleTransientResidue(activeOwner, "state.owner-") !== activeResidue) {
      throw new Error("Live incomplete owner residue was not preserved fail-closed.");
    }
    await rm(activeResidue, { recursive: true, force: true });

    const legacyOwner = path.join(root, "legacy-owner-residue");
    const legacyResidueStateDir = path.join(legacyOwner, ".naming-product");
    await mkdir(legacyResidueStateDir, { recursive: true });
    const legacyResidue = path.join(
      legacyResidueStateDir,
      `state.owner-${crypto.randomUUID()}.tmp`
    );
    await mkdir(legacyResidue);
    await saveNamingRequest(
      { projectDir: legacyOwner },
      { id: "young-legacy-preserved", profile: { surname: "林", fullNameLength: 3 } }
    );
    if (await singleTransientResidue(legacyOwner, "state.owner-") !== legacyResidue) {
      throw new Error("Young legacy owner residue was not preserved fail-closed.");
    }
    const old = new Date(0);
    await utimes(legacyResidue, old, old);
    await saveNamingRequest(
      { projectDir: legacyOwner },
      { id: "legacy-owner-takeover", profile: { surname: "林", fullNameLength: 3 } }
    );
    await assertNoTransientLockResidues(legacyOwner);

    const completeOwner = path.join(root, "complete-owner");
    await mkdir(completeOwner);
    const crashedCompleteOwner = await runChild(completeOwner, "complete-owner", {
      NAMING_CRASH_AFTER_OWNER_WRITE: "1",
    });
    if (crashedCompleteOwner.code === 0) {
      throw new Error("Owner write crash injection did not exit.");
    }
    await saveNamingRequest(
      { projectDir: completeOwner },
      { id: "complete-owner-takeover", profile: { surname: "林", fullNameLength: 3 } }
    );
    await assertNoTransientLockResidues(completeOwner);

    const acquire = path.join(root, "acquire");
    await mkdir(acquire);
    const crashedAcquire = await runChild(acquire, "crash-acquire", {
      NAMING_CRASH_AFTER_ACQUIRE: "1",
    });
    if (crashedAcquire.code === 0) throw new Error("Acquire crash injection did not exit.");
    const ownerFile = path.join(
      acquire,
      ".naming-product",
      "state.lock",
      "owner.json"
    );
    const owner = JSON.parse(await readFile(ownerFile, "utf8"));
    if (!owner.pid || !owner.nonce || !owner.startedAt) {
      throw new Error("Crash-after-acquire lock owner is incomplete.");
    }
    const takeoverStarted = Date.now();
    await saveNamingRequest(
      { projectDir: acquire },
      { id: "takeover", profile: { surname: "林", fullNameLength: 3 } }
    );
    if (Date.now() - takeoverStarted >= 1_000) {
      throw new Error("Dead acquired lock was not reaped immediately.");
    }

    const legacy = path.join(root, "legacy-lock");
    const legacyStateDir = path.join(legacy, ".naming-product");
    await mkdir(legacyStateDir, { recursive: true });
    await writeFile(
      path.join(legacyStateDir, "state.lock"),
      `${JSON.stringify(owner)}\n`
    );
    await saveNamingRequest(
      { projectDir: legacy },
      { id: "legacy-takeover", profile: { surname: "林", fullNameLength: 3 } }
    );
    const legacyState = await readStateUnlocked({ projectDir: legacy });
    if (!legacyState.requests["legacy-takeover"]) {
      throw new Error("Legacy file lock was not migrated through a generation fence.");
    }

    const released = path.join(root, "released");
    await mkdir(released);
    const crashedRelease = await runChild(released, "release-crash", {
      NAMING_CRASH_AFTER_RELEASE_RENAME: "1",
    });
    if (crashedRelease.code === 0) {
      throw new Error("Release rename crash injection did not exit.");
    }
    await singleTransientResidue(released, "state.release-");
    await saveNamingRequest(
      { projectDir: released },
      { id: "release-takeover", profile: { surname: "林", fullNameLength: 3 } }
    );
    await assertNoTransientLockResidues(released);

    const between = path.join(root, "between");
    await mkdir(between);
    const crashedBetween = await runChild(between, "between-commits", {
      NAMING_CRASH_BETWEEN_COMMITS: "1",
    });
    if (crashedBetween.code === 0) throw new Error("Between-commits crash injection did not exit.");
    const stateAfterCrash = await readStateUnlocked({ projectDir: between });
    if (!stateAfterCrash.requests["between-commits"] || stateAfterCrash.triggerRevision !== 1) {
      throw new Error("State commit must survive crash before trigger commit.");
    }
    await repairTriggerFile({ projectDir: between });
    await assertTriggerMatchesState(between);

    const lagging = path.join(root, "lagging");
    await mkdir(lagging);
    const failedTrigger = await runChild(lagging, "lagging-request", {
      NAMING_FAIL_TRIGGER_RENAME: "3",
    });
    if (failedTrigger.code !== 0) {
      throw new Error(`Finite trigger failure worker failed: ${failedTrigger.stderr}`);
    }
    const response = JSON.parse(failedTrigger.stdout.trim().split("\n").at(-1));
    if (response.committed !== true || response.triggerLagging !== true) {
      throw new Error(`Partial success contract missing: ${failedTrigger.stdout}`);
    }
    // 子进程没有做任何读取；它能退出说明 referenced 后台重试已经补投并收敛。
    await assertTriggerMatchesState(lagging);

    console.log("OK: lock residue recovery, crash recovery, and trigger repair are sound.");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function singleTransientResidue(project, prefix) {
  const stateDir = path.join(project, ".naming-product");
  const entries = await readdir(stateDir);
  const matches = entries.filter((entry) => entry.startsWith(prefix));
  if (matches.length !== 1) {
    throw new Error(`Expected one ${prefix} residue, found: ${entries.join(", ")}`);
  }
  return path.join(stateDir, matches[0]);
}

async function assertNoTransientLockResidues(project) {
  const stateDir = path.join(project, ".naming-product");
  let entries;
  try {
    entries = await readdir(stateDir);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  const residues = entries.filter((entry) =>
    ["state.owner-", "state.release-", "state.garbage-"].some((prefix) =>
      entry.startsWith(prefix)
    )
  );
  if (residues.length) {
    throw new Error(`Transient lock residues were not reclaimed: ${residues.join(", ")}`);
  }
}

function runChild(project, id, extraEnv) {
  const child = spawn(process.execPath, [script, "--worker", project, id], {
    cwd: path.dirname(script),
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  return new Promise((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) =>
      resolvePromise({ code, signal, stdout, stderr })
    );
  });
}

async function assertTriggerMatchesState(project) {
  const state = JSON.parse(
    await readFile(path.join(project, ".naming-product", "state.json"), "utf8")
  );
  const trigger = JSON.parse(
    await readFile(path.join(project, ".naming-product", "trigger.json"), "utf8")
  );
  if (trigger.triggerRevision !== state.triggerRevision) {
    throw new Error(
      `Trigger revision ${trigger.triggerRevision} lags state ${state.triggerRevision}.`
    );
  }
}
