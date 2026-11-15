#!/usr/bin/env node

import path from "node:path";
import { initializeProject } from "./core/project-init.js";
import { formatArchitectureMap, mapArchitecture } from "./core/architecture-map.js";
import { formatProjectReport, inspectProject } from "./core/project-inspector.js";
import { loadAgentRegistry } from "./core/agent-registry.js";
import { createReviewPlan } from "./core/review-planner.js";

const VERSION = "0.3.0";

const HELP = `
FORGE — The AI Engineering Workbench

Usage:
  forge <command> [options]

Commands:
  init [path]      Create a safe, local-first .forge starter workspace
  inspect [path]   Analyze project languages, tooling, dependencies, and scripts
  map [path]       Map source modules and import relationships
  agents [path]    List built-in and workspace agent roles
  plan --goal TEXT Create a reviewable, non-executing task plan
  version          Print the installed version
  help             Show this help message

Options:
  --json           Output machine-readable JSON
  --help           Show command usage

Examples:
  forge inspect .
  forge inspect ./my-app --json
  forge map .
  forge agents .
  forge plan --goal "Add authentication safely"
`.trim();

async function main(args: string[]): Promise<void> {
  const [command = "help", ...rest] = args;
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      process.stdout.write(`${HELP}\n`);
      return;
    case "version":
    case "--version":
    case "-v":
      process.stdout.write(`forge ${VERSION}\n`);
      return;
    case "init": {
      const target = rest.find(arg => !arg.startsWith("--")) ?? ".";
      try {
        const result = await initializeProject(path.resolve(target));
        process.stdout.write(`FORGE initialized in ${path.resolve(target)}\n`);
        for (const file of result.created) process.stdout.write(`  created  ${file}\n`);
        for (const file of result.skipped) process.stdout.write(`  kept     ${file} (already exists)\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE could not initialize this project: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "agents": {
      const target = rest.find(arg => !arg.startsWith("--")) ?? ".";
      try {
        const agents = await loadAgentRegistry(path.resolve(target));
        process.stdout.write("FORGE agent registry\\n\\n");
        for (const agent of agents) {
          process.stdout.write(`  ${agent.id.padEnd(20)} ${agent.name} [${agent.source}]\\n    ${agent.description}\\n`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE could not load agents: ${message}\\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "plan": {
      const goalIndex = rest.indexOf("--goal");
      const goal = goalIndex >= 0 ? rest.slice(goalIndex + 1).join(" ").trim() : "";
      try {
        const plan = createReviewPlan(goal);
        process.stdout.write(`${JSON.stringify(plan, null, 2)}\\n`);
        process.stdout.write("\\nThis is a deterministic draft plan. No AI provider was called and no files or commands were executed.\\n");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE could not create a plan: ${message}\\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "inspect":
    case "map": {
      if (rest.includes("--help")) {
        process.stdout.write(`Usage: forge ${command} [path] [--json]\n`);
        return;
      }
      const json = rest.includes("--json");
      const target = rest.find(arg => !arg.startsWith("--")) ?? ".";
      try {
        if (command === "inspect") {
          const report = await inspectProject(path.resolve(target));
          process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : `${formatProjectReport(report)}\n`);
        } else {
          const report = await mapArchitecture(path.resolve(target));
          process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : `${formatArchitectureMap(report)}\n`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE could not ${command} this project: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\nRun "forge help" to see available commands.\n`);
      process.exitCode = 1;
  }
}
void main(process.argv.slice(2));
