/**
 * FORGE orchestration contracts.
 *
 * The engine coordinates provider-generated text proposals only. It has no
 * shell, filesystem-write, network, or tool-execution capability.
 */

export type TaskStatus =
  | "pending"
  | "awaiting_approval"
  | "running"
  | "completed"
  | "failed"
  | "blocked";

export interface AgentTask {
  id: string;
  agent: string;
  title: string;
  prompt: string;
  dependsOn?: string[];
  requiresApproval?: boolean;
}

export interface AgentResponse {
  content: string;
  provider: string;
  model?: string;
}

export interface AgentRequest {
  task: AgentTask;
  completedDependencies: ReadonlyArray<{ id: string; result: string }>;
}

export interface AgentProvider {
  readonly name: string;
  complete(request: AgentRequest): Promise<AgentResponse>;
}

export interface TaskRecord {
  task: AgentTask;
  status: TaskStatus;
  result?: AgentResponse;
  error?: string;
  approval?: { decision: "approved" | "rejected"; reviewer: string; reason?: string; at: string };
}

export interface RunRecord {
  id: string;
  goal: string;
  createdAt: string;
  updatedAt: string;
  status: "pending" | "awaiting_approval" | "running" | "completed" | "failed";
  tasks: TaskRecord[];
  events: Array<{
    at: string;
    taskId: string;
    type: "approval_required" | "approved" | "rejected" | "started" | "completed" | "failed" | "blocked";
    message: string;
  }>;
}

export class PlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanValidationError";
  }
}

function validatePlan(tasks: readonly AgentTask[]): void {
  const ids = new Set<string>();
  for (const task of tasks) {
    if (!task.id.trim() || !task.agent.trim() || !task.title.trim() || !task.prompt.trim()) {
      throw new PlanValidationError("Every task needs a non-empty id, agent, title, and prompt.");
    }
    if (ids.has(task.id)) throw new PlanValidationError(`Duplicate task id: ${task.id}`);
    ids.add(task.id);
  }

  for (const task of tasks) {
    for (const dependency of task.dependsOn ?? []) {
      if (!ids.has(dependency)) {
        throw new PlanValidationError(`Task "${task.id}" depends on unknown task "${dependency}".`);
      }
      if (dependency === task.id) {
        throw new PlanValidationError(`Task "${task.id}" cannot depend on itself.`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(tasks.map(task => [task.id, task]));
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new PlanValidationError("Task dependencies contain a cycle.");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const task of tasks) visit(task.id);
}

function timestamp(): string {
  return new Date().toISOString();
}

export function createRun(goal: string, tasks: readonly AgentTask[]): RunRecord {
  if (!goal.trim()) throw new PlanValidationError("A run goal is required.");
  if (tasks.length === 0) throw new PlanValidationError("A run needs at least one task.");
  validatePlan(tasks);

  const now = timestamp();
  return {
    id: `forge-${Date.now().toString(36)}`,
    goal,
    createdAt: now,
    updatedAt: now,
    status: "pending",
    tasks: tasks.map(task => ({
      task: { ...task, dependsOn: [...(task.dependsOn ?? [])] },
      status: "pending",
    })),
    events: [],
  };
}

/**
 * Advances all currently runnable tasks in plan order.
 * Approval is an explicit, per-task input; no task can execute tools.
 */
export async function advanceRun(
  run: RunRecord,
  provider: AgentProvider,
  approvedTaskIds: ReadonlySet<string> = new Set(),
): Promise<RunRecord> {
  const next: RunRecord = {
    ...run,
    tasks: run.tasks.map(record => ({ ...record })),
    events: [...run.events],
    updatedAt: timestamp(),
  };
  const records = new Map(next.tasks.map(record => [record.task.id, record]));

  for (const record of next.tasks) {
    if (record.status === "completed" || record.status === "failed" || record.status === "blocked") continue;

    const dependencies = (record.task.dependsOn ?? []).map(id => records.get(id)!);
    if (dependencies.some(dependency => dependency.status === "failed" || dependency.status === "blocked")) {
      record.status = "blocked";
      next.events.push({ at: timestamp(), taskId: record.task.id, type: "blocked", message: "A required dependency did not complete." });
      continue;
    }
    if (dependencies.some(dependency => dependency.status !== "completed")) {
      record.status = "pending";
      continue;
    }
    if (record.task.requiresApproval && record.approval?.decision !== "approved" && !approvedTaskIds.has(record.task.id)) {
      record.status = "awaiting_approval";
      if (!run.tasks.find(previous => previous.task.id === record.task.id)?.status || run.tasks.find(previous => previous.task.id === record.task.id)?.status !== "awaiting_approval") {
        next.events.push({ at: timestamp(), taskId: record.task.id, type: "approval_required", message: "Explicit approval is required before this task can be sent to the provider." });
      }
      continue;
    }

    record.status = "running";
    next.events.push({ at: timestamp(), taskId: record.task.id, type: "started", message: `Sent to provider "${provider.name}".` });
    try {
      const completedDependencies = dependencies.map(dependency => ({
        id: dependency.task.id,
        result: dependency.result?.content ?? "",
      }));
      record.result = await provider.complete({ task: record.task, completedDependencies });
      record.status = "completed";
      next.events.push({ at: timestamp(), taskId: record.task.id, type: "completed", message: "Provider returned a proposal." });
    } catch (error) {
      record.status = "failed";
      record.error = error instanceof Error ? error.message : String(error);
      next.events.push({ at: timestamp(), taskId: record.task.id, type: "failed", message: record.error });
    }
  }

  const statuses = next.tasks.map(record => record.status);
  if (statuses.every(status => status === "completed")) next.status = "completed";
  else if (statuses.some(status => status === "failed")) next.status = "failed";
  else if (statuses.some(status => status === "awaiting_approval")) next.status = "awaiting_approval";
  else if (statuses.some(status => status === "running")) next.status = "running";
  else next.status = "pending";

  return next;
}

/** Deterministic provider for tests, demos, and offline integration checks. */
export class DemoAgentProvider implements AgentProvider {
  readonly name = "forge-demo";

  async complete(request: AgentRequest): Promise<AgentResponse> {
    return {
      provider: this.name,
      model: "deterministic-demo",
      content: [
        `Proposal from ${request.task.agent}: ${request.task.title}`,
        request.task.prompt,
        request.completedDependencies.length
          ? `Completed context: ${request.completedDependencies.map(item => item.id).join(", ")}`
          : "No completed task dependencies.",
        "This is a demonstration proposal, not an executed code change.",
      ].join("\n\n"),
    };
  }
}
