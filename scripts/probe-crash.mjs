/**
 * - [INPUT]: 依赖 child_process、真实临时目录与 naming-state 的三种环境故障注入点。
 * - [OUTPUT]: 验证目录/旧文件锁崩溃可由代际 fence 接管、state/trigger 中断可修复、trigger 部分成功会在零读取下后台补投。
 * - [POS]: scripts 的崩溃一致性质量门禁；同文件兼任短生命周期故障子进程。
 * - [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
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

    console.log("OK: crash recovery and zero-read background trigger repair are sound.");
  } finally {
    await rm(root, { recursive: true, force: true });
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
