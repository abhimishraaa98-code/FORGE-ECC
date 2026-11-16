import { describe, expect, it } from "vitest";
import { createRun } from "../src/core/orchestrator.js";
import { evaluateRun, formatEvaluationReport, loadEvaluationSuites } from "../src/core/evaluation-engine.js";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("deterministic agent evaluation", () => {
  it("scores weighted required and forbidden terms against saved agent output", () => {
    const run = createRun("Baseline", [{ id: "plan", agent: "planner", title: "Plan", prompt: "Plan work" }]);
    run.tasks[0]!.status = "completed";
    run.tasks[0]!.result = { provider: "mock", content: "Acceptance criteria are clear. One risk remains." };
    const report = evaluateRun(run, {
      id: "quality-baseline", name: "Quality baseline", description: "Test",
      cases: [{ id: "planner-output", description: "Check plan", agent: "planner", criteria: [
        { id: "acceptance", weight: 3, requiredTerms: ["acceptance criteria"] },
        { id: "risk", weight: 1, requiredTerms: ["risk"] },
        { id: "no-false-claim", weight: 2, forbiddenTerms: ["tests passed"] }
      ] }]
    });
    expect(report.score).toBe(100);
    expect(report.passed).toBe(true);
    expect(report.summary.passed).toBe(1);
    expect(formatEvaluationReport(report)).toContain("100/100");
  });

  it("weights failed criteria and reports missing output explicitly", () => {
    const run = createRun("Baseline", [{ id: "review", agent: "code-reviewer", title: "Review", prompt: "Review" }]);
    run.tasks[0]!.status = "completed";
    run.tasks[0]!.result = { provider: "mock", content: "A brief review." };
    const report = evaluateRun(run, {
      id: "review-checks", name: "Review checks", description: "Test",
      cases: [
        { id: "required", description: "Need evidence", agent: "code-reviewer", criteria: [{ id: "evidence", weight: 4, requiredTerms: ["evidence"] }] },
        { id: "missing", description: "Missing role output", agent: "security-reviewer", criteria: [{ id: "mitigation", weight: 1, requiredTerms: ["mitigation"] }] }
      ]
    });
    expect(report.score).toBe(0);
    expect(report.passed).toBe(false);
    expect(report.summary.missingOutput).toBe(1);
    expect(report.cases[1]?.status).toBe("missing-output");
  });

  it("loads validated suites from .forge/evals", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "forge-evals-"));
    try {
      await mkdir(path.join(root, ".forge", "evals"), { recursive: true });
      await writeFile(path.join(root, ".forge", "evals", "baseline.json"), JSON.stringify({
        id: "baseline-suite", name: "Baseline", description: "Test",
        cases: [{ id: "planner-case", description: "Planner", agent: "planner", criteria: [{ id: "must-plan", weight: 1, requiredTerms: ["plan"] }] }]
      }));
      const suites = await loadEvaluationSuites(root);
      expect(suites.map(suite => suite.id)).toEqual(["baseline-suite"]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
