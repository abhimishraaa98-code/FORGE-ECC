#!/usr/bin/env node
import path from "node:path";
import { realpath, stat } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { inspectProject } from "../core/project-inspector.js";
import { mapArchitecture } from "../core/architecture-map.js";
import { searchWorkspace } from "../core/code-search.js";

const WORKSPACE_ROOT = await realpath(process.env.FORGE_WORKSPACE ?? process.cwd());

async function resolveWorkspace(input?: string): Promise<string> {
  const candidate = await realpath(path.resolve(WORKSPACE_ROOT, input ?? "."));
  const relative = path.relative(WORKSPACE_ROOT, candidate);
  if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    throw new Error("Requested project path is outside the configured FORGE workspace.");
  }
  const info = await stat(candidate);
  if (!info.isDirectory()) throw new Error("Project path must be a directory.");
  return candidate;
}

function result(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function failure(error: unknown) {
  return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : "FORGE tool failed." }] };
}

const server = new McpServer({
  name: "forge-engineering-workbench",
  version: "0.35.0"
});

server.registerTool(
  "forge_inspect_project",
  {
    title: "Inspect project",
    description: "Read-only inventory of a project: languages, frameworks, package managers, scripts, dependencies and detected warnings. Does not execute project code.",
    inputSchema: z.object({ projectPath: z.string().optional().describe("Workspace-relative directory. Defaults to the configured workspace root.") })
  },
  async ({ projectPath }) => {
    try {
      const root = await resolveWorkspace(projectPath);
      return result(await inspectProject(root));
    } catch (error) { return failure(error); }
  }
);

server.registerTool(
  "forge_map_architecture",
  {
    title: "Map architecture",
    description: "Read-only map of source files, internal imports, entry points and external packages. Does not execute project code.",
    inputSchema: z.object({ projectPath: z.string().optional().describe("Workspace-relative directory. Defaults to the configured workspace root.") })
  },
  async ({ projectPath }) => {
    try {
      const root = await resolveWorkspace(projectPath);
      return result(await mapArchitecture(root));
    } catch (error) { return failure(error); }
  }
);

server.registerTool(
  "forge_search_code",
  {
    title: "Search code",
    description: "Search source identifiers and text in a project. Secret-like filenames, hidden directories, dependencies and generated output are excluded by the underlying scanner.",
    inputSchema: z.object({
      query: z.string().min(2).max(120),
      projectPath: z.string().optional().describe("Workspace-relative directory. Defaults to the configured workspace root."),
      limit: z.number().int().min(1).max(100).optional()
    })
  },
  async ({ query, projectPath, limit }) => {
    try {
      const root = await resolveWorkspace(projectPath);
      return result(await searchWorkspace(root, query, limit ?? 40));
    } catch (error) { return failure(error); }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
