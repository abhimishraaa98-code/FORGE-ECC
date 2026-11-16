import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRun } from "../src/core/orchestrator.js";
import { decideTaskApproval, listRuns, loadRun, saveRun } from "../src/core/run-store.js";

let root = "";
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

describe("local run history", () => {
  it("saves, loads, and lists run records", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-run-store-"));
    const run = createRun("Track a plan", [
      { id: "draft", agent: "planner", title: "Draft", prompt: "Draft a plan" },
    ]);
    await saveRun(root, run);
    const loaded = await loadRun(root, run.id);
    const history = await listRuns(root);
    expect(loaded.id).toBe(run.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.goal).toBe("Track a plan");
  });

  it("records one-time approval and rejection decisions with audit events", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-run-approval-"));
    const run = createRun("Gate sensitive tasks", [
      { id: "approve-me", agent: "reviewer", title: "Review", prompt: "Review", requiresApproval: true },
      { id: "reject-me", agent: "reviewer", title: "Reject", prompt: "Reject", requiresApproval: true },
    ]);
    const held = { ...run, status: "awaiting_approval" as const, tasks: run.tasks.map(task => ({ ...task, status: "awaiting_approval" as const })) };
    await saveRun(root, held);
    const approved = await decideTaskApproval(root, run.id, "approve-me", "approved", "local-user");
    expect(approved.tasks[0]?.status).toBe("pending");
    expect(approved.tasks[0]?.approval?.decision).toBe("approved");
    await expect(decideTaskApproval(root, run.id, "approve-me", "approved", "local-user")).rejects.toThrow(/already/);
    const rejected = await decideTaskApproval(root, run.id, "reject-me", "rejected", "local-user", "Needs changes");
    expect(rejected.tasks[1]?.status).toBe("failed");
    expect(rejected.tasks[1]?.approval?.reason).toBe("Needs changes");
    expect(rejected.events.map(event => event.type)).toContain("rejected");
  });

  it("returns an empty list when no run history exists", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-run-store-"));
    await expect(listRuns(root)).resolves.toEqual([]);
  });

  it("rejects a symlinked run-history directory", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-run-symlink-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "forge-run-outside-"));
    await symlink(outside, path.join(root, ".forge"));
    const run = createRun("Symlink check", [
      { id: "draft", agent: "planner", title: "Draft", prompt: "Draft" },
    ]);
    await expect(saveRun(root, run)).rejects.toThrow(/symbolic links/);
    await rm(outside, { recursive: true, force: true });
  });

  it("rejects symlinked run files and malformed stored task records", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-run-file-"));
    const run = createRun("File validation", [
      { id: "draft", agent: "planner", title: "Draft", prompt: "Draft" },
    ]);
    await saveRun(root, run);
    const directory = path.join(root, ".forge", "runs");
    const file = path.join(directory, run.id + ".json");
    await rm(file);
    const outside = path.join(root, "outside.json");
    await writeFile(outside, JSON.stringify(run));
    await symlink(outside, file);
    await expect(loadRun(root, run.id)).rejects.toThrow();
    await rm(file);
    await writeFile(file, JSON.stringify({ ...run, tasks: [{ task: null, status: "pending" }] }));
    await expect(loadRun(root, run.id)).rejects.toThrow(/invalid task record/);
  });

  it("allows only one concurrent approval decision", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-run-race-"));
    const run = createRun("Serialize approvals", [
      { id: "review", agent: "reviewer", title: "Review", prompt: "Review", requiresApproval: true },
    ]);
    const held = { ...run, status: "awaiting_approval" as const, tasks: run.tasks.map(task => ({ ...task, status: "awaiting_approval" as const })) };
    await saveRun(root, held);
    const decisions = await Promise.allSettled([
      decideTaskApproval(root, run.id, "review", "approved", "reviewer-a"),
      decideTaskApproval(root, run.id, "review", "rejected", "reviewer-b"),
    ]);
    expect(decisions.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(decisions.filter(result => result.status === "rejected")).toHaveLength(1);
    const saved = await loadRun(root, run.id);
    expect(saved.tasks[0]?.approval?.decision).toBeDefined();
    expect(saved.events.filter(event => event.type === "approved" || event.type === "rejected")).toHaveLength(1);
  });

  it("rejects path-like run identifiers", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-run-store-"));
    await expect(loadRun(root, "../outside")).rejects.toThrow(/identifier/);
  });
});
