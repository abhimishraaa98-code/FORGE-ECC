import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile, realpath } from "node:fs/promises";
import path from "node:path";

export interface AgentConfigFile {
  path: string;
  sha256: string;
  content: string;
}
export interface AgentConfigVersion {
  version: 1;
  id: string;
  createdAt: string;
  createdBy: string;
  note: string;
  status: "candidate" | "approved";
  approvedBy?: string;
  files: AgentConfigFile[];
}
export interface AgentConfigDiff {
  added: string[];
  changed: string[];
  removed: string[];
  unchanged: string[];
}
const SAFE_ID = /^cfg-[a-f0-9]{12}$/;
const MAX_FILE_BYTES = 128 * 1024;
const MAX_FILES = 100;

function rootDir(projectPath: string): string {
  return path.join(path.resolve(projectPath), ".forge", "config-versions");
}
function digest(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
function validateRelativePath(value: string): boolean {
  return /^(agents|skills)\/[a-z0-9][a-z0-9-]{0,63}\.md$/.test(value);
}
function validateVersion(value: unknown): AgentConfigVersion {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid agent configuration version.");
  const item = value as AgentConfigVersion;
  if (item.version !== 1 || !SAFE_ID.test(item.id) || typeof item.createdAt !== "string" ||
      typeof item.createdBy !== "string" || typeof item.note !== "string" ||
      (item.status !== "candidate" && item.status !== "approved") ||
      (item.approvedBy !== undefined && (typeof item.approvedBy !== "string" || item.approvedBy.length > 80)) ||
      !Array.isArray(item.files) || item.files.length > MAX_FILES) {
    throw new Error("Unsupported or malformed agent configuration version.");
  }
  const seen = new Set<string>();
  for (const file of item.files) {
    if (!file || !validateRelativePath(file.path) || seen.has(file.path) ||
        typeof file.content !== "string" || Buffer.byteLength(file.content, "utf8") > MAX_FILE_BYTES ||
        file.sha256 !== digest(file.content)) throw new Error("Agent configuration version contains an invalid file.");
    seen.add(file.path);
  }
  return item;
}
async function writeAtomic(destination: string, content: string): Promise<void> {
  const directory = path.dirname(destination);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, "." + randomUUID() + ".tmp");
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}
export async function captureAgentConfigVersion(projectPath: string, input: { createdBy?: string; note?: string } = {}): Promise<AgentConfigVersion> {
  const root = path.resolve(projectPath);
  const files: AgentConfigFile[] = [];
  for (const directory of ["agents", "skills"]) {
    const forgeDirectory = path.join(root, ".forge");
    const absolute = path.join(forgeDirectory, directory);
    let entries;
    try {
      const realRoot = await realpath(root);
      const realForge = await realpath(forgeDirectory);
      const realDirectory = await realpath(absolute);
      if (realForge !== path.join(realRoot, ".forge") || realDirectory !== path.join(realForge, directory)) throw new Error("Agent configuration directories must not be symbolic links.");
      entries = await readdir(absolute, { withFileTypes: true });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const relative = directory + "/" + entry.name;
      if (!validateRelativePath(relative)) continue;
      const content = await readFile(path.join(absolute, entry.name), "utf8");
      if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) throw new Error("Configuration file exceeds 128 KiB: " + relative);
      files.push({ path: relative, sha256: digest(content), content });
      if (files.length > MAX_FILES) throw new Error("Agent configuration snapshot exceeds 100 files.");
    }
  }
  files.sort((a,b) => a.path.localeCompare(b.path));
  if (!files.length) throw new Error("No workspace agent or skill Markdown files found under .forge/agents or .forge/skills.");
  const version: AgentConfigVersion = {
    version: 1, id: "cfg-" + randomUUID().replace(/-/g, "").slice(0,12),
    createdAt: new Date().toISOString(), createdBy: (input.createdBy ?? "local-user").slice(0,80),
    note: (input.note ?? "").slice(0,500), status: "candidate", files
  };
  const directory = rootDir(root);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeAtomic(path.join(directory, version.id + ".json"), JSON.stringify(version, null, 2) + "\n");
  return version;
}
export async function listAgentConfigVersions(projectPath: string): Promise<AgentConfigVersion[]> {
  const directory = rootDir(projectPath);
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  const versions: AgentConfigVersion[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !SAFE_ID.test(entry.name.replace(/\.json$/, "")) || !entry.name.endsWith(".json")) continue;
    versions.push(validateVersion(JSON.parse(await readFile(path.join(directory, entry.name), "utf8"))));
  }
  return versions.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
export async function loadAgentConfigVersion(projectPath: string, id: string): Promise<AgentConfigVersion> {
  if (!SAFE_ID.test(id)) throw new Error("Invalid configuration version ID.");
  return validateVersion(JSON.parse(await readFile(path.join(rootDir(projectPath), id + ".json"), "utf8")));
}
export async function approveAgentConfigVersion(projectPath: string, id: string, reviewer: string): Promise<AgentConfigVersion> {
  const current = await loadAgentConfigVersion(projectPath, id);
  const approved = { ...current, status: "approved" as const, approvedBy: reviewer.slice(0,80) };
  await writeAtomic(path.join(rootDir(projectPath), id + ".json"), JSON.stringify(approved, null, 2) + "\n");
  await writeAtomic(path.join(rootDir(projectPath), "approved.json"), JSON.stringify({ version: 1, activeApprovedVersionId: id, updatedAt: new Date().toISOString() }, null, 2) + "\n");
  return approved;
}
export function compareAgentConfigVersions(before: AgentConfigVersion, after: AgentConfigVersion): AgentConfigDiff {
  const a = new Map(before.files.map(file => [file.path, file.sha256]));
  const b = new Map(after.files.map(file => [file.path, file.sha256]));
  const added = [...b.keys()].filter(file => !a.has(file)).sort();
  const removed = [...a.keys()].filter(file => !b.has(file)).sort();
  const changed = [...b.keys()].filter(file => a.has(file) && a.get(file) !== b.get(file)).sort();
  const unchanged = [...b.keys()].filter(file => a.get(file) === b.get(file)).sort();
  return { added, changed, removed, unchanged };
}
export function formatAgentConfigVersion(version: AgentConfigVersion): string {
  return [
    "FORGE Agent Configuration Version",
    "ID: " + version.id,
    "Created: " + version.createdAt,
    "Author: " + version.createdBy,
    "Approved by: " + (version.approvedBy ?? "not approved"),
    "Status: " + version.status.toUpperCase(),
    "Note: " + (version.note || "none"),
    "Files: " + version.files.length,
    ...version.files.map(file => "  " + file.path + " · sha256 " + file.sha256.slice(0,16))
  ].join("\n");
}
