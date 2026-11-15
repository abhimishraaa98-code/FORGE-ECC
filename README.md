# FORGE

### The AI Engineering Workbench

**Understand the codebase. Plan the change. Verify the result.**

FORGE is an independent, open-source engineering workbench for developers. It is being built around a simple principle: AI-assisted engineering should understand a project before proposing changes, show evidence for its conclusions, and keep developers in control.

> FORGE is an original implementation. It is not a fork, rebrand, or continuation of another toolkit.

## What works today

### Project Intelligence

The first FORGE capability scans a local project and reports:

- Source-file counts grouped by recognized language
- Common package managers and project manifests
- Detected frameworks and developer tools
- Production and development dependency counts
- Available npm scripts
- Important configuration and documentation files
- Scan notes, including file-limit and local environment-file warnings

The scanner skips common generated and dependency directories, including `node_modules`, `.git`, `dist`, and `build`. It has a 5,000-file safety limit.

## Quick start

Requirements: Node.js 22 or newer and npm.

```bash
git clone https://github.com/ansh44233/FORGE-ECC.git
cd FORGE-ECC
npm install
npm run dev -- inspect .
```

Print machine-readable JSON:

```bash
npm run dev -- inspect . --json
```

Build and run the compiled CLI:

```bash
npm run build
node dist/cli.js inspect .
```

## Commands

| Command | Purpose |
| --- | --- |
| `forge help` | Show CLI help |
| `forge version` | Show version |
| `forge inspect [path]` | Inspect a project |
| `forge inspect [path] --json` | Output JSON |

During development, use `npm run dev --` before the command. After building, use the `forge` executable or `node dist/cli.js`.

## Engineering principles

- **Understand before changing:** inspect project structure and conventions first.
- **Evidence over confidence:** distinguish detected facts from assumptions.
- **Human control:** potentially destructive actions must be reviewable and explicitly approved.
- **Local-first foundations:** do not transmit project data unless an integration is deliberately configured.
- **Composable architecture:** keep the core small and integrations replaceable.
- **Honest status:** roadmap features are never presented as already implemented.

## Roadmap

| Area | Planned direction |
| --- | --- |
| Project Intelligence | Deeper architecture mapping, entry-point discovery, dependency insights |
| Planning Engine | Turn goals into reviewable, file-aware implementation plans |
| Quality Engine | Run project checks and summarize actual command output |
| Agent Orchestration | Coordinate specialist roles through explicit task contracts |
| Project Memory | Store decisions and conventions locally with user control |
| Integrations | Connect supported coding agents and developer tools |

Roadmap items are plans, not claims of existing functionality.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

GitHub Actions runs typechecking, tests, and a production build for pushes and pull requests targeting `main`.

## Security

FORGE is early-stage software. Its project scanner reads local file names and selected project metadata; it does not execute scanned project files. Reports are not security audits and do not guarantee that a project is safe.

Never commit API keys, credentials, or private project data. See [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development expectations and contribution guidance.

## License

MIT. See [LICENSE](LICENSE).
