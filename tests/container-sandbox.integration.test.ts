import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runContainerVerification } from "../src/core/container-sandbox.js";

const image = process.env.FORGE_DOCKER_IMAGE;
let root = "";

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

describe.skipIf(!image)("real Docker sandbox integration", () => {
  it("runs the selected script and excludes credential files and symlinks from the snapshot", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-real-docker-"));
    const project = path.join(root, "project");
    await mkdir(path.join(project, "src"), { recursive: true });
    await mkdir(path.join(root, "outside"), { recursive: true });
    await writeFile(path.join(root, "outside", "outside-secret.txt"), "must not enter the container");
    await writeFile(path.join(project, "package.json"), JSON.stringify({
      name: "forge-docker-integration",
      version: "1.0.0",
      scripts: {
        test: "node -e \"const fs=require('node:fs');const checks={env:fs.existsSync('.env'),secret:fs.existsSync('src/private-token.txt'),link:fs.existsSync('src/external-link.txt')};console.log(JSON.stringify(checks));if(Object.values(checks).some(Boolean))process.exit(9)\""
      }
    }));
    await writeFile(path.join(project, ".env"), "FORGE_TEST_SECRET=do-not-copy");
    await writeFile(path.join(project, "src", "private-token.txt"), "do-not-copy");
    await symlink(path.join(root, "outside", "outside-secret.txt"), path.join(project, "src", "external-link.txt"), "file");

    const result = await runContainerVerification(project, "test", image!, {
      timeoutMs: 60_000,
      requireRootless: false
    });

    expect(result.status, result.output).toBe("passed");
    expect(result.output).toContain('"env":false');
    expect(result.output).toContain('"secret":false');
    expect(result.output).toContain('"link":false');
    expect(result.output).toContain("network=none");
    expect(result.output).toContain("readOnlyRoot=true");
    expect(result.output).toContain("capDrop=ALL");
  }, 90_000);
});
