import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { listWorkspaceDirectory, readWorkspaceFile } from "../src/core/workspace-browser.js";

let root = "";
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = ""; });

describe("workspace browser", () => {
  it("lists safe directories and previews supported source files", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-workspace-"));
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src", "index.ts"), "export const answer = 42;\n");
    await writeFile(path.join(root, ".env"), "TOKEN=do-not-show");
    await mkdir(path.join(root, "node_modules"));
    const listing = await listWorkspaceDirectory(root);
    expect(listing.entries.map(item => item.name)).toContain("src");
    expect(listing.entries.map(item => item.name)).not.toContain(".env");
    expect(listing.entries.map(item => item.name)).not.toContain("node_modules");
    const preview = await readWorkspaceFile(root, "src/index.ts");
    expect(preview.content).toContain("answer = 42");
  });

  it("rejects traversal and sensitive files", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-workspace-"));
    await writeFile(path.join(root, ".env"), "SECRET=value");
    await expect(listWorkspaceDirectory(root, "../")).rejects.toThrow("inside the project");
    await expect(readWorkspaceFile(root, ".env")).rejects.toThrow();
  });

  it("rejects symlinks and oversized previews", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-workspace-"));
    const outside = path.join(root, "outside.ts");
    await writeFile(outside, "outside");
    await symlink(outside, path.join(root, "linked.ts"));
    await writeFile(path.join(root, "large.ts"), "x".repeat(129 * 1024));
    const listing = await listWorkspaceDirectory(root);
    expect(listing.entries.map(item => item.name)).not.toContain("linked.ts");
    await expect(readWorkspaceFile(root, "linked.ts")).rejects.toThrow();
    await expect(readWorkspaceFile(root, "large.ts")).rejects.toThrow("128 KiB");
  });

  it("blocks sensitive path segments even when the leaf filename looks harmless", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-workspace-"));
    await mkdir(path.join(root, "credentials"));
    await writeFile(path.join(root, "credentials", "notes.txt"), "private material");
    await expect(listWorkspaceDirectory(root, "credentials")).rejects.toThrow(/Sensitive workspace paths/);
    await expect(readWorkspaceFile(root, "credentials/notes.txt")).rejects.toThrow(/Sensitive workspace paths/);
  });

});
