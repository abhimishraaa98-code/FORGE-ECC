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

This isolates the candidate's agent/skill Markdown and declarative `.forge/hooks.json` policy in a temporary configuration workspace. If the snapshot predates hook support, the benchmark refuses to run it rather than silently falling back to active workspace hooks. Project memory remains shared, and agents still inspect the original project working tree (including its code). Tool permissions, provider credentials, environment variables and the execution host are not snapshotted or isolated. This is not a hermetic execution sandbox or a security boundary. The report records the snapshot ID and content fingerprint so configuration inputs can be traced.
