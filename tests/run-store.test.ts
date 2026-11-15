import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRun } from "../src/core/orchestrator.js";
import { listRuns, loadRun, saveRun } from "../src/core/run-store.js";

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

  it("returns an empty list when no run history exists", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-run-store-"));
    await expect(listRuns(root)).resolves.toEqual([]);
  });

  it("rejects path-like run identifiers", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-run-store-"));
    await expect(loadRun(root, "../outside")).rejects.toThrow(/identifier/);
  });
});
