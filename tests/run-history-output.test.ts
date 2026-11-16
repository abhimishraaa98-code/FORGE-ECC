import { describe, expect, it } from "vitest";
import { createRun } from "../src/core/orchestrator.js";
import { formatRunHistoryJson } from "../src/core/run-history-output.js";

describe("run history JSON contract", () => {
  it("returns a versioned empty collection", () => {
    expect(JSON.parse(formatRunHistoryJson([]))).toEqual({ schemaVersion: 1, runs: [] });
  });

  it("exposes stable summary fields and task-state counts without internal task payloads", () => {
    const run = createRun("Summarize a release", [
      { id: "pending", agent: "planner", title: "Pending", prompt: "Secret prompt" },
      { id: "approval", agent: "reviewer", title: "Approval", prompt: "Private review", requiresApproval: true },
      { id: "done", agent: "builder", title: "Done", prompt: "Internal work" },
    ]);
    run.tasks[1]!.status = "awaiting_approval";
    run.tasks[2]!.status = "completed";
    run.events.push({ at: run.updatedAt, taskId: "done", type: "completed", message: "Finished" });
    run.tokenUsage = { estimatedTokensUsed: 19, estimatedTokensByAgent: { builder: 19 } };

    const output = JSON.parse(formatRunHistoryJson([run]));
    expect(output).toEqual({
      schemaVersion: 1,
      runs: [{
        id: run.id,
        goal: run.goal,
        status: run.status,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        taskCount: 3,
        pendingTaskCount: 1,
        awaitingApprovalTaskCount: 1,
        completedTaskCount: 1,
        failedTaskCount: 0,
        blockedTaskCount: 0,
        eventCount: 1,
      }],
    });
    expect(formatRunHistoryJson([run])).not.toContain("Secret prompt");
    expect(formatRunHistoryJson([run])).not.toContain("estimatedTokensUsed");
    expect(formatRunHistoryJson([run])).toMatch(/\n$/);
  });
});
