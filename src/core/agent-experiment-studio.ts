import type { BenchmarkMatrixConfig } from "./benchmark-matrix.js";
import { validateBenchmarkMatrix } from "./benchmark-matrix.js";

export interface SkillExperimentStudioInput {
  id: string;
  name: string;
  baselineCandidateId: string;
  treatmentCandidateId: string;
  provider: "openai" | "claude-code" | "anthropic" | "google" | "ollama";
  model: string;
  repeats: number;
  skillIds: string[];
}
export function createSkillExperimentMatrix(input: SkillExperimentStudioInput): BenchmarkMatrixConfig {
  const matrix: BenchmarkMatrixConfig = {
    id: input.id,
    name: input.name,
    repeats: input.repeats,
    candidates: [
      { id: input.baselineCandidateId, provider: input.provider, model: input.model, skillIds: [] },
      { id: input.treatmentCandidateId, provider: input.provider, model: input.model, skillIds: [...input.skillIds] }
    ],
    skillExperiment: {
      baselineCandidateId: input.baselineCandidateId,
      treatmentCandidateId: input.treatmentCandidateId,
      skillIds: [...input.skillIds]
    }
  };
  return validateBenchmarkMatrix(matrix);
}
export function formatSkillExperimentMatrix(matrix: BenchmarkMatrixConfig): string {
  const experiment = matrix.skillExperiment!;
  return [
    "FORGE Experiment Studio · " + matrix.name,
    "Matrix ID: " + matrix.id,
    "Provider/model: " + matrix.candidates[0]!.provider + "/" + matrix.candidates[0]!.model,
    "Repeats per candidate: " + matrix.repeats,
    "",
    "Baseline: " + experiment.baselineCandidateId,
    "  Skills: none (explicit empty skill set)",
    "Treatment: " + experiment.treatmentCandidateId,
    "  Skills: " + experiment.skillIds.join(", "),
    "",
    "Next: forge benchmark-matrix <CONFIG_FILE> --suite <SUITE_ID> --goal \"<task>\"",
    "",
    "This scaffold isolates the selected skill set. Agent configuration snapshots are not hydrated by this scaffold; use the active workspace agent files consistently across both candidates."
  ].join("\n");
}
