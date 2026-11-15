#!/usr/bin/env node

import path from "node:path";
import { formatProjectReport, inspectProject } from "./core/project-inspector.js";

const VERSION = "0.1.0";

const HELP = `
FORGE — The AI Engineering Workbench

Usage:
  forge <command> [options]

Commands:
  inspect [path]   Analyze a project and print an architecture snapshot
  version          Print the installed version
  help             Show this help message

Inspect options:
  --json           Output the report as JSON
  --help           Show inspect usage

Examples:
  forge inspect .
  forge inspect ./my-app --json
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
    case "inspect": {
      if (rest.includes("--help")) {
        process.stdout.write("Usage: forge inspect [path] [--json]\n");
        return;
      }
      const json = rest.includes("--json");
      const target = rest.find(arg => !arg.startsWith("--")) ?? ".";
      try {
        const report = await inspectProject(path.resolve(target));
        process.stdout.write(json
          ? `${JSON.stringify(report, null, 2)}\n`
          : `${formatProjectReport(report)}\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE could not inspect this path: ${message}\n`);
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
