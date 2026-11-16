# FORGE — The AI Engineering Workbench

FORGE is a local-first AI engineering workbench for planning, coordinating, reviewing and evaluating software changes. It combines specialized agents, controlled workflows, project memory, skills, policy hooks, provider routing, execution traces and reproducible benchmark experiments.

## Model comparison experiments

Create a matrix that compares two or more providers/models against the same evaluation suite and task:

```bash
forge experiment-studio compare \
  --id provider-round-1 \
  --name "Provider comparison" \
  --candidates "gpt:openai:gpt-4.1-mini,claude:claude-code:sonnet,gemini:google:gemini-2.5-flash" \
  --repeats 2
```

This writes a private local config to `.forge/experiments/provider-round-1.json`. It does not call providers or spend API credits. It creates six planned trials (three candidates × two repeats).

You can attach existing immutable agent/skill Markdown snapshots to individual candidates:

```bash
forge agent-config snapshot --note "Baseline configuration"
forge agent-config list
forge experiment-studio compare \
  --id config-round-1 \
  --name "Snapshot provenance comparison" \
  --candidates "baseline:openai:gpt-4.1-mini,treatment:openai:gpt-4.1-mini" \
  --config-versions "baseline=cfg-0123456789ab,treatment=cfg-abcdef012345"
```

Replace the example snapshot IDs with IDs returned by `forge agent-config snapshot`. FORGE validates and loads each referenced snapshot and records its content fingerprint in the benchmark report. A candidate with a snapshot runs with its own agent and skill Markdown plus its snapshotted `.forge/hooks.json` policy. Snapshots captured before hook isolation must be recreated before they can be used for benchmark runs.

Run it explicitly after reviewing the candidate list and choosing a suite and task:

```bash
forge benchmark-matrix .forge/experiments/provider-round-1.json \
  --suite your-suite-id \
  --goal "Implement the same well-scoped change"
```

Then inspect the saved results:

```bash
forge experiment-history --suite your-suite-id
forge agent-evolution provider-round-1
```

Use the same suite, goal, workspace, permissions and environment for fair comparisons. Provider availability, model access and actual billing depend on each configured account. FORGE's token counts are estimates, not billing records. Benchmark results are evidence for a decision, not a universal model ranking.

For controlled skill experiments, use `forge experiment-studio create` with `--provider`, `--model`, and `--skills`.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

### Snapshot isolation semantics

When a benchmark candidate specifies `configVersionId`, FORGE now materializes that verified snapshot into a fresh temporary workspace for the candidate run. Workspace agent and skill Markdown are loaded from that snapshot and passed as task guidance; the temporary configuration workspace is removed after the trial. The source project's configuration files are not overwritten.

This isolates the candidate's agent/skill Markdown, declarative `.forge/hooks.json` policy and `.forge/permissions.json` policy in a temporary configuration workspace. The permission policy is validated and benchmark execution currently fails closed unless it is `proposal-only` with an empty `allowedTools` list; FORGE does not grant candidate-configured tools. Missing policy files resolve to this safe default, and snapshots record the default explicitly. Project memory remains shared, and agents still inspect the original project working tree (including its code). Provider credentials, environment variables and the execution host are not snapshotted or isolated. This is not a hermetic execution sandbox or a security boundary. The report records the snapshot ID and content fingerprint so configuration inputs can be traced. The same policy is enforced at the normal `forge run` and `forge resume` entry points: malformed policies fail closed, and any non-empty tool allowlist or `restricted` mode is rejected until a real audited executor exists. This is intentionally stricter than merely recording candidate permissions.

Experiment manifests also record an allowlist of non-secret runtime settings (`CI`, `NODE_ENV`, locale/time-zone values and FORGE retry/token/duration limits) plus hashes for detected npm, pnpm, Yarn and Bun lockfiles. Manifest comparison reports when these values differ. Environment variables outside this allowlist—including API keys, tokens and arbitrary custom variables—are deliberately excluded. These records improve reproducibility but do not freeze the host, operating system packages, network responses, provider-side model versions or external services.


## MCP read-only workspace tools

Build FORGE and launch its stdio MCP server:

```bash
npm run build
FORGE_WORKSPACE=/absolute/path/to/project npm run mcp
```

The server exposes bounded, read-only tools for project inspection, architecture mapping, code search, quality auditing, Git change analysis, specialist discovery, review-plan creation, and workspace browsing:

- `forge_list_files` lists supported source/documentation files (maximum 200 entries); hidden paths, dependency/generated directories, secret-like filenames and symlinks are excluded.
- `forge_read_file` reads supported text files up to 128 KiB; traversal, symlinks, secret-like filenames and binary content are rejected.
- `forge_search_code`, `forge_inspect_project`, `forge_map_architecture`, `forge_quality_audit`, and `forge_git_intelligence` provide static, read-only project intelligence.
- `forge_create_review_plan` creates a workflow draft; it does not execute it.

All project paths are resolved under `FORGE_WORKSPACE`.  Normal `forge run`, `forge resume` and benchmark-matrix trials also build bounded, task-specific repository context from the read-only code-search engine. Each agent receives a small set of matching source locations and snippets, rather than the entire repository. Search results are untrusted data, capped in count and character length. Normal `forge run` and `forge resume` can additionally use native OpenAI-compatible function calling when `.forge/permissions.json` explicitly selects `restricted` mode and allowlists one or more of `list-files`, `read-file`, or `search-code`. Each call is validated and executed by the workspace broker, emits audit metadata to stderr, and returns bounded read-only results to the model. Tool calls are capped per agent response (default 5, maximum 10); no shell, network, write, patch or test-execution tools are exposed. This first native tool loop is currently supported only for the OpenAI provider. Claude Code, Anthropic, Google and Ollama remain proposal-only in the normal run path.  To enable the three workspace browsing/search tools over MCP, opt in explicitly in `.forge/permissions.json`:

```json
{
  "version": 1,
  "mode": "restricted",
  "allowedTools": ["list-files", "read-file", "search-code"]
}
```

With the default `proposal-only` policy, these three tools are denied. Calls made through the MCP workspace tools emit structured audit metadata to the MCP server's stderr; audit records do not include file contents. The same allowlist is consumed by the normal OpenAI agent tool loop; other providers are rejected when restricted tool mode is selected. These MCP tools do not write project files, run project scripts, or provide shell access. The current MCP surface is intentionally read-only; write-capable tools will require a separately reviewed executor, explicit per-tool permissions, approval controls and audit records.


## Patch approval records

Patch validation remains a dry run. A reviewer can create a local, immutable approval record bound to the exact saved review patch and the current target-file contents:

```bash
forge patch-check REVIEW_ID 1 --path .
forge patch-approve REVIEW_ID 1 --reviewer "Reviewer name" --reason "Reviewed change" --path .
forge patch-approval-check PATCH_APPROVAL_ID --path .
```

Approval records are stored under `.forge/patch-approvals/` with restrictive file permissions. They include SHA-256 digests for the proposed patch and source file, reviewer identity, timestamp and expiry (24 hours by default). Expiry can be configured through the library API, between one minute and seven days. Verification fails if the patch or source file changes, the approval expires, or the patch no longer validates. Approval does not apply a patch or grant permission to modify files; isolated application and rollback are separate future capabilities.


### Isolated patch staging

After a patch has a current approval record, FORGE can materialize the approved change in a separate local staging workspace:

```bash
forge patch-stage PATCH_APPROVAL_ID --path .
```

The staged copy is written under `.forge/patch-workspaces/<stage-id>/` and includes a stage manifest with the approval ID and source/staged SHA-256 digests. The original project file is not modified. Staging does not run tests, shell commands, or provider calls; it is not yet a sandboxed execution environment. Review the staged diff before any later integration step.
