# FORGE

### The AI Engineering Workbench

<p align="center">
  <a href="https://forge-ecc.vercel.app"><strong>Live FORGE Site ↗</strong></a> ·
  <a href="https://github.com/ansh44233/FORGE-ECC"><strong>Source Code</strong></a>
</p>

> **Current project status — v0.34.0:** FORGE has a growing local-first TypeScript CLI and local engineering dashboard. The public Vercel site is a product landing page with an illustrative preview; it is not yet a hosted, multi-user code-analysis service. The latest site redesign is deployed at [forge-ecc.vercel.app](https://forge-ecc.vercel.app).


[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fansh44233%2FFORGE-ECC)

**[Live FORGE Product Site](https://forge-ecc.vercel.app)** · [Dashboard source](https://github.com/ansh44233/FORGE-ECC/tree/main/public) · [GitHub Repository](https://github.com/ansh44233/FORGE-ECC)

> The public page is a product overview with an illustrative dashboard preview. The full engineering dashboard runs locally against a project you choose; it is not a hosted remote code scanner.


**Understand the codebase. Map its architecture. Plan the change. Verify the result.**

FORGE is an independent, open-source engineering workbench for developers. It is being built around a simple principle: AI-assisted engineering should understand a project before proposing changes, show evidence for its conclusions, and keep developers in control.

> FORGE is an original implementation. It is not a fork, rebrand, or continuation of another toolkit.

## AI Provider Foundation — available (offline mock)

FORGE's engineering core and MCP tools do not require Claude Pro, ChatGPT Plus, or any other consumer subscription. Provider API access is a separate, optional configuration.

The provider contract and offline mock are available in `src/ai/provider.ts`. FORGE also includes an initial Claude Code CLI harness adapter: it uses an already-installed, authenticated Claude Code CLI for proposal-only agent runs without requiring FORGE to store an Anthropic API key. The adapter runs in plan mode, denies shell and file-write tools, and applies turn, time, and output limits. Direct API adapters for Anthropic, OpenAI, Google, and Ollama are not implemented yet.

### Current configuration

```bash
# Works without an AI account or API key
FORGE_AI_PROVIDER=mock

# Future hosted-provider configuration (adapter not yet available)
FORGE_AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=...

# Optional model override once an adapter is implemented
FORGE_AI_MODEL=...
```

A Claude Pro subscription does not automatically provide Anthropic API access. If/when you choose to use Anthropic from FORGE, API credentials and billing are handled separately by Anthropic. You can continue building and testing FORGE's repository intelligence, MCP server, and offline workflows without either.

## MCP Server — available (initial implementation)

FORGE includes a local, read-only Model Context Protocol (MCP) server so compatible AI clients can call selected engineering-intelligence tools through a standard interface.

### Current tools

| Tool | Purpose | Access |
|---|---|---|
| `forge_inspect_project` | Languages, frameworks, manifests, scripts and dependency counts | Read-only |
| `forge_map_architecture` | Source-file map, imports, entry points and external packages | Read-only |
| `forge_search_code` | Search source identifiers and text | Read-only |
| `forge_quality_audit` | Static project-quality checks with evidence-backed findings | Read-only |
| `forge_git_intelligence` | Working-tree changes, estimated impact, suggested tests and heuristic risk | Read-only |

### Run locally

Requires Node.js 22+ and a built FORGE checkout:

```bash
npm install
npm run build
FORGE_WORKSPACE=/absolute/path/to/your/project npm run mcp
```

The MCP process uses standard input/output (stdio), suitable for a local MCP host that launches a command. Configure the host to run `node` with the absolute path to `dist/mcp/server.js`, and set `FORGE_WORKSPACE` to the project directory it is allowed to inspect.

### Security boundaries

- The configured workspace root is the maximum readable boundary; tool paths are resolved and rejected if they escape it.
- All five initial tools are read-only. They do not edit files, execute project scripts, install packages, or apply patches. Git intelligence invokes Git inspection commands only.
- Project contents are untrusted input. An AI client must treat repository text and tool output as data, not as instructions.
- This initial server does not provide remote HTTP hosting, authentication, multi-user access, or write-capable tools.
- Review the permissions of the MCP client before connecting it to a repository.

This is the first MCP integration, not a claim of full ECC feature parity. Tool coverage, test coverage, and host compatibility will expand after the initial implementation is verified.

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

Start a local, read-only engineering control center with `forge dashboard .` (or `forge dashboard ./project --port 4173`). Workflows are saved locally in `.forge/workflows/`; use the dashboard editor to compose, save, and create draft runs. The responsive dashboard brings together:
- Visual workflow editor for composing specialist tasks, connecting dependencies, adding approval gates, saving reusable pipelines under `.forge/workflows/`, and creating reviewable draft runs without automatically calling agents

- Project structure, detected stack, language composition, and specialist agent registry
- Saved orchestration runs with live progress snapshots, task status counts, a chronological event stream, execution telemetry, and explicit human approval controls
- Failed-run recovery: replay retryable tasks or create a focused retry for one failed task and its blocked dependants; completed prerequisites remain preserved
- Run controls: request cooperative cancellation between provider batches and compare a run with the latest saved run. An in-flight provider call is allowed to settle before the orchestrator stops starting further tasks
- Interactive static architecture graph
- Project health snapshots, quality findings, and verification history
- Regression classifications across saved verification runs, plus current Git change context
- Saved code-review snapshots with finding summaries

The server binds to `127.0.0.1` and exposes local JSON endpoints for the dashboard. During `forge resume`, the CLI persists run snapshots as task batches start and finish, allowing the dashboard to poll progress while the process is active. Execution traces are incrementally written under `.forge/traces/`. The dashboard does not automatically run project tests, apply patches, or make code changes. Creating a replay or focused retry only prepares a new run; provider execution still requires the explicit CLI `forge resume` command. Cancellation is cooperative: an active provider request may finish, but no subsequent task batch should start after the cancellation is observed. Human approval controls are limited to recorded workflow tasks. Quality, architecture, and regression signals are heuristic and should be reviewed in context.

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
| `forge deps [path] [--audit-report FILE] [--outdated-report FILE]` | Inventory npm dependencies and import local audit/outdated reports |
| `forge risk [path]` | Rank structural engineering hotspots by dependency and quality signals |
| `forge change-risk [path] [--base REV]` | Prioritize changed files by downstream impact and recommend test candidates |
| `forge snapshot [path]` | Capture a local engineering intelligence snapshot |
| `forge timeline [path]` | Compare the latest saved snapshot with its predecessor |
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


### Dependency Security & License Intelligence — v0.33.0

Run `forge deps .` for an offline npm dependency inventory, including direct/transitive packages, lockfile versions, available license metadata, and coarse license categories. FORGE never installs packages or contacts registries during this command. Vulnerability and outdated status are explicitly **NOT ASSESSED** unless you provide locally generated reports:

- `npm audit --json > npm-audit.json` then `forge deps . --audit-report npm-audit.json`
- `npm outdated --json > npm-outdated.json` then `forge deps . --outdated-report npm-outdated.json`
- Both reports: `forge deps . --audit-report npm-audit.json --outdated-report npm-outdated.json`

Review reports before sharing; they can contain package and environment metadata. Report paths must remain inside the analyzed project. This first release parses npm manifests and package-lock/npm-shrinkwrap data only. pnpm/Yarn, abandoned-package detection, full SPDX license expression evaluation, and legal compatibility analysis are not implemented. The dashboard displays the local dependency inventory and clearly labels missing security reports as unassessed.


### Unified Engineering Health Score — v0.33.0

`forge health .` now calculates a unified engineering score with an explicit evidence-coverage percentage and a breakdown of its available dimensions:

- **Static quality (50%)** — existing evidence-based project quality audit.
- **Verification reliability (25%)** — saved verification outcomes; timeouts and process-launch errors reduce the score. If no verification history exists, this dimension is excluded.
- **Dependency security (25%)** — imported local npm audit findings. If no audit report is available, this dimension is excluded and clearly marked **NOT ASSESSED**.

The score is the weighted average of available dimensions only; evidence coverage is the sum of their weights. It is a prioritization heuristic, not a certification or proof that a project is secure. Architecture metrics remain visible as context but are not used as a proxy for code quality. The dashboard Project Health Center shows the score, coverage, dimensions and dependency assessment status. Older health snapshots remain readable; only new snapshots contain the expanded score fields.


### Automated Remediation Planner — available (v0.34.0)

Run `forge remediate .` to create a prioritized, reviewable dependency remediation plan. It combines imported npm audit findings, outdated-package reports, lockfile versions, and license metadata. Critical and high vulnerability findings appear first; compatible wanted-version updates are distinguished from major-version review, and unknown or copyleft license metadata is surfaced for human review.

Provide current local evidence with `npm audit --json > npm-audit.json` and `npm outdated --json > npm-outdated.json`, then run:

```bash
forge remediate . --audit-report npm-audit.json --outdated-report npm-outdated.json
forge remediate . --audit-report npm-audit.json --outdated-report npm-outdated.json --json
```

The planner never installs, upgrades, removes, or modifies dependencies and never executes suggested commands. Vulnerability and outdated status are not assessed when reports are absent. Suggested versions are candidates, not compatibility guarantees; review release notes, peer dependencies, lockfile changes, and project checks before acting. License classifications are heuristic metadata signals, not legal advice. Only npm manifests and npm lockfiles are currently supported.


### Agent handoffs and replayable runs

Dependency edges are explicit agent-to-agent handoffs: a downstream agent receives the completed upstream proposal together with its task ID, source agent, and task title. The provider is instructed to treat these findings as untrusted project data and retain their provenance; handoffs do not grant agents tool or file-write access.

Failed runs can be replayed without repeating successful prerequisite work:

```bash
forge replay forge-RUN-ID --path .
forge resume forge-NEW-RUN-ID --path .
```

`replay` creates a separate run, preserves completed results, and resets retryable failed/dependency-blocked tasks. It will not override a policy hook block or a human rejection. `resume` is the explicit provider-call step. For approval-gated tasks:

```bash
forge approve forge-RUN-ID TASK_ID --reviewer "Your review"
forge resume forge-RUN-ID
```

Approval is recorded before resuming; a rejected task cannot be replayed automatically. Run history remains local under `.forge/runs/`.

### Task-aware model routing and execution traces

The CLI can select a model tier per task. Configure `FORGE_MODEL_FAST`, `FORGE_MODEL_BALANCED`, and `FORGE_MODEL_REASONING`; unset tiers fall back to `FORGE_AI_MODEL` (or the CLI's provider default). Security, architecture, incident/debugging and release-sensitive tasks prefer the reasoning tier; focused documentation and small cleanup tasks prefer fast; other tasks use balanced. This is a heuristic, not a benchmark or guarantee of model quality.

Transient provider failures (HTTP 408/409/425/429/5xx, timeouts, and common network errors) are retried before fallback. Defaults are two retries with exponential backoff starting at 500 ms. Tune with `FORGE_MODEL_RETRY_ATTEMPTS` (0–5) and `FORGE_MODEL_RETRY_DELAY_MS` (0–10000). Authentication and other non-transient errors are not retried. Set `FORGE_FALLBACK_MODEL` to enable one fallback attempt after the primary retries are exhausted; fallback uses the same configured provider and credentials. Retries are bounded and do not bypass provider rate limits.

Optional token guardrails are available for both `forge run` and `forge resume`:
- `FORGE_MAX_INPUT_TOKENS_PER_TASK` — reject a task before sending it when its estimated input exceeds this limit.
- `FORGE_MAX_OUTPUT_TOKENS_PER_TASK` — reject a provider response whose estimated output exceeds this limit.
- `FORGE_MAX_ESTIMATED_TOKENS_PER_RUN` — cap estimated input plus output across the run.
- `FORGE_MAX_ESTIMATED_TOKENS_PER_AGENT` — JSON map of cumulative estimated input + output token ceilings per agent, e.g. `{"planner":12000,"security-reviewer":20000}`.
- `FORGE_MAX_TASK_DURATION_MS` — maximum wall-clock time FORGE waits for one provider task.
- `FORGE_MAX_TASK_DURATION_MS_BY_AGENT` — optional JSON map of stricter agent-specific limits, e.g. `{"security-reviewer":90000,"planner":60000}`. Per-agent values override the default.

These are character-based estimates (roughly four characters per token), not provider billing measurements. Input is checked before a request; output is checked after the provider responds. With parallel execution, already-started tasks in the same batch may finish before the budget breach is detected. Once detected, FORGE marks unstarted tasks blocked and does not schedule another batch. A task-duration ceiling stops FORGE from waiting and marks the task failed; providers without cancellation support may continue in the background, so this is not a hard network abort. Budget-exceeded tasks do not trigger model fallback.

Every `forge run` saves a local trace under `.forge/traces/<run-id>.json`. Inspect it with `forge trace RUNID --path .`. Traces include per-agent model, provider, duration, outcome, fallback status, retry counts, and approximate token counts estimated from character length (not provider-billed usage). They also aggregate provider health for the run: request counts, successes, fallbacks, failures, retries, and cumulative duration. Inspect both views with `forge trace RUNID --path .`. Trace files are local and excluded from Git.

Example:
```bash
FORGE_AI_PROVIDER=claude-code \
FORGE_MODEL_FAST=haiku \
FORGE_MODEL_BALANCED=sonnet \
FORGE_MODEL_REASONING=opus \
FORGE_FALLBACK_MODEL=sonnet \
forge run --goal "Review the authentication architecture"
```

### Skills and declarative lifecycle hooks

FORGE includes built-in skills for implementation planning, verification, secure changes, documentation, and performance. Add or override Markdown skills in `.forge/skills/*.md`; optional `triggers: keyword, another-keyword` metadata controls relevance matching. Run `forge skills .` to inspect the registry. During `forge run`, a small set of relevant skill instructions is selected and added to agent context.

Project policy hooks live in `.forge/hooks.json`. Supported lifecycle event: `before-agent`. Supported actions are deliberately declarative and non-executable:
- `require-approval` — hold matching tasks for explicit approval.
- `append-context` — add policy guidance to the task prompt.
- `block-task` — prevent a matching task from running.

Optional match filters: `agents` (agent IDs) and `contains` (case-insensitive text terms in the task title/prompt). Set `enabled: false` to disable a hook. Run `forge hooks .` to inspect configured hooks. Arbitrary shell commands, JavaScript, network calls, and file writes are not supported as hook actions. Review project hook configuration before running agents.

## Deploy the public FORGE site

The repository includes a Vercel configuration for the static product page in `public/index.html`. The current production deployment is [forge-ecc.vercel.app](https://forge-ecc.vercel.app).

1. Select **Deploy with Vercel** above, or import `ansh44233/FORGE-ECC` in Vercel.
2. Keep the repository root as the project root.
3. Use the included `vercel.json` settings: build command `npm run build`, output directory `public`.
4. Deploy. Vercel will provide a temporary `*.vercel.app` URL; add a custom domain later when you purchase one.

The public page is separate from the local engineering dashboard. To inspect a real codebase, install FORGE and run `forge dashboard ./your-project` on the machine containing that project. The public preview uses clearly labelled sample data and does not expose local project files.


## Specialist agent team

FORGE includes a built-in registry of specialist roles: Planner, Architect, Code Reviewer, Test Engineer, Security Reviewer, Debugger, Performance Engineer, Documentation Writer, DevOps Engineer, Database Reviewer, Accessibility Reviewer and Release Manager. Projects can add or override role instructions with Markdown files under `.forge/agents/`.

The engineering review planner creates a dependency-aware workflow: architecture understanding → plan → specialist reviews → release-readiness synthesis. Independent tasks execute in bounded parallel batches (default concurrency 4; configurable in the orchestration API). Agents return text proposals; they do not directly edit files or run project scripts. Findings and release recommendations must distinguish verified evidence from hypotheses and suggested checks.\n\n### Local project memory and context\n\nFORGE stores optional project notes in `.forge/memory.json` on the local machine. Add notes with `forge memory add . --kind decision --content "Use adapters for providers" --tags architecture,providers`, inspect them with `forge memory list .`, retrieve context with `forge memory context . --query "provider architecture"`, and remove a note with `forge memory remove . mem-ID`. Memory is opt-in, local-only, bounded to 500 entries, and includes a basic credential-pattern guard. The Claude Code harness receives a relevance-ranked selection (default budget approximately 1,800 tokens) during `forge run`. Treat memory as potentially stale: it is context, not authoritative truth. Do not store secrets in memory.


## Agent evaluation & benchmarking

FORGE includes a deterministic rubric evaluator for saved agent runs. A starter suite is included at `.forge/evals/engineering-basics.json`.

```bash
forge evals .
forge evaluate RUN_ID --path .
forge evaluate RUN_ID --suite engineering-basics --path .
```

Suites define cases matched by task ID or agent ID and weighted criteria using required terms, forbidden terms, and optional minimum/maximum word counts. Reports are stored under `.forge/evaluations/` and appear in the local dashboard's Evaluation history. This is deterministic rubric scoring, not an AI semantic judge or proof of engineering correctness. For model comparisons, run the same suite against equivalent tasks and compare the saved reports; provider/model metadata remains available in execution traces.


### Model-judged evaluations

For a second-pass qualitative review, use the optional model judge:

```bash
FORGE_AI_PROVIDER=openai
FORGE_API_KEY=...
FORGE_EVAL_JUDGE_MODEL=gpt-4.1
forge evaluate RUN_ID --suite engineering-basics --judge --path .
```

The judge reviews each matching agent output against the case description and rubric, returns a score plus strengths/improvements, and must cite exact evidence copied from the candidate output. FORGE rejects fabricated or non-verbatim evidence quotes. The dashboard shows the judge's aggregate score separately from the deterministic rubric score.

The judge is a model-based opinion, not ground truth. It can be inconsistent or biased; use the same judge model and rubric for comparisons, keep human review for consequential decisions, and account for the extra model/API usage. The deterministic evaluator remains available without any model call.


## Benchmark Lab

Record completed runs against the same evaluation suite and compare provider/model groups over time. Benchmarks aggregate **distinct saved runs**; they do not rerun tasks or treat repeated scoring of one run as a new trial.

```bash
# First evaluate a saved run
forge evaluate RUN_ID --suite engineering-basics --path .

# Record that run as a benchmark trial
forge benchmark RUN_ID --suite engineering-basics --path .

# Show all benchmark leaderboards
forge benchmark --path .
```

The local dashboard includes a Benchmark Lab panel with average/best/worst score, pass rate, score standard deviation, average duration and estimated token use, retries and fallbacks. Each trial records the actual provider/model metadata from the execution trace. A run can be recorded only once per suite; recording it again replaces its previous trial. To compare models, run equivalent tasks independently with each model and record each distinct run.

Benchmark token counts are estimates derived from trace data, not provider-billed usage. Results are only comparable when task inputs, evaluation suite, judge settings and environment are held reasonably constant. Model-judged scores should be tracked separately from deterministic rubric scores; human review remains important.


### Automated Benchmark Matrix

Run an equivalent engineering goal against multiple provider/model candidates and repeat each candidate up to three times. Matrix definitions are JSON files:

```json
{
  "id": "model-comparison",
  "name": "Model comparison",
  "repeats": 2,
  "candidates": [
    { "id": "openai-fast", "provider": "openai", "model": "gpt-4.1-mini" },
    { "id": "openai-reasoning", "provider": "openai", "model": "gpt-4.1" }
  ]
}
```

Run it with:

```bash
forge benchmark-matrix ./matrix.json --suite engineering-basics --goal "Review the architecture and identify reliability risks" --path .
```

FORGE runs the same review-plan goal and evaluation suite for every candidate/repeat, stores each underlying run and execution trace, and writes a matrix report under `.forge/benchmark-matrices/`. Candidate model selection is pinned across fast, balanced and reasoning tiers, with no fallback model, to keep comparisons interpretable. Runs execute sequentially; a failed trial is recorded and does not prevent later trials from running.

A matrix supports 2–4 candidates and 1–3 repeats (maximum 12 trials) to limit unexpected provider usage. OpenAI candidates use `FORGE_API_KEY` or `OPENAI_API_KEY`; Claude Code candidates use the locally authenticated Claude Code CLI. Matrix reports include average deterministic score, pass rate, score standard deviation, wall-clock duration and estimated token use. Token figures are estimates, not billed usage. Use the same goal, suite, project state and environment when comparing candidates. Model-judge scoring is not currently part of the automated matrix.


### Benchmark Regression Intelligence

After running a benchmark matrix at least twice with the same matrix ID, evaluation suite and goal, inspect historical changes:

```bash
forge benchmark-regression model-comparison --path .
```

The report compares matching provider/model candidates against the most recent earlier comparable matrix. A score drop of at least 5 points or pass-rate drop of at least 20 percentage points blocks the report (exit code 2). A 25% or greater increase in wall-clock time or estimated token use, score standard deviation of at least 15, or failed trials produces warnings. Missing or incomparable baselines are reported as insufficient history rather than release-ready.

The local dashboard exposes the same analysis in Regression Intelligence. These thresholds are configurable in source for now. The report is a signal, not a release guarantee: use identical code snapshots, prompts, suite definitions, model versions and runtime conditions. Token comparisons are estimated, not billed usage.


### Agent Evaluation Intelligence

Automated benchmark-matrix trials now retain per-agent evaluation cases alongside each candidate's overall score. The matrix report includes agent scorecards grouped by candidate and agent, with average rubric score, pass rate, completed evaluation count and the skill IDs actually selected for that task.

Skills are selected per task (agent, title and prompt) and supplied as task-specific context, rather than applying one global skill bundle to every agent. The latest matrix leaderboard is available in the local dashboard under **Agent Performance**. Historical comparisons also flag per-agent score drops of at least 5 points or pass-rate drops of at least 20 percentage points.

Skill IDs are recorded as observed context. A scorecard does not establish that a skill caused a score change; meaningful skill-effectiveness experiments require controlled runs that vary the skill while holding model, task, suite and environment constant. Only agents represented by cases in the selected evaluation suite receive scorecards.
