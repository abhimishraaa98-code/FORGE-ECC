import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeBenchmarkMatrix, formatBenchmarkMatrix, saveBenchmarkMatrix, validateBenchmarkMatrix } from "../src/core/benchmark-matrix.js";

const config = {
  id: "model-comparison",
  name: "Model comparison",
  repeats: 2,
  candidates: [
    { id: "model-a", provider: "openai" as const, model: "model-a" },
    { id: "model-b", provider: "claude-code" as const, model: "model-b" },
  ],
};

describe("automated benchmark matrix", () => {
  it("validates candidate definitions and limits run volume", () => {
    expect(validateBenchmarkMatrix(config)).toEqual(config);
    expect(() => validateBenchmarkMatrix({ ...config, repeats: 4 })).toThrow(/between 1 and 3/);
    expect(() => validateBenchmarkMatrix({ ...config, candidates: [...config.candidates, { id: "c", provider: "openai", model: "c" }, { id: "d", provider: "openai", model: "d" }, { id: "e", provider: "openai", model: "e" }] })).toThrow(/between 2 and 4/);
    expect(() => validateBenchmarkMatrix({ ...config, candidates: [{ ...config.candidates[0] }, { ...config.candidates[0] }] })).toThrow(/unique/);
  });

  it("runs each candidate for each repeat and continues after an isolated failure", async () => {
    const calls: string[] = [];
    const report = await executeBenchmarkMatrix(config, async (candidate, repeat) => {
      calls.push(candidate.id + ":" + repeat);
      if (candidate.id === "model-b" && repeat === 1) throw new Error("temporary provider error");
      return { runId: candidate.id + "-" + repeat, score: candidate.id === "model-a" ? 80 + repeat : 90, passed: true, durationMs: 1000, estimatedTokens: 300 };
    });
    expect(calls).toEqual(["model-a:1", "model-a:2", "model-b:1", "model-b:2"]);
    expect(report.results).toHaveLength(4);
    expect(report.results[2]?.status).toBe("failed");
    expect(report.summary.find(item => item.candidateId === "model-a")?.averageScore).toBe(81.5);
    expect(report.summary.find(item => item.candidateId === "model-b")?.completed).toBe(1);
    expect(formatBenchmarkMatrix(report)).toContain("temporary provider error");
  });

  it("persists matrix reports inside the project's local FORGE state", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "forge-matrix-"));
    try {
      const report = await executeBenchmarkMatrix(config, async (candidate, repeat) => ({
        runId: candidate.id + "-" + repeat, score: 85, passed: true, durationMs: 100, estimatedTokens: 50,
      }));
      report.suiteId = "engineering-basics";
      report.goal = "Review the project architecture";
      const saved = await saveBenchmarkMatrix(root, report);
      const persisted = JSON.parse(await readFile(saved, "utf8"));
      expect(persisted.suiteId).toBe("engineering-basics");
      expect(persisted.results).toHaveLength(4);
      expect(saved).toContain(path.join(".forge", "benchmark-matrices"));
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
