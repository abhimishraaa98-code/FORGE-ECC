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

### Regression Intelligence — available (early)

Run `forge regression [path]` to compare the latest saved verification result for each script with its previous run, classify regressions, recoveries, persistent failures and stable checks, and inspect current Git changes, static downstream impact and suggested test targets. Use `--base REV` to select the Git comparison base and `--json` for machine-readable output.

This command is read-only: it does not run tests or change files. It relies on verification history created by explicit `forge verify SCRIPT` runs. Regression signals show outcome changes, not proof that a particular code change caused a failure. Failure signatures are simple output-line heuristics; suggested tests are not executed.

### Review History and Patch Proposals — available (early)

Every `forge review` run now saves a snapshot under `.forge/reviews/`. Use `forge review-history .` to list snapshots, `forge review-show REVIEW_ID --path .` to inspect one, and `forge review-compare REVIEW_ID_A REVIEW_ID_B --path .` to compare static findings between runs. Snapshots are local project data; inspect them before sharing.

With `forge review . --ai`, the provider may also return a **single-file unified diff proposal** attached to a finding. FORGE validates target file headers, unified-diff hunk structure, line counts, and source context with `forge patch-check REVIEW_ID N --path PROJECT`. This is a dry run: it detects stale proposals but does not apply patches or modify source files. It does not apply patches, stage changes, or overwrite source files. AI suggestions and patches are untrusted proposals: inspect them and independently test any manually applied change.

AI review sends selected source excerpts to your configured provider. Context is capped, and review output can be incomplete or incorrect.
### Deep Code Intelligence — available (early)

Run `forge deep [path]` to parse JavaScript/TypeScript source with the TypeScript AST and report named declarations, exported symbols, circular import groups, and transitive file-level change-impact candidates. JSON output is available with `--json`. Symbol discovery is syntax-based rather than type-checked; import resolution remains heuristic, so aliases and runtime dependencies may be missed. Impact is an estimate, not a guarantee.

### Engineering Intelligence Dashboard — available (early)

Start a local, read-only engineering control center with `forge dashboard .` (or `forge dashboard ./project --port 4173`). The responsive dashboard brings together:

- Project structure, detected stack, language composition, and specialist agent registry
- Saved orchestration runs, task activity, run inspection, and explicit human approval controls
- Interactive static architecture graph
- Project health snapshots, quality findings, and verification history
- Regression classifications across saved verification runs, plus current Git change context
- Saved code-review snapshots with finding summaries

The server binds to `127.0.0.1` and exposes local JSON endpoints for the dashboard. It does not automatically run project tests, apply patches, or make code changes. Human approval controls are limited to recorded workflow tasks. Quality, architecture, and regression signals are heuristic and should be reviewed in context.

### Interactive Workspace Explorer — available (early)

The dashboard includes a read-only file browser for supported source and documentation files. Browse project folders, inspect file sizes, and preview text in the browser without opening an external editor. The explorer omits hidden files and common generated/dependency directories, blocks likely secret-bearing filenames and key/certificate formats, rejects symbolic links and path traversal, and limits previews to 128 KiB. It is a convenience viewer, not a complete file manager; it does not edit, create, delete, or execute files.

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
npm run dev -- review .
npm run dev -- review . --base main --json
npm run dev -- review . --all
npm run dev -- review . --ai
npm run dev -- review-history .
npm run dev -- review-show REVIEW_ID --path .
npm run dev -- review-compare OLD_ID NEW_ID --path .\nnpm run dev -- patch-check REVIEW_ID 1 --path .
npm run dev -- regression .
npm run dev -- regression . --base main --json
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
| `forge review [path] [--base REV] [--all] [--ai]` | Run static review and optionally request provider-backed AI suggestions; saves a snapshot |\n| `forge review-history [path]` | List saved review snapshots |\n| `forge review-show ID --path PROJECT` | Display a saved review |\n| `forge review-compare A B --path PROJECT` | Compare findings between snapshots |\n| `forge patch-check ID N --path PROJECT` | Dry-run validate an AI patch against the current file without applying it |\n| `forge regression [path] [--base REV] [--json]` | Compare saved verification results and current Git change impact |
| `forge verify --list [--path PROJECT]` | Discover npm scripts without executing them |
| `forge verify SCRIPT [--path PROJECT]` | Explicitly execute one selected npm script, save the result, and compare it with history |
| `forge verify-history [--path PROJECT]` | List recent locally saved verification results |
| `forge map [path]` | Map JavaScript/TypeScript modules and imports |
| `forge agents [path]` | List built-in and workspace agent roles |
| `forge plan --goal "..." ` | Create and save a deterministic draft task plan |
| `forge run --goal "..." ` | Run specialist prompts through a configured AI provider |
| `forge runs [path]` | List saved local run history |
| `forge show-run ID [--path PROJECT]` | Display a saved run |
| `forge dashboard [path] [--port PORT]` | Start the local engineering intelligence dashboard on loopback |
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


## Code Search & Symbol Intelligence (v0.27.0)

Search source files from the dashboard or CLI. Results include file paths, line/column positions, source snippets, and TypeScript AST-based declaration/reference classification. The scanner skips hidden files, common generated/dependency directories, sensitive filename patterns, symlinks, and files larger than 256 KiB.

```bash
forge search calculateTotal --path .
```


### Dependency & Change Impact Intelligence — available (early, v0.27.0)

Run `forge impact [path]` to compare the working tree with `HEAD`, map changed files to downstream importers, inspect direct npm dependencies, identify external imports missing from `package.json`, flag possible unused declarations, compare manifest dependency changes with a Git base, and check npm v2/v3 lockfile root metadata. Use `--base REV` and `--json` for comparison and machine-readable output.

The report is static and advisory. It does not query registries, install packages, audit vulnerabilities, or prove that a dependency is unused. Dynamic imports, aliases, configuration/plugin usage, runtime loading, and non-npm ecosystems may not be fully represented.

```bash
npm run dev -- impact .
npm run dev -- impact . --base main --json
```


### Visual Dependency Graph & Risk Explorer — v0.28.0

The local dashboard now includes an interactive file-to-package dependency graph. Filter by file/package name, isolate risk signals, and select a node to inspect its status and connected relationships. The graph distinguishes declared packages, undeclared imports, and possible unused declarations, and reports when display limits apply.

Start with `npm run dev -- dashboard .` and open the local dashboard. The graph is generated from static import scanning and package.json; it is an exploration aid, not a complete runtime dependency graph or a recommendation to remove packages. Aliases, computed dynamic imports, configuration/plugin use, and generated/runtime loading can be missed.


### Engineering Risk Intelligence — v0.29.0

Run `forge risk .` (or `forge risk . --json`) to rank structural engineering hotspots using internal dependency fan-in/fan-out, PageRank-like dependency centrality, relative file size, and filename-matched test signals. The dashboard includes a refreshable hotspot panel and a concise explanation of the scoring methodology.

Scores are prioritization heuristics, not defect probabilities, security ratings, proof of missing test coverage, or runtime criticality. Static imports, filename-based test matching, and rule-based quality findings can miss aliases, generated modules, integration tests, and runtime behavior. Review evidence before changing code.


### Change Risk & Test Intelligence — v0.30.0

Run `forge change-risk .` (or `forge change-risk . --base main --json`) to combine working-tree changes, downstream module impact, structural hotspot scores, repository risk signals, and filename-matched test candidates into one prioritized report. The dashboard includes a live working-tree change panel.

This is static, heuristic prioritization—not a defect prediction or causal analysis. FORGE does not create or run suggested tests. Static imports and filename matching can miss aliases, runtime dependencies, shared integration tests, and generated modules. Review candidates before acting.


### Engineering Intelligence Timeline — v0.31.0

Capture a local structural-risk snapshot with `forge snapshot .` and compare the latest capture with its predecessor using `forge timeline .`. Snapshots include the analysis timestamp, available Git commit, hotspot severity counts, architecture size, quality findings, and the top hotspot files. The dashboard provides a read-only timeline view of saved captures.

Snapshots are written to `.forge/intelligence/`, use private local file permissions, and are not uploaded or committed by FORGE. The trend is a comparison of saved static-analysis snapshots, not continuous monitoring or a guarantee of quality. A first snapshot establishes a baseline; capture another after meaningful changes to see a comparison.
