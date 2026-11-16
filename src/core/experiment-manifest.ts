import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);
export interface ExperimentManifest {
  version: 1;
  id: string;
  createdAt: string;
  fingerprint: string;
  source: { commit: string | null; dirty: boolean | null };
  runtime: { node: string; platform: string; architecture: string };
  inputs: { matrixId: string; matrixSha256: string; suiteId: string; suiteSha256: string; packageLockSha256: string | null };
  provider: { provider: string; model: string; baseUrlHost: string | null };
  configuration: { agentConfigFingerprints: Array<{ candidateId: string; configVersionId: string; fingerprint: string }> };
}
export interface ExperimentCompatibility {
  compatible: boolean;
  differences: string[];
}
function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
async function hashFile(file: string): Promise<string | null> {
  try { return sha256(await readFile(file)); }
  catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null; throw error; }
}
async function git(projectPath: string, args: string[]): Promise<string | null> {
  try { const result = await execFileAsync("git", args, { cwd: projectPath, timeout: 3000, maxBuffer: 64 * 1024 }); return result.stdout.trim(); }
  catch { return null; }
}
export async function captureExperimentManifest(input: {
  projectPath: string; matrixFile: string; suiteId: string; suite: unknown;
  matrixId: string; provider: string; model: string; baseUrl?: string;
  agentConfigFingerprints?: Array<{ candidateId: string; configVersionId: string; fingerprint: string }>;
}): Promise<ExperimentManifest> {
  const root = path.resolve(input.projectPath);
  const [commit, status, matrixSha256, packageLockSha256] = await Promise.all([
    git(root, ["rev-parse", "HEAD"]), git(root, ["status", "--porcelain"]),
    hashFile(path.resolve(input.matrixFile)), hashFile(path.join(root, "package-lock.json"))
  ]);
  const suiteSha256 = sha256(JSON.stringify(input.suite));
  const source = { commit, dirty: status === null ? null : status.length > 0 };
  const inputs = { matrixId: input.matrixId, matrixSha256: matrixSha256 ?? "unavailable", suiteId: input.suiteId, suiteSha256, packageLockSha256 };
  const provider = { provider: input.provider, model: input.model, baseUrlHost: input.baseUrl ? safeHost(input.baseUrl) : null };
  const configuration = { agentConfigFingerprints: [...(input.agentConfigFingerprints ?? [])].sort((a,b) => a.candidateId.localeCompare(b.candidateId)) };
  const canonical = JSON.stringify({ source, runtime: { node: process.version, platform: process.platform, architecture: process.arch }, inputs, provider, configuration });
  return { version: 1, id: "exp-" + randomUUID().replace(/-/g, "").slice(0,12), createdAt: new Date().toISOString(), fingerprint: sha256(canonical), source, runtime: { node: process.version, platform: process.platform, architecture: process.arch }, inputs, provider, configuration };
}
function safeHost(value: string): string | null {
  try { return new URL(value).host; } catch { return null; }
}
export function compareExperimentManifests(a: ExperimentManifest, b: ExperimentManifest): ExperimentCompatibility {
  const differences: string[] = [];
  if (a.source.commit !== b.source.commit) differences.push("Git commit differs.");
  if (a.source.dirty !== b.source.dirty) differences.push("Working-tree dirty state differs.");
  if (a.inputs.matrixSha256 !== b.inputs.matrixSha256) differences.push("Benchmark matrix file differs.");
  if (a.inputs.suiteSha256 !== b.inputs.suiteSha256) differences.push("Evaluation suite differs.");
  if (a.inputs.packageLockSha256 !== b.inputs.packageLockSha256) differences.push("package-lock.json differs.");
  if (a.provider.provider !== b.provider.provider || a.provider.model !== b.provider.model || a.provider.baseUrlHost !== b.provider.baseUrlHost) differences.push("Provider, model, or endpoint differs.");
  if (JSON.stringify(a.configuration.agentConfigFingerprints) !== JSON.stringify(b.configuration.agentConfigFingerprints)) differences.push("Agent/skill configuration snapshots differ.");
  if (a.runtime.node !== b.runtime.node || a.runtime.platform !== b.runtime.platform || a.runtime.architecture !== b.runtime.architecture) differences.push("Runtime environment differs.");
  return { compatible: differences.length === 0, differences };
}
export async function saveExperimentManifest(projectPath: string, manifest: ExperimentManifest): Promise<string> {
  const directory = path.join(path.resolve(projectPath), ".forge", "experiment-manifests");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const destination = path.join(directory, manifest.id + ".json");
  await writeFile(destination, JSON.stringify(manifest, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
  return destination;
}
export async function loadExperimentManifest(projectPath: string, id: string): Promise<ExperimentManifest> {
  if (!/^exp-[a-f0-9]{12}$/.test(id)) throw new Error("Invalid experiment manifest ID.");
  const value: unknown = JSON.parse(await readFile(path.join(path.resolve(projectPath), ".forge", "experiment-manifests", id + ".json"), "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid experiment manifest.");
  const item = value as ExperimentManifest;
  if (item.version !== 1 || item.id !== id || typeof item.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(item.fingerprint) || !item.source || !item.inputs || !item.provider || !item.runtime || !item.configuration) throw new Error("Malformed experiment manifest.");
  return item;
}
export function formatExperimentManifest(item: ExperimentManifest): string {
  return ["FORGE Experiment Manifest " + item.id, "Fingerprint: sha256:" + item.fingerprint, "Git: " + (item.source.commit ?? "unavailable") + " · working tree " + (item.source.dirty === null ? "unknown" : item.source.dirty ? "dirty" : "clean"), "Runtime: " + item.runtime.node + " · " + item.runtime.platform + "/" + item.runtime.architecture, "Matrix: " + item.inputs.matrixId + " · " + item.inputs.matrixSha256, "Suite: " + item.inputs.suiteId + " · " + item.inputs.suiteSha256, "Lockfile: " + (item.inputs.packageLockSha256 ?? "not found"), "Provider: " + item.provider.provider + " / " + item.provider.model + " · " + (item.provider.baseUrlHost ?? "default endpoint"), "Pinned configs: " + item.configuration.agentConfigFingerprints.length].join("\n");
}
