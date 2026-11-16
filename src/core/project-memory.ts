import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export type ProjectMemoryKind = "decision" | "architecture" | "constraint" | "preference" | "fact";

export interface ProjectMemoryEntry {
  id: string;
  kind: ProjectMemoryKind;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface MemoryDocument {
  version: 1;
  entries: ProjectMemoryEntry[];
}

const MAX_ENTRIES = 500;
const MAX_CONTENT_LENGTH = 4000;
const SECRET_PATTERN = /(?:api[_-]?key|secret|password|access[_-]?token)\s*[:=]\s*\S+/i;

function memoryPath(projectPath: string): string {
  return path.join(path.resolve(projectPath), ".forge", "memory.json");
}

async function readDocument(projectPath: string): Promise<MemoryDocument> {
  try {
    const parsed: unknown = JSON.parse(await readFile(memoryPath(projectPath), "utf8"));
    if (!parsed || typeof parsed !== "object" || !("version" in parsed) || parsed.version !== 1 || !("entries" in parsed) || !Array.isArray(parsed.entries)) {
      throw new Error("Project memory file has an unsupported format.");
    }
    return parsed as MemoryDocument;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { version: 1, entries: [] };
    }
    throw error;
  }
}

async function writeDocument(projectPath: string, document: MemoryDocument): Promise<void> {
  const destination = memoryPath(projectPath);
  const directory = path.dirname(destination);
  await mkdir(directory, { recursive: true });
  const temporary = path.join(directory, ".memory-" + randomUUID() + ".tmp");
  try {
    await writeFile(temporary, JSON.stringify(document, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

function validateContent(content: string): string {
  const value = content.trim();
  if (!value) throw new Error("Memory content cannot be empty.");
  if (value.length > MAX_CONTENT_LENGTH) throw new Error(`Memory content must be at most ${MAX_CONTENT_LENGTH} characters.`);
  if (SECRET_PATTERN.test(value)) throw new Error("Memory appears to contain a credential. Store a reference to a secret name, never the secret value.");
  return value;
}

export async function addProjectMemory(
  projectPath: string,
  input: { kind: ProjectMemoryKind; content: string; tags?: string[] },
): Promise<ProjectMemoryEntry> {
  const content = validateContent(input.content);
  const document = await readDocument(projectPath);
  if (document.entries.length >= MAX_ENTRIES) throw new Error(`Project memory is limited to ${MAX_ENTRIES} entries. Remove old entries first.`);
  const now = new Date().toISOString();
  const entry: ProjectMemoryEntry = {
    id: "mem-" + randomUUID(),
    kind: input.kind,
    content,
    tags: [...new Set((input.tags ?? []).map(tag => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 12),
    createdAt: now,
    updatedAt: now,
  };
  document.entries.push(entry);
  await writeDocument(projectPath, document);
  return entry;
}

export async function listProjectMemory(projectPath: string): Promise<ProjectMemoryEntry[]> {
  const document = await readDocument(projectPath);
  return [...document.entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function removeProjectMemory(projectPath: string, id: string): Promise<boolean> {
  const document = await readDocument(projectPath);
  const remaining = document.entries.filter(entry => entry.id !== id);
  if (remaining.length === document.entries.length) return false;
  document.entries = remaining;
  await writeDocument(projectPath, document);
  return true;
}

/** Select relevant notes with a conservative character budget (~4 chars/token). */
export async function buildProjectMemoryContext(
  projectPath: string,
  query: string,
  maxTokens = 1800,
): Promise<{ text: string; includedIds: string[]; estimatedTokens: number }> {
  const safeBudget = Math.max(100, Math.min(8000, Math.floor(maxTokens)));
  const terms = new Set(query.toLowerCase().split(/[^a-z0-9_-]+/).filter(term => term.length > 2));
  const entries = await listProjectMemory(projectPath);
  const ranked = entries.map(entry => {
    const haystack = (entry.content + " " + entry.tags.join(" ")).toLowerCase();
    const score = entry.tags.reduce((sum, tag) => sum + (terms.has(tag) ? 4 : 0), 0)
      + [...terms].reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    return { entry, score };
  }).sort((a, b) => b.score - a.score || b.entry.updatedAt.localeCompare(a.entry.updatedAt));

  const lines: string[] = [];
  const includedIds: string[] = [];
  let chars = 0;
  for (const { entry } of ranked) {
    const line = `[${entry.kind}] ${entry.content}`;
    const next = chars + line.length + 1;
    if (next > safeBudget * 4) continue;
    lines.push(line);
    includedIds.push(entry.id);
    chars = next;
  }
  return {
    text: lines.length ? "Relevant project memory (local notes; verify against current code):\n" + lines.join("\n") : "",
    includedIds,
    estimatedTokens: Math.ceil(chars / 4),
  };
}
