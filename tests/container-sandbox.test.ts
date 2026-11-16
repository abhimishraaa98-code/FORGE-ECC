import { describe, expect, it } from "vitest";
import { buildContainerRunArgs } from "../src/core/container-sandbox.js";

const image = "node:22-alpine@sha256:" + "a".repeat(64);

describe("container sandbox arguments", () => {
  it("requires an immutable image digest", () => {
    expect(() => buildContainerRunArgs("/tmp/project", "node:22", "test", "forge-test"))
      .toThrow(/pinned by an immutable sha256 digest/);
  });

  it("disables networking and privilege escalation while bounding resources", () => {
    const args = buildContainerRunArgs("/tmp/project", image, "test", "forge-test");
    expect(args).toContain("--network=none");
    expect(args).toContain("--read-only");
    expect(args).toContain("--cap-drop=ALL");
    expect(args).toContain("--security-opt=no-new-privileges");
    expect(args).toContain("--pids-limit=128");
    expect(args).toContain("--memory=1g");
    expect(args).toContain("--cpus=2");
    expect(args).toContain("--pull=never");
    expect(args).toContain("npm");
    expect(args).toContain("test");
  });

  it("rejects lifecycle hooks and unsafe script names", () => {
    expect(() => buildContainerRunArgs("/tmp/project", image, "pretest", "forge-test"))
      .toThrow(/explicit package script/);
    expect(() => buildContainerRunArgs("/tmp/project", image, "../test", "forge-test"))
      .toThrow(/explicit package script/);
  });

  it("rejects comma-containing mount paths to avoid mount option injection", () => {
    expect(() => buildContainerRunArgs("/tmp/proj,ect", image, "test", "forge-test"))
      .toThrow(/cannot contain commas/);
  });
});
