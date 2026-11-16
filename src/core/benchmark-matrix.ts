import { readFile } from "node:fs/promises";

export interface BenchmarkCandidate {
  id: string;
  provider: "openai" | "claude-code";
  model: string;
}
export interface BenchmarkMatrixConfig {
  id: string;
  name: string;
  repeats: number;
  candidates: BenchmarkCandidate[];
}
export interface BenchmarkMatrixResult {
  candidateId: string;
  provider: string;
  model: string;
  repeat: number;
  runId: string;
  score: number;
  passed: boolean;
  durationMs: number;
  estimatedTokens: number;
}
export interface BenchmarkMatrixReport {
  version: 1;
  matrixId: string;
  matrixName: string;
  suiteId: string;
  goal: string;
  createdAt: string;
  results: BenchmarkMatrixResult[];
  summary: Array<{
    candidateId: string;
    provider: string;
    model: string;
    trials: number;
    completed: number;
    averageScore: number;
    passRate: number;
    scoreStdDev: number;
    averageDurationMs: number;
    averageEstimatedTokens: number;
  }>;
}

const SAFE_ID = /^[a-z0-9][a-z0-9-]{1,47}$/;

export function validateBenchmarkMatrix(value: unknown): BenchmarkMatrixConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Benchmark matrix config must be a JSON object.");
  const config = value as BenchmarkMatrixConfig;
  if (!SAFE_ID.test(config.id) || typeof config.name !== "string" || !config.name.trim() || config.name.length > 120) throw new Error("Benchmark matrix needs a valid id and name.");
  if (!Number.isSafeInteger(config.repeats) || config.repeats < 1 || config.repeats > 10) throw new Error("Benchmark matrix repeats must be between 1 and 10.");
  if (!Array.isArray(config.candidates) || config.candidates.length < 2 || config.candidates.length > 8) throw new Error("Benchmark matrix needs between 2 and 8 candidates.");
  const ids = new Set<string>();
  for (const candidate of config.candidates) {
    if (!candidate || !SAFE_ID.test(candidate.id) || ids.has(candidate.id)) throw new Error("Every benchmark candidate needs a unique valid id.");
    ids.add(candidate.id);
    if (candidate.provider !== "openai" && candidate.provider !== "claude-code") throw new Error("Benchmark candidates support openai and claude-code providers.");
    if (typeof candidate.model !== "string" || !candidate.model.trim() || candidate.model.length > 160) throw new Error("Every benchmark candidate needs a model name.");
  }
  return config;
}

export async function loadBenchmarkMatrix(file: string): Promise<BenchmarkMatrixConfig> {
  return validateBenchmarkMatrix(JSON.parse(await (await import("node:fs/promises")).readFile(file, "utf8")));
}

export async function executeBenchmarkMatrix(
  config: BenchmarkMatrixConfig,
  execute: (candidate: BenchmarkCandidate, repeat: number) => Promise<Omit<BenchmarkMatrixResult, "candidateId" | "provider" | "model" | "repeat">>,
): Promise<BenchmarkMatrixReport> {
  const results: BenchmarkMatrixResult[] = [];
  for (const candidate of config.candidates) {
    for (let repeat = 1; repeat <= config.repeats; repeat += 1) {
      const result = await execute(candidate, repeat);
      results.push({ candidateId: candidate.id, provider: candidate.provider, model: candidate.model, repeat, ...result });
    }
  }
  const summary = config.candidates.map(candidate => {
    const items = results.filter(item => item.candidateId === candidate.id);
    const scores = items.map(item => item.score);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return {
      candidateId: candidate.id, provider: candidate.provider, model: candidate.model, trials: items.length,
      completed: items.length,
      averageScore: Math.round(average * 10) / 10,
      passRate: Math.round(items.filter(item => item.passed).length / items.length * 1000) / 10,
      scoreStdDev: Math.round(Math.sqrt(scores.reduce((sum, score) => sum + Math.pow(score - average, 2), 0) / scores.length) * 10) / 10,
      averageDurationMs: Math.round(items.reduce((sum, item) => sum + item.durationMs, 0) / items.length),
      averageEstimatedTokens: Math.round(items.reduce((sum, item) => sum + item.estimatedTokens, 0) / items.length),
    };
  }).sort((a, b) => b.averageScore - a.averageScore || a.averageDurationMs - b.averageDurationMs);
  return { version: 1, matrixId: config.id, matrixName: config.name, suiteId: "", goal: "", createdAt: new Date().toISOString(), results, summary };
}
