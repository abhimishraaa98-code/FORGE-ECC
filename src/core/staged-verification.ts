import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runVerification, type VerificationResult } from "./verification.js";
import { reviewStagedPatch, type PatchStageRecord } from "./patch-application.js";

const MAX_FILES = 20_000;
const MAX_BYTES = 256 * 1024 * 1024;
const EXCLUDED_DIRS = new Set([".git", ".forge", ".next", ".turbo", "coverage"]);
const SECRET_FILE = /^(?:\.env(?:\..*)?|\.npmrc|\.pypirc|\.netrc|id_rsa|id_ed25519|credentials(?:\..*)?)$/i;
const SECRET_EXTENSION = /\.(?:pem|key|p12|pfx)$/i;

export interface StagedVerificationResult {
  id: string;
  stageId: string;
  file: string;
  sourceSha256: string;
  stagedSha256: string;
  snapshotFileCount: number;
  snapshotBytes: number;
  verification: VerificationResult;
  verifiedAt: string;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function excluded(name: string): boolean {
  return EXCLUDED_DIRS.has(name) || SECRET_FILE.test(name) || SECRET_EXTENSION.test(name);
}

async function copySnapshot(source: string, destination: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  async function walk(from: string, to: string): Promise<void> {
    await mkdir(to, { recursive: true, mode: 0o700 });
    for (const name of await readdir(from)) {
      if (excluded(name)) continue;
      const input = path.join(from, name);
      const output = path.join(to, name);
      const info = await lstat(input);
      if (info.isSymbolicLink()) throw new Error("Staged verification does not support symbolic links; remove or replace the link before retrying.");
      if (info.isDirectory()) {
        await walk(input, output);
      } else if (info.isFile()) {
        files++;
        bytes += info.size;
        if (files > MAX_FILES) throw new Error("Project snapshot exceeds the 20,000-file limit.");
        if (bytes > MAX_BYTES) throw new Error("Project snapshot exceeds the 256 MiB limit.");
        await cp(input, output, { errorOnExist: true, force: false, preserveTimestamps: true });
      }
    }
  }
  await walk(source, destination);
  return { files, bytes };
}

/**
 * Runs one explicitly selected npm script against a temporary copy with the staged file overlaid.
 * Project scripts still execute on the local host; this is not an OS-level sandbox.
 */
export async function verifyStagedPatch(
  projectPath: string,
  stageId: string,
  script: string,
  options: { timeoutMs?: number } = {},
): Promise<StagedVerificationResult> {
  const project = await realpath(path.resolve(projectPath));
  const stageReview = await reviewStagedPatch(project, stageId);
  const stageRoot = path.join(project, ".forge", "patch-workspaces", stageId);
  const manifest = JSON.parse(await readFile(path.join(stageRoot, "stage.json"), "utf8")) as PatchStageRecord;
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "forge-staged-verify-"));
  const snapshot = path.join(temporaryRoot, "workspace");
  try {
    const counts = await copySnapshot(project, snapshot);
    const stagedSource = path.resolve(project, manifest.stagedFile);
    const stagedInfo = await lstat(stagedSource);
    if (stagedInfo.isSymbolicLink() || !stagedInfo.isFile()) throw new Error("Staged patch target must be a regular file.");
    const overlay = path.resolve(snapshot, manifest.file);
    const relative = path.relative(snapshot, overlay);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Staged patch target escapes the verification snapshot.");
    await mkdir(path.dirname(overlay), { recursive: true });
    const stagedContent = await readFile(stagedSource);
    if (digest(stagedContent) !== stageReview.stagedSha256) throw new Error("Staged patch changed while preparing verification.");
    await writeFile(overlay, stagedContent, { flag: "w", mode: 0o600 });
    const verification = await runVerification(snapshot, script, options);
    const id = "patch-verify-" + verification.id.slice("verify-".length);
    return {
      id, stageId, file: manifest.file,
      sourceSha256: stageReview.sourceSha256,
      stagedSha256: stageReview.stagedSha256,
      snapshotFileCount: counts.files,
      snapshotBytes: counts.bytes,
      verification,
      verifiedAt: new Date().toISOString(),
    };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
