import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { saveReview } from "../src/core/review-history.js";
import { approveReviewPatch } from "../src/core/patch-approval.js";
import { stageApprovedPatch, reviewStagedPatch } from "../src/core/patch-application.js";
import { verifyStagedPatch } from "../src/core/staged-verification.js";
import type { CodeReviewReport } from "../src/core/code-review.js";
import type { AIReviewResult } from "../src/core/ai-code-review.js";

describe("isolated approved patch staging", () => {
  let root = "";
  afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });
  async function fixture() {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-patch-stage-"));
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src/a.ts"), "const a = 1;\n");
    const report = {
      root, generatedAt: new Date().toISOString(), scope: "source-files" as const, base: "HEAD",
      filesReviewed: ["src/a.ts"], findings: [], summary: { high: 0, medium: 0, low: 0 }, warnings: [],
    } as CodeReviewReport;
    const ai = {
      provider: "mock",
      suggestions: [{
        file: "src/a.ts", line: 1, severity: "low" as const, title: "Change value",
        explanation: "Update value", recommendation: "Change a", confidence: "high" as const,
        patch: "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-const a = 1;\n+const a = 2;",
      }],
      warnings: [],
    } as AIReviewResult;
    const review = await saveReview(root, report, ai);
    const approval = await approveReviewPatch(root, review.id, 1, "reviewer");
    return approval;
  }
  it("stages the approved patch in a separate workspace without changing the project", async () => {
    const approval = await fixture();
    const staged = await stageApprovedPatch(root, approval.id);
    expect(staged.approvalId).toBe(approval.id);
    expect(await readFile(path.join(root, "src/a.ts"), "utf8")).toBe("const a = 1;\n");
    expect(await readFile(path.join(root, staged.stagedFile), "utf8")).toBe("const a = 2;\n");
    expect(staged.stagedFile).toContain(".forge/patch-workspaces/");
  });
  it("refuses staging when the source changed after approval", async () => {
    const approval = await fixture();
    await writeFile(path.join(root, "src/a.ts"), "const a = 3;\n");
    await expect(stageApprovedPatch(root, approval.id)).rejects.toThrow(/changed after approval|no longer applicable/);
  });

  it("reviews the staged diff and verifies source and staged hashes", async () => {
    const approval = await fixture();
    const staged = await stageApprovedPatch(root, approval.id);
    const review = await reviewStagedPatch(root, staged.id);
    expect(review.file).toBe("src/a.ts");
    expect(review.unchanged).toBe(false);
    expect(review.diff).toContain("-const a = 1;");
    expect(review.diff).toContain("+const a = 2;");
    expect(review.diff.split("\n")).toContain("-const a = 1;");
    expect(review.diff.split("\n")).toContain("+const a = 2;");
  });
  it("rejects a staged file modified after staging", async () => {
    const approval = await fixture();
    const staged = await stageApprovedPatch(root, approval.id);
    await writeFile(path.join(root, staged.stagedFile), "tampered");
    await expect(reviewStagedPatch(root, staged.id)).rejects.toThrow(/changed after staging/);
  });

  it("verifies the staged patch in a temporary snapshot and excludes environment files", async () => {
    const approval = await fixture();
    await writeFile(path.join(root, "package.json"), JSON.stringify({
      scripts: {
        check: "node -e \\"const fs=require('node:fs');if(!fs.readFileSync('src/a.ts','utf8').includes('a = 2'))process.exit(1);if(fs.existsSync('.env'))process.exit(2)\\""
      }
    }));
    await writeFile(path.join(root, ".env"), "SECRET=must-not-be-copied");
    const staged = await stageApprovedPatch(root, approval.id);
    const result = await verifyStagedPatch(root, staged.id, "check");
    expect(result.verification.status).toBe("passed");
    expect(result.file).toBe("src/a.ts");
    expect(result.stagedSha256).toBe(staged.stagedSha256);
    expect(result.snapshotFileCount).toBeGreaterThanOrEqual(2);
    expect(await readFile(path.join(root, "src/a.ts"), "utf8")).toBe("const a = 1;\\n");
  });

});
