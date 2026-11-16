import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runVerification, type VerificationResult } from "./verification.js";
import { fingerprintStagedWorkspace, type PatchStageRecord } from "./patch-application.js";

const MAX_FILES = 20_000;
const MAX_BYTES = 256 * 1024 * 1024;
const EXCLUDED_DIRS = new Set([".git", ".forge", ".next", ".turbo", "coverage", "node_modules", "dist", "build", ".cache", ".vercel"]);
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

function digest(value: string | Uint8Array): string {
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
  if (!/^patch-stage-[a-f0-9-]{20,40}$/.test(stageId) || stageId.includes("..")) throw new Error("Invalid patch stage identifier.");
  const stageRoot = path.join(project, ".forge", "patch-workspaces", stageId);
  const stageReal = await realpath(stageRoot);
  if (!stageReal.startsWith(project + path.sep)) throw new Error("Patch stage resolves outside the project.");
  const manifestPath = path.join(stageReal, "stage.json");
  const manifestInfo = await lstat(manifestPath);
  if (manifestInfo.isSymbolicLink() || !manifestInfo.isFile()) throw new Error("Stage manifest must be a regular file.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as PatchStageRecord;
  if (manifest.id !== stageId || typeof manifest.workspacePath !== "string" ||
      typeof manifest.workspaceSha256 !== "string" || typeof manifest.stagedSha256 !== "string" ||
      typeof manifest.file !== "string") throw new Error("Stage manifest does not contain a verified workspace snapshot.");
  const workspacePath = path.resolve(project, manifest.workspacePath);
  const workspaceRelative = path.relative(stageReal, workspacePath);
  if (!workspaceRelative || workspaceRelative.startsWith("..") || path.isAbsolute(workspaceRelative)) throw new Error("Staged workspace path escapes its stage directory.");
  const workspaceReal = await realpath(workspacePath);
  if (!workspaceReal.startsWith(stageReal + path.sep)) throw new Error("Staged workspace resolves outside its stage directory.");
  const snapshotFingerprint = await fingerprintStagedWorkspace(workspaceReal);
  if (snapshotFingerprint.sha256 !== manifest.workspaceSha256 ||
      snapshotFingerprint.files !== manifest.snapshotFiles || snapshotFingerprint.bytes !== manifest.snapshotBytes) {
    throw new Error("Staged workspace changed after staging; refusing verification.");
  }
  const stagedSource = path.resolve(project, manifest.stagedFile);
  const stagedRelative = path.relative(workspaceReal, stagedSource);
  if (!stagedRelative || stagedRelative.startsWith("..") || path.isAbsolute(stagedRelative)) throw new Error("Staged patch file escapes the workspace.");
  const stagedInfo = await lstat(stagedSource);
  if (stagedInfo.isSymbolicLink() || !stagedInfo.isFile()) throw new Error("Staged patch target must be a regular file.");
  const stagedContent = await readFile(stagedSource);
  if (digest(stagedContent) !== manifest.stagedSha256) throw new Error("Staged patch changed while preparing verification.");
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "forge-staged-verify-"));
  const snapshot = path.join(temporaryRoot, "workspace");
  try {
    const counts = await copySnapshot(workspaceReal, snapshot);
    const copiedFingerprint = await fingerprintStagedWorkspace(snapshot);
    if (copiedFingerprint.sha256 !== manifest.workspaceSha256) throw new Error("Temporary verification copy does not match the approved staged snapshot.");
    const verification = await runVerification(snapshot, script, options);
    const id = "patch-verify-" + verification.id.slice("verify-".length);
    return {
      id, stageId, file: manifest.file,
      sourceSha256: manifest.sourceSha256,
      stagedSha256: manifest.stagedSha256,
      snapshotFileCount: counts.files,
      snapshotBytes: counts.bytes,
      verification,
      verifiedAt: new Date().toISOString(),
    };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
