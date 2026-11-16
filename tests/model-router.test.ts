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
