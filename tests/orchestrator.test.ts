import { describe, expect, it } from "vitest";
import {
  advanceRun,
  createRun,
  DemoAgentProvider,
  PlanValidationError,
  type AgentProvider,
} from "../src/core/orchestrator.js";

const provider = new DemoAgentProvider();

describe("FORGE orchestration engine", () => {
  it("validates duplicate, missing, and cyclic dependencies", () => {
    expect(() => createRun("goal", [
      { id: "a", agent: "planner", title: "A", prompt: "Do A" },
      { id: "a", agent: "planner", title: "Duplicate", prompt: "Do it" },
    ])).toThrow(PlanValidationError);

    expect(() => createRun("goal", [
      { id: "a", agent: "planner", title: "A", prompt: "Do A", dependsOn: ["missing"] },
    ])).toThrow(/unknown task/);

    expect(() => createRun("goal", [
      { id: "a", agent: "planner", title: "A", prompt: "Do A", dependsOn: ["b"] },
      { id: "b", agent: "planner", title: "B", prompt: "Do B", dependsOn: ["a"] },
    ])).toThrow(/cycle/);
  });

  it("runs dependency-ordered tasks and passes completed context", async () => {
    const run = createRun("Improve reliability", [
      { id: "inspect", agent: "architect", title: "Inspect", prompt: "Inspect structure" },
      { id: "plan", agent: "planner", title: "Plan", prompt: "Create plan", dependsOn: ["inspect"] },
    ]);
    const result = await advanceRun(run, provider);
    expect(result.status).toBe("completed");
    expect(result.tasks[1]?.result?.content).toContain("inspect");
  });

  it("holds approval-gated work until explicit approval", async () => {
    const run = createRun("Review a change", [
      { id: "review", agent: "reviewer", title: "Review", prompt: "Review proposal", requiresApproval: true },
    ]);
    const held = await advanceRun(run, provider);
    expect(held.status).toBe("awaiting_approval");
    expect(held.tasks[0]?.status).toBe("awaiting_approval");

    const approved = await advanceRun(held, provider, new Set(["review"]));
    expect(approved.status).toBe("completed");
  });

  it("records provider failures and blocks dependent tasks", async () => {
    const failing: AgentProvider = {
      name: "failing-test-provider",
      async complete() { throw new Error("provider unavailable"); },
    };
    const run = createRun("Test failure handling", [
      { id: "first", agent: "planner", title: "First", prompt: "Fail" },
      { id: "second", agent: "tester", title: "Second", prompt: "Depends", dependsOn: ["first"] },
    ]);
    const result = await advanceRun(run, failing);
    expect(result.status).toBe("failed");
    expect(result.tasks[0]?.status).toBe("failed");
    expect(result.tasks[1]?.status).toBe("blocked");
  });
});
