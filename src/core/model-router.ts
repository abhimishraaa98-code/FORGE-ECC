import type { AgentProvider, AgentRequest, AgentResponse } from "./orchestrator.js";

export type ModelTier = "fast" | "balanced" | "reasoning";
export interface ModelRoute { tier: ModelTier; model: string; reason: string; }
export interface AgentTrace {
  taskId: string;
  agent: string;
  tier: ModelTier;
  model: string;
  provider: string;
  startedAt: string;
  durationMs: number;
  outcome: "success" | "fallback" | "failed";
  inputTokensEstimate: number;
  outputTokensEstimate: number;
  error?: string;
}
export interface ModelRouterOptions {
  fastModel: string;
  balancedModel: string;
  reasoningModel: string;
  fallbackModel?: string;
  createProvider: (model: string) => AgentProvider;
  onTrace?: (trace: AgentTrace) => void;
}

export function chooseModelRoute(request: AgentRequest, models: Pick<ModelRouterOptions, "fastModel" | "balancedModel" | "reasoningModel">): ModelRoute {
  const agent = request.task.agent.toLowerCase();
  const text = (request.task.title + " " + request.task.prompt).toLowerCase();
  const highStakes = /security|debugger|architect|release-manager/.test(agent)
    || /security|vulnerability|architecture|migration|root cause|incident|critical/.test(text);
  const simple = /documentation-writer|accessibility-reviewer/.test(agent)
    || /typo|format|rename|readme|document/.test(text);
  if (highStakes) return { tier: "reasoning", model: models.reasoningModel, reason: "High-impact reasoning or specialist role." };
  if (simple) return { tier: "fast", model: models.fastModel, reason: "Focused, lower-complexity task." };
  return { tier: "balanced", model: models.balancedModel, reason: "General engineering task." };
}

export class ModelRouter implements AgentProvider {
  readonly name = "forge-model-router";
  readonly traces: AgentTrace[] = [];
  constructor(private readonly options: ModelRouterOptions) {
    for (const model of [options.fastModel, options.balancedModel, options.reasoningModel]) {
      if (!model.trim()) throw new Error("Every model routing tier needs a model name.");
    }
  }

  async complete(request: AgentRequest): Promise<AgentResponse> {
    const route = chooseModelRoute(request, this.options);
    const startedAt = new Date().toISOString();
    const start = Date.now();
    const inputText = request.task.prompt + (request.projectContext ?? "") + request.completedDependencies.map(item => item.result).join("");
    const provider = this.options.createProvider(route.model);
    try {
      const response = await provider.complete(request);
      const trace: AgentTrace = {
        taskId: request.task.id, agent: request.task.agent, tier: route.tier,
        model: response.model ?? route.model, provider: response.provider,
        startedAt, durationMs: Date.now() - start, outcome: "success",
        inputTokensEstimate: Math.ceil(inputText.length / 4),
        outputTokensEstimate: Math.ceil(response.content.length / 4),
      };
      this.traces.push(trace); this.options.onTrace?.(trace);
      return response;
    } catch (primaryError) {
      if (!this.options.fallbackModel || this.options.fallbackModel === route.model) {
        const message = primaryError instanceof Error ? primaryError.message : String(primaryError);
        this.traces.push({ taskId: request.task.id, agent: request.task.agent, tier: route.tier, model: route.model, provider: provider.name, startedAt, durationMs: Date.now() - start, outcome: "failed", inputTokensEstimate: Math.ceil(inputText.length / 4), outputTokensEstimate: 0, error: message });
        throw primaryError;
      }
      try {
        const fallback = this.options.createProvider(this.options.fallbackModel);
        const response = await fallback.complete(request);
        const trace: AgentTrace = {
          taskId: request.task.id, agent: request.task.agent, tier: route.tier,
          model: response.model ?? this.options.fallbackModel, provider: response.provider,
          startedAt, durationMs: Date.now() - start, outcome: "fallback",
          inputTokensEstimate: Math.ceil(inputText.length / 4),
          outputTokensEstimate: Math.ceil(response.content.length / 4),
          error: "Primary model failed; configured fallback was used.",
        };
        this.traces.push(trace); this.options.onTrace?.(trace);
        return response;
      } catch (fallbackError) {
        const message = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        this.traces.push({ taskId: request.task.id, agent: request.task.agent, tier: route.tier, model: this.options.fallbackModel, provider: "fallback", startedAt, durationMs: Date.now() - start, outcome: "failed", inputTokensEstimate: Math.ceil(inputText.length / 4), outputTokensEstimate: 0, error: message });
        throw fallbackError;
      }
    }
  }
}
