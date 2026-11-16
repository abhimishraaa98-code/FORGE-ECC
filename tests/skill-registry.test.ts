import { mkdtemp, mkdir, rm, writeFile, symlink } from "node:fs/promises";
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
  it("loads legacy flat Markdown skills", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-skills-"));
    const dir = path.join(root, ".forge", "skills");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "api-contracts.md"), "# API Contracts\ntriggers: api, endpoint\n\nKeep API compatibility.");
    const selected = selectSkills(await loadSkillRegistry(root), "update the API endpoint");
    expect(selected.some(skill => skill.id === "api-contracts" && skill.source === "workspace")).toBe(true);
  });
  it("loads nested SKILL.md packages with frontmatter metadata", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-skills-"));
    const dir = path.join(root, ".forge", "skills", "backend", "api-design");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "SKILL.md"), "---\nname: API Design\ndescription: Design stable APIs\ntriggers: openapi, endpoint\ntags: rest, schema\nversion: 1.2.0\n---\n# API Design\n\nKeep contracts backwards compatible.");
    const skills = await loadSkillRegistry(root);
    const found = skills.find(skill => skill.id === "backend/api-design");
    expect(found?.name).toBe("API Design");
    expect(found?.version).toBe("1.2.0");
    expect(found?.triggers).toContain("openapi");
    expect(selectSkills(skills, "update openapi endpoint")).toContain(found);
  });
  it("rejects registries that exceed the skill-file limit instead of silently truncating", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-skills-"));
    const dir = path.join(root, ".forge", "skills");
    await mkdir(dir, { recursive: true });
    await Promise.all(Array.from({ length: 201 }, (_, index) =>
      writeFile(path.join(dir, `skill-${String(index).padStart(3, "0")}.md`), `# Skill ${index}`)
    ));
    await expect(loadSkillRegistry(root)).rejects.toThrow("exceeds the maximum of 200 files");
  });
  it("bounds directory traversal even when entries are ignored", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-skills-"));
    const dir = path.join(root, ".forge", "skills");
    await mkdir(dir, { recursive: true });
    await Promise.all(Array.from({ length: 5_001 }, (_, index) =>
      writeFile(path.join(dir, `.ignored-${String(index).padStart(4, "0")}`), "")
    ));
    await expect(loadSkillRegistry(root)).rejects.toThrow("exceeds the maximum of 5000 directory entries");
  });
  it("ignores symlinked skill files", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-skills-"));
    const dir = path.join(root, ".forge", "skills");
    await mkdir(dir, { recursive: true });
    const outside = path.join(root, "outside.md");
    await writeFile(outside, "# Exfiltration\ntriggers: secret");
    await symlink(outside, path.join(dir, "linked.md"));
    expect((await loadSkillRegistry(root)).some(skill => skill.id === "linked")).toBe(false);
  });
});
