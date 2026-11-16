import { describe, expect, it } from "vitest";
import { createSkillExperimentMatrix, formatSkillExperimentMatrix } from "../src/core/agent-experiment-studio.js";

describe("agent experiment studio", () => {
  it("creates a validated baseline and treatment skill matrix", () => {
    const matrix = createSkillExperimentMatrix({ id: "secure-skill-test", name: "Secure skill treatment", baselineCandidateId: "baseline", treatmentCandidateId: "with-secure-skill", provider: "openai", model: "gpt-test", repeats: 2, skillIds: ["secure-changes"] });
    expect(matrix.candidates[0]?.skillIds).toEqual([]);
    expect(matrix.candidates[1]?.skillIds).toEqual(["secure-changes"]);
    expect(matrix.skillExperiment?.baselineCandidateId).toBe("baseline");
    expect(formatSkillExperimentMatrix(matrix)).toContain("Skills: none");
    expect(formatSkillExperimentMatrix(matrix)).toContain("secure-changes");
  });
  it("rejects a matrix that changes provider/model or omits treatment skills", () => {
    expect(() => createSkillExperimentMatrix({ id: "invalid-experiment", name: "Invalid", baselineCandidateId: "baseline", treatmentCandidateId: "treatment", provider: "openai", model: "gpt-test", repeats: 2, skillIds: [] })).toThrow("unique valid skill IDs");
  });
  it("requires distinct valid candidate IDs and bounded repeat count", () => {
    expect(() => createSkillExperimentMatrix({ id: "bad", name: "Bad", baselineCandidateId: "same", treatmentCandidateId: "same", provider: "openai", model: "gpt-test", repeats: 2, skillIds: ["secure-changes"] })).toThrow("unique valid id");
    expect(() => createSkillExperimentMatrix({ id: "bad-repeats", name: "Bad repeats", baselineCandidateId: "baseline", treatmentCandidateId: "treatment", provider: "openai", model: "gpt-test", repeats: 4, skillIds: ["secure-changes"] })).toThrow("repeats must be between 1 and 3");
  });
});
