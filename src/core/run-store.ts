import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { RunRecord } from "./orchestrator.js";

const RUN_ID_PATTERN = /^forge-[a-z0-9-]{1,80}$/;

function validateRunId(id: string): void {
  if (!RUN_ID_PATTERN.test(id) || id.includes("..")) {
    throw new Error("Invalid FORGE run identifier.");
  }
}

function runsDirectory(projectPath: string): string {
  return path.join(path.resolve(projectPath), ".forge", "runs");
}

export async function saveRun(projectPath: string, run: RunRecord): Promise<string> {
  validateRunId(run.id);
  const directory = runsDirectory(projectPath);
  await mkdir(directory, { recursive: true });
  const destination = path.join(directory, `${run.id}.json`);
  const temporary = path.join(directory, `.${run.id}.${randomUUID()}.tmp`);
  const serialized = JSON.stringify(run, null, 2) + "\n";

  try {
    await writeFile(temporary, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  return destination;
}

export async function loadRun(projectPath: string, runId: string): Promise<RunRecord> {
  validateRunId(runId);
  const filePath = path.join(runsDirectory(projectPath), `${runId}.json`);
  const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
  if (!parsed || typeof parsed !== "object" || !("id" in parsed) || parsed.id !== runId || !("tasks" in parsed) || !Array.isArray(parsed.tasks)) {
    throw new Error("Stored run file has an invalid format.");
  }
  return parsed as RunRecord;
}

export async function listRuns(projectPath: string): Promise<RunRecord[]> {
  const directory = runsDirectory(projectPath);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }

  const runs: RunRecord[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const id = entry.name.slice(0, -5);
    if (!RUN_ID_PATTERN.test(id) || id.includes("..")) continue;
    try {
      runs.push(await loadRun(projectPath, id));
    } catch {
      // Ignore malformed records; callers can inspect the .forge/runs directory.
    }
  }
  return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function decideTaskApproval(
  projectPath: string,
  runId: string,
  taskId: string,
  decision: "approved" | "rejected",
  reviewer: string,
  reason?: string,
): Promise<RunRecord> {
  const run = await loadRun(projectPath, runId);
  const record = run.tasks.find(item => item.task.id === taskId);
  if (!record) throw new Error("Task not found in this run.");
  if (record.approval) throw new Error("This task already has an approval decision.");
  if (record.status !== "awaiting_approval") throw new Error("Only tasks awaiting approval can receive a decision.");
  const at = new Date().toISOString();
  const safeReviewer = reviewer.trim().slice(0, 80) || "local-user";
  const safeReason = reason?.trim().slice(0, 1000);
  record.approval = { decision, reviewer: safeReviewer, ...(safeReason ? { reason: safeReason } : {}), at };
  if (decision === "approved") {
    record.status = "pending";
    run.status = "pending";
  } else {
    record.status = "failed";
    record.error = safeReason || "Task rejected during human review.";
    run.status = "failed";
  }
  run.updatedAt = at;
  run.events.push({
    at, taskId, type: decision,
    message: decision === "approved"
      ? `Approved by ${safeReviewer}. Task is ready for an explicit subsequent run.`
      : `Rejected by ${safeReviewer}.${safeReason ? ` Reason: ${safeReason}` : ""}`,
  });
  await saveRun(projectPath, run);
  return run;
}
