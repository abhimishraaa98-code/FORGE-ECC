# FORGE

### The AI Engineering Workbench

**Understand the codebase. Map its architecture. Plan the change. Verify the result.**

FORGE is an independent, open-source engineering workbench for developers. It is being built around a simple principle: AI-assisted engineering should understand a project before proposing changes, show evidence for its conclusions, and keep developers in control.

> FORGE is an original implementation. It is not a fork, rebrand, or continuation of another toolkit.

## Capabilities

### 1. Project Intelligence — available

Inspect a local project and report:

- Source-file counts grouped by recognized language
- Common package managers and project manifests
- Detected frameworks and developer tools
- Production and development dependency counts
- Available npm scripts
- Important configuration and documentation files
- Scan notes, including file-limit and local environment-file warnings

### 2. Architecture Map — available (early)

Build a static map of JavaScript and TypeScript source files:

- Likely entry points and standalone modules
- Relative import relationships between files
- External package imports
- File roles and line counts
- JSON output for downstream tools

This is a heuristic source map, not a compiler-level dependency graph. Path aliases, generated modules, and dynamic imports assembled at runtime may not resolve.

### Orchestration Core — available (early library API)

The first orchestration foundation is now in `src/core/orchestrator.ts`:

- Typed task contracts and dependency-aware execution order
- Validation for duplicate IDs, missing dependencies, and dependency cycles
- Provider abstraction so model vendors can be integrated independently
- Explicit per-task approval gates before provider submission
- Run events, task results, and failure/blocking states
- Deterministic offline demo provider for development and tests

This is an orchestration library foundation, not yet a connected AI-agent product. The demo provider produces clearly labelled proposals; FORGE does not execute shell commands, modify project files, or contact an AI service. CLI controls, persistent run history, and real provider adapters remain future work.

## Quick start

Requirements: Node.js 22 or newer and npm.

```bash
git clone https://github.com/ansh44233/FORGE-ECC.git
cd FORGE-ECC
npm install
```

Create a local FORGE workspace (existing files are never overwritten):

\`\`\`bash
npm run dev -- init .
\`\`\`

This creates a `.forge/` directory with starter agent roles, reusable workflow skills, a project configuration, and a memory guide. These are local prompt/workflow assets; they do not launch autonomous agents or call an AI provider.

Inspect a project:

```bash
npm run dev -- inspect .
npm run dev -- inspect . --json
```

Map its architecture:

```bash
npm run dev -- map .
npm run dev -- map . --json
```

Build and run the compiled CLI:

```bash
npm run build
node dist/cli.js inspect .
node dist/cli.js map .
```

## CLI reference

| Command | Purpose |
| --- | --- |
| `forge help` | Show CLI help |
| `forge version` | Show installed version |
| `forge init [path]` | Create a local `.forge/` workspace without overwriting files |
| `forge inspect [path]` | Inspect languages, tooling, dependencies, and scripts |
| `forge map [path]` | Map JavaScript/TypeScript modules and imports |
| Add `--json` | Emit machine-readable JSON |

During development, prefix commands with `npm run dev --`. After building, use the `forge` executable or `node dist/cli.js`.

## Engineering principles

- **Understand before changing:** inspect project structure and conventions first.
- **Evidence over confidence:** distinguish detected facts from assumptions.
- **Human control:** potentially destructive actions must be reviewable and explicitly approved.
- **Local-first foundations:** do not transmit project data unless an integration is deliberately configured.
- **Composable architecture:** keep the core small and integrations replaceable.
- **Honest status:** roadmap features are never presented as already implemented.

## Roadmap

| Area | Direction |
| --- | --- |
| Project Intelligence | Deeper language support, entry-point discovery, dependency insights |
| Planning Engine | Turn goals into reviewable, file-aware implementation plans |
| Quality Engine | Run project checks and summarize actual command output |
| Agent Orchestration | Add CLI controls, persistent run history, and real provider adapters |
| Project Memory | Store decisions and conventions locally with user control |
| Integrations | Connect supported coding agents and developer tools |
| Web Workbench | Visualize project intelligence, plans, and verified results |

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

FORGE is early-stage software. Its scanners read local file names and selected source/project metadata; they do not execute scanned project files. Reports are not security audits and do not guarantee that a project is safe.

Never commit API keys, credentials, or private project data. See [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development expectations and contribution guidance.

## License

MIT. See [LICENSE](LICENSE).
