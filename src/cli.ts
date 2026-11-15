#!/usr/bin/env node

import path from "node:path";
import { initializeProject } from "./core/project-init.js";
import { formatArchitectureMap, mapArchitecture } from "./core/architecture-map.js";
import { formatProjectReport, inspectProject } from "./core/project-inspector.js";

const VERSION = "0.2.0";

const HELP = `
FORGE — The AI Engineering Workbench

Usage:
  forge <command> [options]

Commands:
  init [path]      Create a safe, local-first .forge starter workspace\n  inspect [path]   Analyze project languages, tooling, dependencies, and scripts
  map [path]       Map source modules and import relationships
  version          Print the installed version
  help             Show this help message

Options:
  --json           Output machine-readable JSON
  --help           Show command usage

Examples:
  forge inspect .
  forge inspect ./my-app --json
  forge map .
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
