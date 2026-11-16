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
  retries?: number;
}
export interface ModelRouterOptions {
  fastModel: string;
  balancedModel: string;
  reasoningModel: string;
  fallbackModel?: string;
  createProvider: (model: string) => AgentProvider;
  onTrace?: (trace: AgentTrace) => void;
  retryAttempts?: number;
  retryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  maxInputTokensPerTask?: number;
  maxOutputTokensPerTask?: number;
  maxEstimatedTokensPerRun?: number;
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


function isRetryableProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /HTTP (408|409|425|429|5\d\d)\b|timed? ?out|timeout|ECONNRESET|ECONNREFUSED|EAI_AGAIN|fetch failed|network error/i.test(message);
}

export class ModelRouter implements AgentProvider {
  readonly name = "forge-model-router";
  readonly traces: AgentTrace[] = [];
  private estimatedTokensUsed = 0;
  constructor(private readonly options: ModelRouterOptions) {
    if (!Number.isInteger(options.retryAttempts ?? 2) || (options.retryAttempts ?? 2) < 0 || (options.retryAttempts ?? 2) > 5) throw new Error("Provider retry attempts must be between 0 and 5.");
    if (!Number.isInteger(options.retryDelayMs ?? 500) || (options.retryDelayMs ?? 500) < 0 || (options.retryDelayMs ?? 500) > 10000) throw new Error("Provider retry delay must be between 0 and 10000 milliseconds.");
    for (const [name, value] of Object.entries({ maxInputTokensPerTask: options.maxInputTokensPerTask, maxOutputTokensPerTask: options.maxOutputTokensPerTask, maxEstimatedTokensPerRun: options.maxEstimatedTokensPerRun })) {
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) throw new Error(`${name} must be a positive safe integer.`);
    }
    for (const model of [options.fastModel, options.balancedModel, options.reasoningModel]) {
      if (!model.trim()) throw new Error("Every model routing tier needs a model name.");
    }
  }

  async complete(request: AgentRequest): Promise<AgentResponse> {
    const route = chooseModelRoute(request, this.options);
    const startedAt = new Date().toISOString();
    const start = Date.now();
    const inputText = request.task.prompt + (request.projectContext ?? "") + request.completedDependencies.map(item => item.result).join("");
    const inputTokensEstimate = Math.ceil(inputText.length / 4);
    const maxInput = this.options.maxInputTokensPerTask;
    if (maxInput !== undefined && inputTokensEstimate > maxInput) throw new Error(`FORGE budget exceeded: task input estimate ${inputTokensEstimate} exceeds per-task limit ${maxInput}.`);
    const runLimit = this.options.maxEstimatedTokensPerRun;
    const maxOutput = this.options.maxOutputTokensPerTask;
    if (runLimit !== undefined && this.estimatedTokensUsed + inputTokensEstimate > runLimit) throw new Error(`FORGE budget exceeded: run estimate would exceed ${runLimit} tokens before provider call.`);
    this.estimatedTokensUsed += inputTokensEstimate;
    const provider = this.options.createProvider(route.model);
    let retries = 0;
    let response: AgentResponse | undefined;
    let primaryError: unknown;
    const maxRetries = this.options.retryAttempts ?? 2;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        response = await provider.complete(request);
        break;
      } catch (error) {
        primaryError = error;
        if (attempt >= maxRetries || !isRetryableProviderError(error)) break;
        retries += 1;
        const delay = (this.options.retryDelayMs ?? 500) * Math.pow(2, attempt);
        await (this.options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))))(delay);
      }
    }
    if (response) {
      const outputTokensEstimate = Math.ceil(response.content.length / 4);
      if (maxOutput !== undefined && outputTokensEstimate > maxOutput) {
        const message = `FORGE budget exceeded: task output estimate ${outputTokensEstimate} exceeds per-task limit ${maxOutput}.`;
        this.traces.push({ taskId: request.task.id, agent: request.task.agent, tier: route.tier, model: response.model ?? route.model, provider: response.provider, startedAt, durationMs: Date.now() - start, outcome: "failed", retries, inputTokensEstimate, outputTokensEstimate, error: message });
        throw new Error(message);
      }
      if (runLimit !== undefined && this.estimatedTokensUsed + outputTokensEstimate > runLimit) {
        const message = `FORGE budget exceeded: run estimate would exceed ${runLimit} tokens after provider response.`;
        this.estimatedTokensUsed += outputTokensEstimate;
        this.traces.push({ taskId: request.task.id, agent: request.task.agent, tier: route.tier, model: response.model ?? route.model, provider: response.provider, startedAt, durationMs: Date.now() - start, outcome: "failed", retries, inputTokensEstimate, outputTokensEstimate, error: message });
        throw new Error(message);
      }
      this.estimatedTokensUsed += outputTokensEstimate;
      const trace: AgentTrace = {
        taskId: request.task.id, agent: request.task.agent, tier: route.tier,
        model: response.model ?? route.model, provider: response.provider,
        startedAt, durationMs: Date.now() - start, outcome: "success", retries,
        inputTokensEstimate,
        outputTokensEstimate,
      };
      this.traces.push(trace); this.options.onTrace?.(trace);
      return response;
    }
    try {
      throw primaryError;
    } catch (primaryError) {
      if (!this.options.fallbackModel || this.options.fallbackModel === route.model) {
        const message = primaryError instanceof Error ? primaryError.message : String(primaryError);
        this.traces.push({ taskId: request.task.id, agent: request.task.agent, tier: route.tier, model: route.model, provider: provider.name, startedAt, durationMs: Date.now() - start, outcome: "failed", retries, inputTokensEstimate: Math.ceil(inputText.length / 4), outputTokensEstimate: 0, error: message });
        throw primaryError;
      }
      try {
        const fallback = this.options.createProvider(this.options.fallbackModel);
        const response = await fallback.complete(request);
        const fallbackOutputEstimate = Math.ceil(response.content.length / 4);
        if (maxOutput !== undefined && fallbackOutputEstimate > maxOutput) throw new Error(`FORGE budget exceeded: fallback output estimate ${fallbackOutputEstimate} exceeds per-task limit ${maxOutput}.`);
        if (runLimit !== undefined && this.estimatedTokensUsed + fallbackOutputEstimate > runLimit) {
          this.estimatedTokensUsed += fallbackOutputEstimate;
          throw new Error(`FORGE budget exceeded: run estimate would exceed ${runLimit} tokens after fallback response.`);
        }
        this.estimatedTokensUsed += fallbackOutputEstimate;
        const trace: AgentTrace = {
          taskId: request.task.id, agent: request.task.agent, tier: route.tier,
          model: response.model ?? this.options.fallbackModel, provider: response.provider,
          startedAt, durationMs: Date.now() - start, outcome: "fallback", retries,
          inputTokensEstimate: Math.ceil(inputText.length / 4),
          outputTokensEstimate: Math.ceil(response.content.length / 4),
          error: "Primary model failed; configured fallback was used.",
        };
        this.traces.push(trace); this.options.onTrace?.(trace);
        return response;
      } catch (fallbackError) {
        const message = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        this.traces.push({ taskId: request.task.id, agent: request.task.agent, tier: route.tier, model: this.options.fallbackModel, provider: "fallback", startedAt, durationMs: Date.now() - start, outcome: "failed", retries, inputTokensEstimate: Math.ceil(inputText.length / 4), outputTokensEstimate: 0, error: message });
        throw fallbackError;
      }
    }
  }
}
