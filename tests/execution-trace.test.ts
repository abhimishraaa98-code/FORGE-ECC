import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { saveExecutionTrace, loadExecutionTrace } from "../src/core/execution-trace.js";

describe("execution trace persistence", () => {
  let root = "";
  afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = ""; });
  it("persists per-agent metrics and aggregate totals", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-trace-"));
    const entries = [{ taskId: "a", agent: "planner", tier: "balanced" as const, model: "model-x", provider: "test", startedAt: new Date().toISOString(), durationMs: 125, outcome: "success" as const, inputTokensEstimate: 100, outputTokensEstimate: 40 }];
    const file = await saveExecutionTrace(root, "forge-test-run", entries);
    await saveExecutionTrace(root, "forge-test-run", [{ ...entries[0]!, taskId: "b", agent: "reviewer", inputTokensEstimate: 50, outputTokensEstimate: 20 }]);
    const disk = JSON.parse(await readFile(file, "utf8")) as { entries: unknown[] };
    expect(disk.entries).toHaveLength(2);
    const stored = await loadExecutionTrace(root, "forge-test-run");
    expect(stored.totals.estimatedInputTokens).toBe(150);
    expect(stored.totals.estimatedOutputTokens).toBe(60);
    expect(stored.entries).toHaveLength(2);
    expect(stored.entries[0]?.durationMs).toBe(125);
    expect(file).toContain(path.join(".forge", "traces"));
  });
  it("rejects invalid run identifiers", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-trace-"));
    await expect(loadExecutionTrace(root, "../escape")).rejects.toThrow("Invalid FORGE run identifier");
  });
});
