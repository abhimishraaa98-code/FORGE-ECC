import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  source: "builtin" | "workspace";
  filePath?: string;
  instructions: string;
}

const BUILT_INS: AgentDefinition[] = [
  { id: "planner", name: "Planner", description: "Break goals into reviewable tasks.", source: "builtin", instructions: "Create a sequenced plan with scope, assumptions, risks, and acceptance criteria." },
  { id: "architect", name: "Architect", description: "Evaluate boundaries, interfaces, and trade-offs.", source: "builtin", instructions: "Inspect the current design, then propose the smallest maintainable architecture." },
  { id: "code-reviewer", name: "Code Reviewer", description: "Find defects and regressions in proposed changes.", source: "builtin", instructions: "Review correctness, security, data integrity, performance, and test quality." },
  { id: "test-engineer", name: "Test Engineer", description: "Design verification strategies and test cases.", source: "builtin", instructions: "Identify normal, boundary, and failure cases; report only checks actually run." },
  { id: "security-reviewer", name: "Security Reviewer", description: "Review trust boundaries and unsafe defaults.", source: "builtin", instructions: "Review input validation, permissions, secrets, filesystem, process, and network boundaries." },
  { id: "debugger", name: "Debugger", description: "Trace defects from symptoms to likely root causes.", source: "builtin", instructions: "Build a hypothesis-led diagnosis. Cite relevant evidence, distinguish facts from hypotheses, and propose minimal fixes. Never claim to have run a reproducer unless it was actually run." },
  { id: "performance-engineer", name: "Performance Engineer", description: "Identify performance bottlenecks and measurement strategies.", source: "builtin", instructions: "Review algorithmic complexity, I/O, caching, concurrency, memory and bundle/runtime costs. Prefer measurable hypotheses and benchmarks over guesses." },
  { id: "documentation-writer", name: "Documentation Writer", description: "Improve developer-facing documentation and examples.", source: "builtin", instructions: "Identify missing, stale or confusing documentation. Propose concise docs, examples and migration notes that match verified behavior." },
  { id: "devops-engineer", name: "DevOps Engineer", description: "Review build, CI, release and deployment reliability.", source: "builtin", instructions: "Review scripts, CI workflows, reproducibility, release process and deployment assumptions. Do not claim a workflow passed without run evidence." },
  { id: "database-reviewer", name: "Database Reviewer", description: "Review data models, queries and migration safety.", source: "builtin", instructions: "When data persistence exists, review schema design, query patterns, indexing, consistency, migrations, rollback and data-loss risks. State when no database is present." },
  { id: "accessibility-reviewer", name: "Accessibility Reviewer", description: "Review UI accessibility and inclusive interaction.", source: "builtin", instructions: "When a user interface exists, review semantics, keyboard access, focus, labels, contrast and reduced-motion support. State when the project has no UI." },
  { id: "release-manager", name: "Release Manager", description: "Prepare release readiness and change summaries.", source: "builtin", instructions: "Synthesize completed review evidence into release notes, compatibility risks, rollout checks and a go/no-go recommendation. Separate verified facts from open questions." },
];

function titleFromMarkdown(content: string, fallback: string): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback;
}

function descriptionFromMarkdown(content: string, title: string): string {
  const paragraph = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line.length > 0 && !line.startsWith("#") && !line.startsWith("-") && !line.startsWith("1."));
  return paragraph || `Workspace instructions for ${title}.`;
}

export async function loadAgentRegistry(projectPath: string): Promise<AgentDefinition[]> {
  const root = path.resolve(projectPath);
  const agentDirectory = path.join(root, ".forge", "agents");
  const definitions = new Map(BUILT_INS.map(agent => [agent.id, agent]));

  let entries;
  try {
    entries = await readdir(agentDirectory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [...definitions.values()].sort((a, b) => a.id.localeCompare(b.id));
    }
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const id = path.basename(entry.name, ".md");
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) continue;
    const filePath = path.join(agentDirectory, entry.name);
    const instructions = await readFile(filePath, "utf8");
    const name = titleFromMarkdown(instructions, id);
    definitions.set(id, {
      id,
      name,
      description: descriptionFromMarkdown(instructions, name),
      source: "workspace",
      filePath,
      instructions,
    });
  }

  return [...definitions.values()].sort((a, b) => a.id.localeCompare(b.id));
}
