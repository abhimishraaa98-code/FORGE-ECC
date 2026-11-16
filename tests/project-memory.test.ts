import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addProjectMemory, buildProjectMemoryContext, listProjectMemory, removeProjectMemory } from "../src/core/project-memory.js";

describe("local project memory", () => {
  let directory = "";
  afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = ""; });
  async function workspace() { directory = await mkdtemp(path.join(os.tmpdir(), "forge-memory-")); return directory; }

  it("stores local notes and retrieves relevant context within a token budget", async () => {
    const root = await workspace();
    const decision = await addProjectMemory(root, { kind: "decision", content: "Use dependency injection for provider adapters.", tags: ["architecture", "providers"] });
    await addProjectMemory(root, { kind: "fact", content: "The CLI is written in TypeScript.", tags: ["cli"] });
    const context = await buildProjectMemoryContext(root, "provider architecture", 200);
    expect(context.includedIds).toContain(decision.id);
    expect(context.text).toContain("dependency injection");
    expect(context.estimatedTokens).toBeLessThanOrEqual(200);
  });

  it("allows users to inspect and delete individual notes", async () => {
    const root = await workspace();
    const entry = await addProjectMemory(root, { kind: "constraint", content: "Never write files without approval." });
    expect((await listProjectMemory(root))).toHaveLength(1);
    expect(await removeProjectMemory(root, entry.id)).toBe(true);
    expect(await listProjectMemory(root)).toHaveLength(0);
    expect(await removeProjectMemory(root, entry.id)).toBe(false);
  });

  it("rejects likely credential values and does not write them", async () => {
    const root = await workspace();
    await expect(addProjectMemory(root, { kind: "fact", content: "api_key=sk-example-secret" }))
      .rejects.toThrow("appears to contain a credential");
    await expect(readFile(path.join(root, ".forge", "memory.json"), "utf8")).rejects.toThrow();
  });
});
