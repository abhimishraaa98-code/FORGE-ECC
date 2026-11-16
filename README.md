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

Replace the example snapshot IDs with IDs returned by `forge agent-config snapshot`. FORGE validates and loads each referenced snapshot and records its content fingerprint in the benchmark report. **Current limitation:** this pins provenance but does not yet execute each candidate inside an isolated copy of its snapshot; the run still reads the active workspace agent/skill files. Snapshots currently cover Markdown files under `.forge/agents` and `.forge/skills`, not hooks, tools or permission settings. Do not interpret this mode as a fully isolated configuration A/B test yet.

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
