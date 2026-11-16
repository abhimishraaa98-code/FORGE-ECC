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
