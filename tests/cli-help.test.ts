import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runCli(...args: string[]): string {
  return execFileSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

describe("run-history CLI help", () => {
  it("prints runs usage without reading project history", () => {
    expect(runCli("runs", "--help")).toContain("Usage: forge runs [path] [--json]");
  });

  it("documents the versioned JSON option", () => {
    expect(runCli("runs", "--help")).toContain("versioned machine-readable summary");
  });

  it("prints show-run usage without requiring a run ID", () => {
    expect(runCli("show-run", "--help")).toContain("Usage: forge show-run RUN_ID [--path PROJECT]");
  });
});
