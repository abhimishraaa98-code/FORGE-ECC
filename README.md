# FORGE — The AI Engineering Workbench

FORGE is a local-first AI engineering workbench for planning, coordinating, reviewing and evaluating software changes. It combines specialized agents, controlled workflows, project memory, skills, policy hooks, provider routing, execution traces and reproducible benchmark experiments.

## Quick start

Requirements: Node.js 22 or newer. From a terminal:

```bash
npm install -g forge-engineering-workbench
forge --version
forge init ./my-project
forge inspect ./my-project
```

To use the latest source without a global install, clone this repository and run:

```bash
npm ci
npm run build
node dist/cli.js --help
node dist/cli.js init ./my-project
node dist/cli.js inspect ./my-project
```

The first commands initialize and inspect a local workspace; they do not require an AI provider key. Provider-backed agent runs require a supported provider configuration and credentials. Review the permission policy before enabling tools. The default workflow is deliberately restrictive: most providers produce proposals rather than directly changing project files.

**Current capability boundaries:** the MCP workspace tools are read-only. Native model tool-calling is currently limited to bounded read-only workspace tools for the OpenAI-compatible provider. Claude Code, Anthropic, Google and Ollama use proposal-only behavior in the normal run path. Patch staging and review are separate from promotion; promotion/rollback are library APIs, not CLI shortcuts. Local script verification runs project-controlled code on the host and is not an OS sandbox. Docker verification is opt-in and still depends on the host kernel, Docker daemon and image.

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

## Run-history lock recovery

FORGE serializes each saved run's writes with a lock directory at `.forge/runs/<run-id>.lock/`. Its `owner.json` records the process ID, host name and lock start time. If FORGE exits unexpectedly while holding a lock, later writes fail closed and identify the owner file; FORGE does not automatically reclaim locks because a process may still be active or a PID may have been reused.

Before manually removing a lock, inspect `owner.json` and confirm on the recorded host that the process is no longer an active FORGE process (check both PID and command line). If the host is unavailable or ownership is uncertain, do not remove the lock. Once confirmed stale, remove only that run's lock directory, then retry the intended command. This is an operator recovery step, not an automatic retry of provider work.

## Development

```bash
npm ci
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

Approval records are stored under `.forge/patch-approvals/` with restrictive file permissions. They include SHA-256 digests for the proposed patch and source file, reviewer identity, timestamp and expiry (24 hours by default). Expiry can be configured through the library API, between one minute and seven days. Verification fails if the patch or source file changes, the approval expires, or the patch no longer validates. Approval does not itself apply a patch or grant permission to modify files. The library API supports separate staged promotion and rollback operations after review; these operations are not exposed as CLI commands. Promotion is explicit, hash-bound, serialized with a per-stage lock, and keeps a backup plus a recovery journal. Rollback refuses to overwrite a target that no longer matches the promoted content. Treat these as local filesystem operations, not as a substitute for version control or a fully durable transaction: process-level atomic renames do not guarantee survival of sudden power loss.


### Isolated patch staging

After a patch has a current approval record, FORGE can materialize the approved change in a separate local staging workspace:

```bash
forge patch-stage PATCH_APPROVAL_ID --path .
```

The staged copy is written under `.forge/patch-workspaces/<stage-id>/` and includes a stage manifest with the approval ID and source/staged SHA-256 digests. The original project file is not modified. Staging does not run tests, shell commands, or provider calls; it is not yet a sandboxed execution environment. Review the staged diff before any later integration step.

### Review a staged diff

After staging, inspect the exact change and verify that neither the original file nor staged copy has changed since its manifest was written:

```bash
forge patch-review PATCH_STAGE_ID --path .
```

The command prints a bounded unified-style diff and rechecks both SHA-256 fingerprints. It is read-only and does not promote the staged file or execute tests. After reviewing the diff, trusted integrations can use the library's explicit promotion API; promotion is intentionally not available as a CLI shortcut.


### Staged patch verification

Run an explicitly selected npm script against a temporary copy of the **workspace snapshot captured at patch-staging time**:

```bash
forge patch-verify PATCH_STAGE_ID test --path .
```

Patch staging now captures a bounded project snapshot under `.forge/patch-workspaces/<stage-id>/workspace`, overlays the approved patch, and records a SHA-256 tree fingerprint plus file/byte counts. The snapshot excludes `.git`, `.forge`, dependency/build caches, common environment files, and private-key files. Symlinks are rejected; snapshots are capped at 20,000 files and 256 MiB. Before verification, FORGE checks the entire snapshot fingerprint, then copies that exact snapshot to a temporary workspace and checks the fingerprint again. Later edits to the live project do not change the snapshot being verified. Tampering with any staged snapshot file causes verification to fail closed.

The temporary workspace is removed after the command. By default, dependencies are neither copied nor installed, and no network access is attempted.
If you explicitly opt in, use:

```bash
forge patch-verify PATCH_STAGE_ID test --install-dependencies --path .
```

FORGE requires a regular `package-lock.json` and runs `npm ci --ignore-scripts --no-audit --no-fund` inside the temporary workspace before the selected check. This can access the network, is capped at ten minutes with bounded output, and does not run package lifecycle scripts. FORGE uses empty temporary npm user/global config files and a temporary HOME rather than reusing the developer's npm configuration or registry credentials. Private registries requiring credentials are therefore not configured automatically. It is opt-in because package retrieval is an external side effect. Project scripts still execute on the local host, so this is not an OS-level sandbox or a security boundary.

### Container-isolated staged verification (opt-in)

On a machine with Docker Engine available, you can ask FORGE to run the staged check in a pre-pulled, digest-pinned container:

```bash
forge patch-verify PATCH_STAGE_ID test --sandbox-image node:22-alpine@sha256:YOUR_VERIFIED_DIGEST --require-rootless --install-dependencies --path .
```

Replace the example image reference with an image you have independently reviewed and pulled. FORGE requires the exact `@sha256:` digest, checks that the image is already present locally, and never pulls an image automatically. It inspects Docker daemon security options before starting a container and reports whether the daemon advertises rootless mode. Add `--require-rootless` to fail closed unless Docker explicitly reports a rootless daemon; unknown status is rejected when this flag is set. The image must provide Node.js and npm. Dependency preparation, when explicitly requested, occurs in the temporary workspace before container execution using `npm ci --ignore-scripts`; this preparation can access the network on the host. The actual test container runs with networking disabled.

The container profile uses a read-only root filesystem, drops Linux capabilities, enables `no-new-privileges`, uses the runtime's default seccomp policy, applies PID/memory/CPU limits, and mounts the staged snapshot read-only at `/snapshot`. The snapshot is copied inside the container into a 1 GiB bounded writable tmpfs at `/workspace`; tests cannot write back into the host's temporary snapshot. `/tmp` is a separate bounded tmpfs. The container is run as the invoking UID/GID where available. It is removed after execution, and timeout handling asks the runtime to stop it.

This is an opt-in container isolation layer, not a claim of VM-grade isolation. It trusts the container runtime, its daemon, the host kernel, the image contents, and the host's container configuration. Use a rootless Docker-compatible runtime where possible. The only host bind mount is the temporary staged snapshot, which is read-only; the original project is not mounted into the container. Test writes stay inside the container's size-limited tmpfs. Container mode is separate from ordinary local-host `patch-verify`.

### Verification runner safety

`forge verify SCRIPT --path PROJECT` executes only the explicitly selected npm script, with npm lifecycle hooks disabled and bounded output/time. The runner passes a minimal environment rather than inheriting arbitrary process variables, so provider/API credentials and custom environment variables are not forwarded. On POSIX systems, timeout handling targets the spawned process group. This is still execution of project-controlled script code on the local host—not a sandbox. Only run scripts from projects you trust; OS-level isolation and staged-workspace verification remain separate work.


### Sandbox runtime status

Run `forge sandbox-status` to inspect whether Docker is reachable, report its version, and display daemon security options including whether rootless mode is advertised. This is a diagnostic capability report, not a security certification. Use `forge patch-verify ... --require-rootless` to enforce rootless mode for container verification.


### Sandbox lifecycle cleanup

FORGE labels its verification containers with `com.forge.managed=true`. Run `forge sandbox-cleanup` to preview stopped containers carrying that label. Add `--apply` to remove only stopped/created/dead containers; active containers are never selected. Cleanup is dry-run by default.


### Sandbox cleanup audit history

Every successful `forge sandbox-cleanup` preview or apply records a local audit entry under `.forge/sandbox-cleanup-history.json`. Review it with `forge sandbox-cleanup-history [PROJECT_PATH]`. The history is capped at 200 entries and records timestamps, candidate container IDs, statuses, names, and removals. It is local project metadata, not a tamper-proof security log.


### Sandbox security profiles

Run `forge sandbox-profiles` to list built-in profiles, or `forge sandbox-profiles hardened` to inspect one. Profiles now feed the staged container verification path. The selected profile is reported in the verification output; `hardened` and `rootless-required` fail closed unless Docker reports rootless mode. The container command applies the common profile controls (network disabled, read-only root, dropped capabilities, no-new-privileges and bounded CPU, memory and processes). Choose a profile with `--profile balanced|hardened|rootless-required` on `patch-verify`.


Example: `forge patch-verify PATCH_STAGE_ID test --sandbox-image node:22-alpine@sha256:VERIFIED_DIGEST --profile hardened --path .`.


### Sandbox compliance reports

Run `forge sandbox-compliance balanced IMAGE@sha256:DIGEST` or choose `hardened` / `rootless-required`. The report distinguishes configured controls (network, read-only root, capabilities, privilege escalation and resource bounds) from observed facts (Docker availability, rootless status and image digest syntax). A hardened profile is non-compliant unless rootless mode is positively detected. This is a local diagnostic, not an independent audit or a guarantee that the host kernel/runtime is secure.


### Custom sandbox policy validation

Create a version 1 JSON policy with a built-in profile and restrictive controls, then run `forge sandbox-policy-check ./sandbox-policy.json`. Validation rejects unknown fields, network enablement, writable roots, restored capabilities, disabled no-new-privileges, relaxed resource bounds and hardened profiles without rootless enforcement. This command validates policy input only; it does not apply the policy to a running container.
