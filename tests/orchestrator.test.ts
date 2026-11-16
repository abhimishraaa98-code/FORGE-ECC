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

  it("runs independent tasks concurrently but respects the configured limit", async () => {
    let active = 0;
    let peak = 0;
    const concurrentProvider: AgentProvider = {
      name: "concurrency-test",
      async complete() {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 15));
        active -= 1;
        return { provider: "concurrency-test", content: "done" };
      },
    };
    const run = createRun("Parallel review", [
      { id: "a", agent: "reviewer", title: "A", prompt: "A" },
      { id: "b", agent: "reviewer", title: "B", prompt: "B" },
      { id: "c", agent: "reviewer", title: "C", prompt: "C" },
      { id: "d", agent: "reviewer", title: "D", prompt: "D" },
      { id: "e", agent: "reviewer", title: "E", prompt: "E" },
    ]);
    const result = await advanceRun(run, concurrentProvider, new Set(), { maxConcurrency: 2 });
    expect(result.status).toBe("completed");
    expect(peak).toBe(2);
    expect(result.tasks.every(task => task.status === "completed")).toBe(true);
  });

  it("does not start dependent tasks before their prerequisites finish", async () => {
    const started: string[] = [];
    const trackingProvider: AgentProvider = {
      name: "dependency-test",
      async complete(request) {
        started.push(request.task.id);
        return { provider: "dependency-test", content: request.task.id };
      },
    };
    const run = createRun("Dependency ordering", [
      { id: "root", agent: "architect", title: "Root", prompt: "Root" },
      { id: "child", agent: "planner", title: "Child", prompt: "Child", dependsOn: ["root"] },
      { id: "independent", agent: "reviewer", title: "Independent", prompt: "Independent" },
    ]);
    const result = await advanceRun(run, trackingProvider, new Set(), { maxConcurrency: 3 });
    expect(result.status).toBe("completed");
    expect(started.indexOf("child")).toBeGreaterThan(started.indexOf("root"));
  });

  it("passes bounded project context to agent providers", async () => {
    let receivedContext = "";
    const contextProvider: AgentProvider = {
      name: "context-test",
      async complete(request) {
        receivedContext = request.projectContext ?? "";
        return { provider: "context-test", content: "done" };
      },
    };
    const run = createRun("Use project memory", [
      { id: "one", agent: "planner", title: "One", prompt: "Use context" },
    ]);
    await advanceRun(run, contextProvider, new Set(), { projectContext: "Relevant local project decision." });
    expect(receivedContext).toContain("Relevant local project decision.");
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
