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

### Verification Engine — available (early)

Use `forge verify --list` to discover package scripts without running them. Choose one explicitly with `forge verify test` or `forge verify build --path ./project`. FORGE captures the selected script's output, exit code, duration, timestamps, and final status. The result is based on the process exit code—not a static prediction.

Safety boundaries:
- No script runs during discovery; execution requires a named script.
- Lifecycle hooks named `pre*` and `post*` are excluded from discovery and cannot be selected directly.
- No dependency installation or automatic script selection.
- A selected package script can itself run arbitrary project commands. Review the script in `package.json` before executing it, and use a trusted project directory.
- Output capture is capped at 64 KiB and execution timeout defaults to two minutes.
- Every completed run is saved under `.forge/verifications/` as a local JSON record. `forge verify-history` lists recent runs; `forge verify-history --path ./project` targets another project.
- Each new result is compared with the previous run of the same script and marked baseline, regression, improvement, or unchanged. Comparisons currently use pass/fail status, not flaky-test analysis or semantic output diffs.

### Git Intelligence — available (early)

Run `forge git [path]` to compare the working tree with `HEAD`, include untracked non-ignored files, estimate downstream impact using the static import map, suggest candidate tests, and assign a heuristic risk label. Use `--base REV` to compare against another Git revision, `--path PROJECT` to select a project, and `--json` for structured output. The command does not modify files or execute tests. Risk labels and test suggestions are advisory; ignored files, renames, aliases, and runtime dependencies have known limitations.

### Deep Code Intelligence — available (early)

Run `forge deep [path]` to parse JavaScript/TypeScript source with the TypeScript AST and report named declarations, exported symbols, circular import groups, and transitive file-level change-impact candidates. JSON output is available with `--json`. Symbol discovery is syntax-based rather than type-checked; import resolution remains heuristic, so aliases and runtime dependencies may be missed. Impact is an estimate, not a guarantee.

### Project Health Center — available (early)

Generate a unified health snapshot with `forge health [path]` or `forge health . --json`. The report combines:
- Static quality score, grade, and severity counts
- Verification history and a success rate based on passed/failed runs
- Source-file, directory, and language metrics
- Static architecture graph metrics
- Historical quality-score snapshots saved under `.forge/health/`

Snapshots are generated when the report is requested; this is not continuous background monitoring. Verification timeouts and process-start errors are excluded from the success-rate denominator. The quality score is heuristic, and architecture data is based on statically detected imports.

### Quality Intelligence — available (early)

Run `forge quality [path]` to generate a static engineering quality report with:
- A transparent rule-based score and grade (not a certification)
- Evidence-backed findings with severity and recommended next steps
- Project metrics for manifests, source files, tests, and CI workflows
- Basic repository hygiene, test/CI presence, TypeScript strict-mode, lockfile, and local `.env` presence checks
- JSON output via `--json`

The scanner does not read `.env` contents, execute project code, install dependencies, run tests, or query vulnerability databases. A detected file is evidence of presence only; absence of a finding does not prove quality or security.

### Agent Registry and Planning — available (early)

- Built-in specialist roles for planning, architecture, code review, testing, and security
- Workspace Markdown agents in `.forge/agents/`, with local definitions overriding built-ins
- `forge agents [path]` to inspect the available roles
- `forge plan --goal "..." ` to create a deterministic, dependency-aware draft plan

The planning command is intentionally transparent: it creates a structured draft, not an AI-generated analysis. It does not execute commands or change project files.

### Orchestration Core — available (early library API)

The first orchestration foundation is now in `src/core/orchestrator.ts`:

- Typed task contracts and dependency-aware execution order
- Validation for duplicate IDs, missing dependencies, and dependency cycles
- Provider abstraction so model vendors can be integrated independently
- Explicit per-task approval gates before provider submission
- Run events, task results, and failure/blocking states
- Deterministic offline demo provider for development and tests

The orchestration engine coordinates text proposals only. It does not execute shell commands or apply file changes.

### Local Web Dashboard — available (early)

Start a read-only local dashboard with `forge dashboard [path]` (optional `--port 4173`). It displays project metrics, language composition, detected stack, the specialist-agent roster, saved runs, warnings, and an interactive source dependency graph. Select graph nodes to inspect detected imports and incoming relationships. The dashboard also polls saved run history for a read-only agent activity feed, per-task status view, and selectable run inspector showing provider results, human approval and rejection controls, and an audit trail without exposing original prompts. It also includes an engineering-quality panel backed by the static audit engine and a verification-history panel backed by actual saved command results; these panels refresh with the activity feed. Approval decisions are persisted locally with reviewer, timestamp, and optional reason. Approval does not itself execute tools or automatically resume a provider run. Its agent endpoint exposes only public metadata, not private instructions or local file paths. The server binds to `127.0.0.1` only. Project-data endpoints are read-only; the sole POST route records explicit local approval or rejection decisions, with same-origin checks and a bounded JSON body. It is not a public hosting server.

### Persistent Runs and AI Provider — available (early)

- Save and load run records under `.forge/runs/`
- List history with `forge runs [path]` and inspect a record with `forge show-run ID`
- `forge plan --goal "..." ` now saves the deterministic draft locally
- `forge run --goal "..." ` sends the staged specialist prompts through an OpenAI-compatible chat-completions endpoint
- Configure `FORGE_API_KEY`, `FORGE_MODEL`, and optionally `FORGE_BASE_URL` in your local environment
- Remote endpoints must use HTTPS; plain HTTP is permitted only for localhost development
- Provider responses are proposals only. FORGE does not run commands or write source files

Run history is local project data. Review it before committing or sharing it; task prompts and provider responses may contain proprietary code context. API keys are not written into run records.

## Quick start

Requirements: Node.js 22 or newer and npm.

```bash
git clone https://github.com/ansh44233/FORGE-ECC.git
cd FORGE-ECC
npm install
```

Create a local FORGE workspace (existing files are never overwritten):

```bash
npm run dev -- init .
```

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

Generate a quality report:

```bash
npm run dev -- quality .
npm run dev -- quality . --json
npm run dev -- health .
npm run dev -- health . --json
npm run dev -- deep .
npm run dev -- deep . --json
npm run dev -- git .
npm run dev -- git . --base main --json
```

Discover and explicitly run a verification check:

```bash
npm run dev -- verify --list
npm run dev -- verify test
npm run dev -- verify build --path ./my-app
```

Build and run the compiled CLI:

```bash
npm run build
node dist/cli.js inspect .
node dist/cli.js map .
node dist/cli.js agents .
node dist/cli.js plan --goal "Improve project reliability"
node dist/cli.js runs .
```

## CLI reference

| Command | Purpose |
| --- | --- |
| `forge help` | Show CLI help |
| `forge version` | Show installed version |
| `forge init [path]` | Create a local `.forge/` workspace without overwriting files |
| `forge inspect [path]` | Inspect languages, tooling, dependencies, and scripts |
| `forge quality [path]` | Generate a static quality report with evidence and recommendations |
| `forge health [path]` | Generate a combined project health report and save a snapshot |
| `forge deep [path]` | Analyze AST symbols, circular imports, and transitive file-level change impact |
| `forge git [path] [--base REV]` | Analyze working-tree changes, impact, test candidates, and heuristic risk |
| `forge verify --list [--path PROJECT]` | Discover npm scripts without executing them |
| `forge verify SCRIPT [--path PROJECT]` | Explicitly execute one selected npm script, save the result, and compare it with history |
| `forge verify-history [--path PROJECT]` | List recent locally saved verification results |
| `forge map [path]` | Map JavaScript/TypeScript modules and imports |
| `forge agents [path]` | List built-in and workspace agent roles |
| `forge plan --goal "..." ` | Create and save a deterministic draft task plan |
| `forge run --goal "..." ` | Run specialist prompts through a configured AI provider |
| `forge runs [path]` | List saved local run history |
| `forge show-run ID [--path PROJECT]` | Display a saved run |
| `forge dashboard [path] [--port PORT]` | Start the local read-only web dashboard |
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
