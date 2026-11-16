import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadAgentRegistry } from "../src/core/agent-registry.js";

let temporaryDirectory = "";

afterEach(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = "";
});

describe("agent registry", () => {
  it("provides built-in agents when no workspace exists", async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "forge-agents-"));
    const agents = await loadAgentRegistry(temporaryDirectory);
    expect(agents.map(agent => agent.id)).toContain("planner");
    expect(agents.every(agent => agent.source === "builtin")).toBe(true);
  });

  it("registers the expanded specialist team", async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "forge-agents-"));
    const agents = await loadAgentRegistry(temporaryDirectory);
    const ids = new Set(agents.map(agent => agent.id));
    for (const id of [
      "planner", "architect", "code-reviewer", "test-engineer", "security-reviewer",
      "debugger", "performance-engineer", "documentation-writer", "devops-engineer",
      "database-reviewer", "accessibility-reviewer", "release-manager",
    ]) {
      expect(ids.has(id), `expected built-in agent ${id}`).toBe(true);
    }
  });

  it("loads valid workspace markdown and overrides a built-in definition", async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "forge-agents-"));
    const directory = path.join(temporaryDirectory, ".forge", "agents");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "planner.md"), "# Custom Planner\n\nA workspace-specific planner.\n");
    await writeFile(path.join(directory, "../ignored.txt"), "ignored");

    const agents = await loadAgentRegistry(temporaryDirectory);
    const planner = agents.find(agent => agent.id === "planner");
    expect(planner?.name).toBe("Custom Planner");
    expect(planner?.source).toBe("workspace");
    expect(planner?.instructions).toContain("workspace-specific");
  });

  it("ignores unsafe agent filenames and non-markdown entries", async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "forge-agents-"));
    const directory = path.join(temporaryDirectory, ".forge", "agents");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "../bad.md"), "# Bad");
    await writeFile(path.join(directory, "bad name.md"), "# Bad");
    await writeFile(path.join(directory, "notes.txt"), "# Notes");

    const agents = await loadAgentRegistry(temporaryDirectory);
    expect(agents.some(agent => agent.id.includes("bad"))).toBe(false);
  });
});
