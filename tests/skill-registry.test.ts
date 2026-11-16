import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { formatSkillContext, loadSkillRegistry, selectSkills } from "../src/core/skill-registry.js";

describe("skill registry", () => {
  let root = "";
  afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = ""; });
  it("selects relevant built-in skills and formats their guidance", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-skills-"));
    const skills = await loadSkillRegistry(root);
    const selected = selectSkills(skills, "implement secure authentication and verify tests");
    expect(selected.map(skill => skill.id)).toContain("secure-changes");
    expect(selected.map(skill => skill.id)).toContain("verification-loop");
    expect(formatSkillContext(selected)).toContain("least privilege");
  });
  it("loads and selects workspace skills", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-skills-"));
    const dir = path.join(root, ".forge", "skills");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "api-contracts.md"), "# API Contracts\ntriggers: api, endpoint\n\nKeep API compatibility.");
    const selected = selectSkills(await loadSkillRegistry(root), "update the API endpoint");
    expect(selected.some(skill => skill.id === "api-contracts" && skill.source === "workspace")).toBe(true);
  });
});
