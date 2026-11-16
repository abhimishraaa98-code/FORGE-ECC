import { describe, expect, it } from "vitest";
import { buildAgentEvaluationIntelligence, formatAgentEvaluationIntelligence } from "../src/core/agent-evaluation-intelligence.js";
import type { BenchmarkMatrixReport } from "../src/core/benchmark-matrix.js";

function report(createdAt: string, score: number, failedCriteria: string[] = []): BenchmarkMatrixReport {
  return {
    version: 1, matrixId: "matrix-a", matrixName: "Matrix", suiteId: "suite-a", goal: "review changes", createdAt,
    results: [{ candidateId: "candidate-a", provider: "openai", model: "model-a", repeat: 1, runId: "run-a", score, passed: score >= 80, durationMs: 1000, estimatedTokens: 500, status: "completed",
      agentScores: [{ agent: "code-reviewer", caseId: "case-security", score, passed: score >= 80, skillIds: ["secure-changes"], failedCriteria: failedCriteria.map(id => ({ id, failedChecks: ["missed a security boundary"] })) }]
    }],
    summary: [{ candidateId: "candidate-a", provider: "openai", model: "model-a", trials: 1, completed: 1, averageScore: score, passRate: score >= 80 ? 100 : 0, scoreStdDev: 0, averageDurationMs: 1000, averageEstimatedTokens: 500 }],
    agentSummary: [{ candidateId: "candidate-a", provider: "openai", model: "model-a", agent: "code-reviewer", trials: 1, completed: 1, averageScore: score, passRate: score >= 80 ? 100 : 0, skillsObserved: ["secure-changes"] }]
  };
}

describe("agent evaluation intelligence", () => {
  it("builds scorecards, trends and repeated criterion signals", () => {
    const result = buildAgentEvaluationIntelligence([report("2026-01-01T00:00:00.000Z", 90), report("2026-01-02T00:00:00.000Z", 70, ["security-boundary"])]);
    expect(result.status).toBe("ready");
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.scoreTrend).toBe(-20);
    expect(result.cards[0]?.improvementAreas).toContain("criterion:security-boundary");
    expect(result.cards[0]?.criterionSignals[0]?.criterionId).toBe("security-boundary");
    expect(formatAgentEvaluationIntelligence(result)).toContain("Effectiveness: 70/100");
  });
  it("filters suite and candidate and reports insufficient data", () => {
    const result = buildAgentEvaluationIntelligence([report("2026-01-01T00:00:00.000Z", 90)], { suiteId: "missing" });
    expect(result.status).toBe("insufficient-data");
    expect(result.cards).toHaveLength(0);
  });
  it("does not invent a trend without comparable prior data", () => {
    const result = buildAgentEvaluationIntelligence([report("2026-01-01T00:00:00.000Z", 90)]);
    expect(result.cards[0]?.scoreTrend).toBeNull();
  });
});
