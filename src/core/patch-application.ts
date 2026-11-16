import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadReview } from "./review-history.js";
import { loadPatchApproval, verifyPatchApproval } from "./patch-approval.js";
import { validateReviewPatch } from "./patch-validation.js";

export interface PatchStageRecord {
  id: string;
  approvalId: string;
  reviewId: string;
  suggestionNumber: number;
  file: string;
  stagedFile: string;
  stagedAt: string;
  sourceSha256: string;
  stagedSha256: string;
}
function sha(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function parseHunks(patch: string, file: string) {
  const lines = patch.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== `--- a/${file}` || lines[1] !== `+++ b/${file}`) throw new Error("Patch headers do not match the approved target.");
  const hunks: { oldStart: number; oldCount: number; newCount: number; lines: string[] }[] = [];
  let current: { oldStart: number; oldCount: number; newCount: number; lines: string[] } | undefined;
  for (const line of lines.slice(2)) {
    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:.*)$/.exec(line);
    if (match) {
      current = { oldStart: Number(match[1]), oldCount: match[2] === undefined ? 1 : Number(match[2]), newCount: match[4] === undefined ? 1 : Number(match[4]), lines: [] };
      hunks.push(current);
    } else if (line.startsWith("\\ No newline at end of file")) {
      continue;
    } else if (line && current && [" ", "+", "-"].includes(line[0] ?? "")) {
      current.lines.push(line);
    } else if (line && !current) {
      throw new Error("Unexpected content outside patch hunks.");
    }
  }
  return hunks;
}
function applyUnifiedDiff(source: string, patch: string, file: string): string {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const hadFinalNewline = source.endsWith("\n");
  const input = source.replace(/\r\n/g, "\n").split("\n");
  if (hadFinalNewline) input.pop();
  const output: string[] = [];
  let cursor = 0;
  for (const hunk of parseHunks(patch, file)) {
    const start = hunk.oldStart === 0 ? 0 : hunk.oldStart - 1;
    if (start < cursor || start > input.length) throw new Error("Patch hunks overlap or exceed the source file.");
    output.push(...input.slice(cursor, start));
    cursor = start;
    let oldSeen = 0, newSeen = 0;
    for (const line of hunk.lines) {
      const marker = line[0];
      const value = line.slice(1);
      if (marker === " ") {
        if (input[cursor] !== value) throw new Error("Patch context changed during staging.");
        output.push(value); cursor++; oldSeen++; newSeen++;
      } else if (marker === "-") {
        if (input[cursor] !== value) throw new Error("Patch deletion does not match source during staging.");
        cursor++; oldSeen++;
      } else if (marker === "+") {
        output.push(value); newSeen++;
      }
    }
    if (oldSeen !== hunk.oldCount || newSeen !== hunk.newCount) throw new Error("Patch hunk line counts are inconsistent.");
  }
  output.push(...input.slice(cursor));
  const result = output.join(newline);
  return hadFinalNewline ? result + newline : result;
}

/** Applies an approved patch only to a new, isolated staging directory; the project remains untouched. */
export async function stageApprovedPatch(root: string, approvalId: string): Promise<PatchStageRecord> {
  const project = path.resolve(root);
  const approval = await loadPatchApproval(project, approvalId);
  const verified = await verifyPatchApproval(project, approvalId);
  if (!verified.valid) throw new Error("Patch staging refused: " + verified.reason);
  const review = await loadReview(project, approval.reviewId);
  const validation = await validateReviewPatch(project, review, approval.suggestionNumber);
  if (validation.status !== "applicable") throw new Error("Patch staging refused: " + validation.reason);
  const suggestion = review.ai?.suggestions[approval.suggestionNumber - 1];
  if (!suggestion?.patch || suggestion.file !== approval.file) throw new Error("Approved suggestion is missing or its target changed.");
  const sourcePath = path.resolve(project, approval.file);
  const relative = path.relative(project, sourcePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Patch target escapes the project.");
  const sourceReal = await realpath(sourcePath);
  const projectReal = await realpath(project);
  if (!sourceReal.startsWith(projectReal + path.sep)) throw new Error("Patch target resolves outside the project.");
  const info = await lstat(sourcePath);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error("Patch target is not a regular file.");
  const source = await readFile(sourceReal, "utf8");
  if (sha(source) !== approval.sourceSha256) throw new Error("Source changed after approval; create a new review and approval.");
  const patched = applyUnifiedDiff(source, suggestion.patch, approval.file);
  const id = "patch-stage-" + randomUUID();
  const stageRoot = path.join(project, ".forge", "patch-workspaces", id);
  const stagedFile = path.join(stageRoot, relative);
  await mkdir(path.dirname(stagedFile), { recursive: true });
  await writeFile(stagedFile, patched, { encoding: "utf8", flag: "wx", mode: 0o600 });
  const record: PatchStageRecord = {
    id, approvalId, reviewId: approval.reviewId, suggestionNumber: approval.suggestionNumber,
    file: approval.file, stagedFile: path.relative(project, stagedFile).split(path.sep).join("/"),
    stagedAt: new Date().toISOString(), sourceSha256: sha(source), stagedSha256: sha(patched),
  };
  await writeFile(path.join(stageRoot, "stage.json"), JSON.stringify(record, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
  return record;
}
