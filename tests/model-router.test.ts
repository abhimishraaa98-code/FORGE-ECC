import { describe, expect, it } from "vitest";
import { chooseModelRoute, ModelRouter } from "../src/core/model-router.js";
import type { AgentProvider } from "../src/core/orchestrator.js";

const models = { fastModel: "small-model", balancedModel: "mid-model", reasoningModel: "large-model" };

describe("task-aware model routing", () => {
  it("routes security and architecture work to reasoning tier", () => {
    expect(chooseModelRoute({ task: { id: "1", agent: "security-reviewer", title: "Review", prompt: "Review" }, completedDependencies: [] }, models).tier).toBe("reasoning");
    expect(chooseModelRoute({ task: { id: "2", agent: "architect", title: "Design", prompt: "Design" }, completedDependencies: [] }, models).model).toBe("large-model");
  });
  it("routes focused documentation work to fast tier", () => {
    expect(chooseModelRoute({ task: { id: "1", agent: "documentation-writer", title: "Docs", prompt: "Update guide" }, completedDependencies: [] }, models).model).toBe("small-model");
  });
  it("retries transient provider failures with bounded exponential backoff", async () => {
    let calls = 0;
    const delays: number[] = [];
    const router = new ModelRouter({
      ...models,
      retryAttempts: 2,
      retryDelayMs: 25,
      sleep: async milliseconds => { delays.push(milliseconds); },
      createProvider: model => ({
        name: model,
        async complete() {
          calls += 1;
          if (calls < 3) throw new Error("AI provider request failed with HTTP 503.");
          return { provider: model, model, content: "recovered proposal" };
        },
      }),
    });
    const result = await router.complete({ task: { id: "docs", agent: "documentation-writer", title: "Docs", prompt: "Write docs" }, completedDependencies: [] });
    expect(result.content).toBe("recovered proposal");
    expect(calls).toBe(3);
    expect(delays).toEqual([25, 50]);
    expect(router.traces[0]?.retries).toBe(2);
    expect(router.traces[0]?.outcome).toBe("success");
  });

  it("does not retry non-transient provider errors", async () => {
    let calls = 0;
    const router = new ModelRouter({
      ...models,
      retryAttempts: 3,
      createProvider: model => ({
        name: model,
        async complete() { calls += 1; throw new Error("HTTP 401 unauthorized"); },
      }),
    });
    await expect(router.complete({ task: { id: "docs", agent: "documentation-writer", title: "Docs", prompt: "Write docs" }, completedDependencies: [] })).rejects.toThrow("HTTP 401");
    expect(calls).toBe(1);
    expect(router.traces[0]?.retries).toBe(0);
  });

  it("rejects an oversized task input before calling the provider", async () => {
    let calls = 0;
    const router = new ModelRouter({
      ...models,
      maxInputTokensPerTask: 2,
      createProvider: model => ({
        name: model,
        async complete() { calls += 1; return { provider: model, content: "no" }; },
      }),
    });
    await expect(router.complete({ task: { id: "large", agent: "planner", title: "Large", prompt: "This prompt is deliberately too large" }, completedDependencies: [] })).rejects.toThrow("FORGE budget exceeded");
    expect(calls).toBe(0);
  });

  it("rejects provider output that exceeds the per-task output budget", async () => {
    const router = new ModelRouter({
      ...models,
      maxOutputTokensPerTask: 2,
      createProvider: model => ({
        name: model,
        async complete() { return { provider: model, content: "This output is too large for the configured limit." }; },
      }),
    });
    await expect(router.complete({ task: { id: "large", agent: "planner", title: "Large", prompt: "Small prompt" }, completedDependencies: [] })).rejects.toThrow("output estimate");
    expect(router.traces[0]?.outcome).toBe("failed");
  });

  it("enforces a run-wide estimated token budget across tasks", async () => {
    let calls = 0;
    const router = new ModelRouter({
      ...models,
      maxEstimatedTokensPerRun: 8,
      createProvider: model => ({
        name: model,
        async complete() { calls += 1; return { provider: model, content: "A short response." }; },
      }),
    });
    const request = { task: { id: "one", agent: "planner", title: "One", prompt: "Short" }, completedDependencies: [] };
    await router.complete(request);
    await expect(router.complete({ ...request, task: { ...request.task, id: "two" } })).rejects.toThrow("run estimate would exceed");
    expect(calls).toBe(1);
  });

  it("uses configured fallback and records a trace", async () => {
    const created: string[] = [];
    const createProvider = (model: string): AgentProvider => {
      created.push(model);
      return {
        name: model,
        async complete() {
          if (model === "large-model") throw new Error("primary unavailable");
          return { provider: model, model, content: "fallback proposal" };
        },
      };
    };
    const router = new ModelRouter({ ...models, fallbackModel: "backup-model", createProvider });
    const result = await router.complete({ task: { id: "secure", agent: "security-reviewer", title: "Security review", prompt: "Review auth" }, completedDependencies: [] });
    expect(result.model).toBe("backup-model");
    expect(created).toEqual(["large-model", "backup-model"]);
    expect(router.traces[0]?.outcome).toBe("fallback");
    expect(router.traces[0]?.inputTokensEstimate).toBeGreaterThan(0);
  });
});
