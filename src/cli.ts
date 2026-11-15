#!/usr/bin/env node

const VERSION = "0.1.0";

const HELP = `
FORGE — The AI Engineering Workbench

Usage:
  forge <command>

Commands:
  help       Show this help message
  version    Print the installed version

More capabilities will be introduced as independently tested modules.
`.trim();

function main(args: string[]): void {
  const command = args[0] ?? "help";

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      process.stdout.write(`${HELP}\n`);
      break;
    case "version":
    case "--version":
    case "-v":
      process.stdout.write(`forge ${VERSION}\n`);
      break;
    default:
      process.stderr.write(`Unknown command: ${command}\nRun "forge help" to see available commands.\n`);
      process.exitCode = 1;
  }
}

main(process.argv.slice(2));
