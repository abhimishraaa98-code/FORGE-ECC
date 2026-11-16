import type { RunRecord } from "./orchestrator.js";

export interface RunHistoryJsonItem {
  id: string;
  goal: string;
  status: RunRecord["status"];
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  pendingTaskCount: number;
  awaitingApprovalTaskCount: number;
  completedTaskCount: number;
  failedTaskCount: number;
  blockedTaskCount: number;
  eventCount: number;
}

export interface RunHistoryJson {
  schemaVersion: 1;
  runs: RunHistoryJsonItem[];
}

/** Formats the public, versioned summary contract for `forge runs --json`. */
export function formatRunHistoryJson(runs: readonly RunRecord[]): string {
  const output: RunHistoryJson = {
    schemaVersion: 1,
    runs: runs.map((run) => ({
      id: run.id,
      goal: run.goal,
      status: run.status,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      taskCount: run.tasks.length,
      pendingTaskCount: run.tasks.filter((task) => task.status === "pending").length,
      awaitingApprovalTaskCount: run.tasks.filter((task) => task.status === "awaiting_approval").length,
      completedTaskCount: run.tasks.filter((task) => task.status === "completed").length,
      failedTaskCount: run.tasks.filter((task) => task.status === "failed").length,
      blockedTaskCount: run.tasks.filter((task) => task.status === "blocked").length,
      eventCount: run.events.length,
    })),
  };
  return JSON.stringify(output, null, 2) + "\n";
}
