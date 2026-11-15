#!/usr/bin/env node

import path from "node:path";
import { initializeProject } from "./core/project-init.js";
import { formatArchitectureMap, mapArchitecture } from "./core/architecture-map.js";
import { formatProjectReport, inspectProject } from "./core/project-inspector.js";
import { loadAgentRegistry } from "./core/agent-registry.js";
import { createReviewPlan } from "./core/review-planner.js";
import { saveRun, listRuns, loadRun } from "./core/run-store.js";
import { advanceRun } from "./core/orchestrator.js";
import { OpenAICompatibleProvider } from "./core/openai-compatible-provider.js";
import { startDashboard } from "./core/dashboard-server.js";
import { auditProject, formatQualityAudit } from "./core/quality-audit.js";

const VERSION = "0.12.0";

const HELP = `
FORGE — The AI Engineering Workbench

Usage:
  forge <command> [options]

Commands:
  init [path]      Create a safe, local-first .forge starter workspace
  inspect [path]   Analyze project languages, tooling, dependencies, and scripts
  quality [path]   Generate an evidence-based static engineering quality report
  map [path]       Map source modules and import relationships
  agents [path]    List built-in and workspace agent roles
  plan --goal TEXT Create and save a reviewable draft plan
  run --goal TEXT  Run the plan using a configured AI provider
  runs [path]      List locally saved run history
  show-run ID      Display one saved run (use --path for project directory)
  dashboard [path] Start the local read-only web dashboard
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
  forge run --goal "Review the API design"
  forge runs .
  forge dashboard .
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
      const pathIndex = rest.indexOf("--path");
      const goalEnd = pathIndex >= 0 ? pathIndex : rest.length;
      const goal = goalIndex >= 0 ? rest.slice(goalIndex + 1, goalEnd).join(" ").trim() : "";
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".");
      try {
        const plan = createReviewPlan(goal);
        const saved = await saveRun(target, plan);
        process.stdout.write(`${JSON.stringify(plan, null, 2)}\\n`);
        process.stdout.write(`\\nDraft plan saved to ${path.relative(target, saved)}. No AI provider was called and no files or commands were executed.\\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE could not create a plan: ${message}\\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "runs": {
      const target = rest.find(arg => !arg.startsWith("--")) ?? ".";
      try {
        const runs = await listRuns(path.resolve(target));
        process.stdout.write(runs.length ? runs.map(run => `${run.id}  ${run.status.padEnd(18)} ${run.goal}`).join("\\n") + "\\n" : "No saved FORGE runs.\\n");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Could not list run history: ${message}\\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "show-run": {
      const id = rest.find(arg => !arg.startsWith("--")) ?? "";
      const pathIndex = rest.indexOf("--path");
      const target = pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".";
      try {
        if (!id) throw new Error("Usage: forge show-run RUN_ID [--path PROJECT]");
        const run = await loadRun(path.resolve(target), id);
        process.stdout.write(`${JSON.stringify(run, null, 2)}\\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Could not load run: ${message}\\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "run": {
      const goalIndex = rest.indexOf("--goal");
      const pathIndex = rest.indexOf("--path");
      const goalEnd = pathIndex >= 0 ? pathIndex : rest.length;
      const goal = goalIndex >= 0 ? rest.slice(goalIndex + 1, goalEnd).join(" ").trim() : "";
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".");
      try {
        const apiKey = process.env.FORGE_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
        const model = process.env.FORGE_MODEL ?? "gpt-4.1-mini";
        const baseUrl = process.env.FORGE_BASE_URL ?? "https://api.openai.com/v1";
        if (!apiKey) throw new Error("Set FORGE_API_KEY (or OPENAI_API_KEY) in your local environment before using forge run.");
        const provider = new OpenAICompatibleProvider({ apiKey, model, baseUrl });
        const plan = createReviewPlan(goal);
        process.stdout.write(`Starting ${plan.id} with provider ${provider.name} (model ${model})...\\n`);
        const completed = await advanceRun(plan, provider);
        const saved = await saveRun(target, completed);
        process.stdout.write(`Run status: ${completed.status}\\nSaved history: ${path.relative(target, saved)}\\n`);
        for (const task of completed.tasks) process.stdout.write(`  ${task.status.padEnd(18)} ${task.task.agent}: ${task.task.title}\\n`);
        if (completed.status === "failed") process.exitCode = 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE run failed: ${message}\\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "dashboard": {
      const target = path.resolve(rest.find(arg => !arg.startsWith("--")) ?? ".");
      const portIndex = rest.indexOf("--port");
      const portValue = portIndex >= 0 ? Number(rest[portIndex + 1]) : 4173;
      if (!Number.isInteger(portValue) || portValue < 0 || portValue > 65535) {
        process.stderr.write("Dashboard port must be an integer from 0 to 65535.\\n");
        process.exitCode = 1;
        return;
      }
      try {
        const dashboard = await startDashboard({ projectPath: target, port: portValue });
        const address = dashboard.server.address();
        const actualPort = address && typeof address !== "string" ? address.port : portValue;
        process.stdout.write(`FORGE dashboard: http://127.0.0.1:${actualPort}\\nProject: ${target}\\nPress Ctrl+C to stop.\\n`);
        const shutdown = () => dashboard.server.close(() => process.exit(0));
        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Could not start dashboard: ${message}\\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "quality": {
      if (rest.includes("--help")) {
        process.stdout.write("Usage: forge quality [path] [--json]\\n");
        return;
      }
      const json = rest.includes("--json");
      const target = rest.find(arg => !arg.startsWith("--")) ?? ".";
      try {
        const report = await auditProject(path.resolve(target));
        process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\\n` : `${formatQualityAudit(report)}\\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE quality audit failed: ${message}\\n`);
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
