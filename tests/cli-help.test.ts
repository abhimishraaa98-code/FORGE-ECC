import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRun } from "../src/core/orchestrator.js";
import { saveRun } from "../src/core/run-store.js";

function runCli(...args: string[]): string {
  return execFileSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

const temporaryDirectories: string[] = [];
async function createWorkspace(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "forge-cli-help-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe("run-history CLI help", () => {
  it("prints runs usage without reading project history", () => {
    expect(runCli("runs", "--help")).toContain("Usage: forge runs [path] [--json] [--limit N]");
  });

  it("documents the versioned JSON option and run limit", () => {
    const help = runCli("runs", "--help");
    expect(help).toContain("versioned machine-readable summary");
    expect(help).toContain("--limit N");
  });

  it("prints show-run usage without requiring a run ID", () => {
    expect(runCli("show-run", "--help")).toContain("Usage: forge show-run RUN_ID [--path PROJECT]");
  });

  it("limits text and JSON history to the newest runs", async () => {
    const directory = await createWorkspace();
    const older = createRun("Older run", [{ id: "older-task", agent: "planner", title: "Older task", prompt: "Plan older run" }]);
    older.createdAt = "2026-01-01T00:00:00.000Z";
    const newer = createRun("Newer run", [{ id: "newer-task", agent: "planner", title: "Newer task", prompt: "Plan newer run" }]);
    newer.createdAt = "2026-01-02T00:00:00.000Z";
    await saveRun(directory, older);
    await saveRun(directory, newer);

    const textOutput = runCli("runs", directory, "--limit", "1");
    expect(textOutput).toContain(newer.id);
    expect(textOutput).not.toContain(older.id);

    const jsonOutput = JSON.parse(runCli("runs", directory, "--json", "--limit", "1"));
    expect(jsonOutput.runs).toHaveLength(1);
    expect(jsonOutput.runs[0].id).toBe(newer.id);
  });

  it("rejects missing, zero, and non-numeric limits", async () => {
    const directory = await createWorkspace();
    for (const args of [["--limit"], ["--limit", "0"], ["--limit", "many"]]) {
      expect(() => runCli("runs", directory, ...args)).toThrow();
    }
  });
});
