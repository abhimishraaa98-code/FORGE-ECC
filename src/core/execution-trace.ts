import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AgentTrace } from "./model-router.js";

export interface ExecutionTraceDocument {
  version: 1;
  runId: string;
  createdAt: string;
  entries: AgentTrace[];
  totals: { tasks: number; successes: number; fallbacks: number; failures: number; estimatedInputTokens: number; estimatedOutputTokens: number; durationMs: number };
}

export async function saveExecutionTrace(projectPath: string, runId: string, entries: readonly AgentTrace[]): Promise<string> {
  if (!/^forge-[a-z0-9-]{1,80}$/.test(runId) || runId.includes("..")) throw new Error("Invalid FORGE run identifier.");
  const directory = path.join(path.resolve(projectPath), ".forge", "traces");
  await mkdir(directory, { recursive: true });
  const totals = {
    tasks: entries.length,
    successes: entries.filter(entry => entry.outcome === "success").length,
    fallbacks: entries.filter(entry => entry.outcome === "fallback").length,
    failures: entries.filter(entry => entry.outcome === "failed").length,
    estimatedInputTokens: entries.reduce((sum, entry) => sum + entry.inputTokensEstimate, 0),
    estimatedOutputTokens: entries.reduce((sum, entry) => sum + entry.outputTokensEstimate, 0),
    durationMs: entries.reduce((sum, entry) => sum + entry.durationMs, 0),
  };
  const document: ExecutionTraceDocument = { version: 1, runId, createdAt: new Date().toISOString(), entries: [...entries], totals };
  const destination = path.join(directory, runId + ".json");
  let priorEntries: AgentTrace[] = [];
  let createdAt = document.createdAt;
  try {
    const previous = JSON.parse(await readFile(destination, "utf8")) as Partial<ExecutionTraceDocument>;
    if (previous.version !== 1 || previous.runId !== runId || !Array.isArray(previous.entries)) throw new Error("Existing execution trace has an invalid format.");
    priorEntries = previous.entries;
    if (typeof previous.createdAt === "string") createdAt = previous.createdAt;
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }
  const combined = [...priorEntries, ...entries];
  const mergedTotals = {
    tasks: combined.length,
    successes: combined.filter(entry => entry.outcome === "success").length,
    fallbacks: combined.filter(entry => entry.outcome === "fallback").length,
    failures: combined.filter(entry => entry.outcome === "failed").length,
    estimatedInputTokens: combined.reduce((sum, entry) => sum + entry.inputTokensEstimate, 0),
    estimatedOutputTokens: combined.reduce((sum, entry) => sum + entry.outputTokensEstimate, 0),
    durationMs: combined.reduce((sum, entry) => sum + entry.durationMs, 0),
  };
  const mergedDocument: ExecutionTraceDocument = { version: 1, runId, createdAt, entries: combined, totals: mergedTotals };
  const temporary = path.join(directory, "." + randomUUID() + ".tmp");
  try {
    await writeFile(temporary, JSON.stringify(mergedDocument, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  return destination;
}

export async function loadExecutionTrace(projectPath: string, runId: string): Promise<ExecutionTraceDocument> {
  if (!/^forge-[a-z0-9-]{1,80}$/.test(runId) || runId.includes("..")) throw new Error("Invalid FORGE run identifier.");
  const file = path.join(path.resolve(projectPath), ".forge", "traces", runId + ".json");
  const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
  if (!parsed || typeof parsed !== "object" || !("runId" in parsed) || parsed.runId !== runId || !("entries" in parsed) || !Array.isArray(parsed.entries)) throw new Error("Stored execution trace has an invalid format.");
  return parsed as ExecutionTraceDocument;
}
