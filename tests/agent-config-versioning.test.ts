import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  approveAgentConfigVersion, captureAgentConfigVersion, compareAgentConfigVersions,
  listAgentConfigVersions, loadAgentConfigVersion
} from "../src/core/agent-config-versioning.js";

const roots: string[] = [];
async function project(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "forge-agent-config-"));
  roots.push(root);
  await mkdir(path.join(root, ".forge", "agents"), { recursive: true });
  await mkdir(path.join(root, ".forge", "skills"), { recursive: true });
  await writeFile(path.join(root, ".forge", "agents", "planner.md"), "# Planner\nPlan carefully.\n");
  await writeFile(path.join(root, ".forge", "skills", "secure-changes.md"), "# Secure changes\nUse least privilege.\n");
  return root;
}
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

describe("agent configuration versioning", () => {
  it("captures snapshots, compares changes, and records explicit approval without applying files", async () => {
    const root = await project();
    const first = await captureAgentConfigVersion(root, { createdBy: "developer", note: "baseline" });
    await writeFile(path.join(root, ".forge", "agents", "planner.md"), "# Planner\nPlan with acceptance criteria.\n");
    await writeFile(path.join(root, ".forge", "skills", "documentation.md"), "# Documentation\nKeep docs current.\n");
    await unlink(path.join(root, ".forge", "skills", "secure-changes.md"));
    const second = await captureAgentConfigVersion(root, { note: "candidate update" });
    const diff = compareAgentConfigVersions(first, second);
    expect(diff.changed).toEqual(["agents/planner.md"]);
    expect(diff.added).toEqual(["skills/documentation.md"]);
    expect(diff.removed).toEqual(["skills/secure-changes.md"]);
    const approved = await approveAgentConfigVersion(root, second.id, "reviewer");
    expect(approved.status).toBe("approved");
    expect(approved.approvedBy).toBe("reviewer");
    expect(await readFile(path.join(root, ".forge", "agents", "planner.md"), "utf8")).toContain("acceptance criteria");
    expect(await listAgentConfigVersions(root)).toHaveLength(2);
    expect((await loadAgentConfigVersion(root, second.id)).status).toBe("approved");
    const pointer = JSON.parse(await readFile(path.join(root, ".forge", "config-versions", "approved.json"), "utf8"));
    expect(pointer.activeApprovedVersionId).toBe(second.id);
  });
  it("rejects traversal IDs and tampered snapshot contents", async () => {
    const root = await project();
    const version = await captureAgentConfigVersion(root);
    await expect(loadAgentConfigVersion(root, "../escape")).rejects.toThrow("Invalid configuration version ID");
    const file = path.join(root, ".forge", "config-versions", version.id + ".json");
    const parsed = JSON.parse(await readFile(file, "utf8"));
    parsed.files[0].content = "tampered";
    await writeFile(file, JSON.stringify(parsed));
    await expect(loadAgentConfigVersion(root, version.id)).rejects.toThrow("invalid file");
  });
  it("requires a workspace configuration to snapshot", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "forge-agent-config-empty-"));
    roots.push(root);
    await expect(captureAgentConfigVersion(root)).rejects.toThrow("No workspace agent or skill");
  });
});
