import { createRun, type AgentTask, type RunRecord } from "./orchestrator.js";

export function createReviewPlan(goal: string): RunRecord {
  const normalized = goal.trim();
  if (!normalized) throw new Error("Provide a goal after --goal.");

  const tasks: AgentTask[] = [
    {
      id: "understand",
      agent: "architect",
      title: "Understand the project and change scope",
      prompt: `Inspect the relevant project structure and conventions for this goal: ${normalized}. Identify assumptions, affected areas, and constraints. Do not modify files.`,
    },
    {
      id: "plan",
      agent: "planner",
      title: "Create an implementation plan",
      prompt: `Using the project understanding, produce a small ordered plan for: ${normalized}. Include file-level scope, acceptance criteria, risks, and verification steps. Do not modify files.`,
      dependsOn: ["understand"],
    },
    {
      id: "verify",
      agent: "test-engineer",
      title: "Define the verification strategy",
      prompt: `Define the tests and checks needed to verify this goal: ${normalized}. Distinguish suggested checks from checks actually executed.`,
      dependsOn: ["plan"],
    },
  ];

  return createRun(normalized, tasks);
}
