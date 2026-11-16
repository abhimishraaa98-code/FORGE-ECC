#!/usr/bin/env node

import path from "node:path";
import { initializeProject } from "./core/project-init.js";
import { formatArchitectureMap, mapArchitecture } from "./core/architecture-map.js";
import { formatProjectReport, inspectProject } from "./core/project-inspector.js";
import { loadAgentRegistry } from "./core/agent-registry.js";
import { createReviewPlan } from "./core/review-planner.js";
import { saveRun, listRuns, loadRun, decideTaskApproval } from "./core/run-store.js";
import { advanceRun } from "./core/orchestrator.js";
import { OpenAICompatibleProvider } from "./core/openai-compatible-provider.js";
import { ClaudeCodeProvider } from "./ai/claude-code-provider.js";
import { startDashboard } from "./core/dashboard-server.js";
import { auditProject, formatQualityAudit } from "./core/quality-audit.js";
import { discoverChecks, formatVerificationResult, runVerification } from "./core/verification.js";
import { compareVerification, formatVerificationComparison, listVerifications, saveVerification } from "./core/verification-history.js";
import { formatProjectHealthMarkdown, generateProjectHealth } from "./core/project-health.js";
import { analyzeCodebase, formatCodebaseAnalysis } from "./core/code-intelligence.js";
import { analyzeGitChanges, formatGitIntelligence } from "./core/git-intelligence.js";
import { reviewProject, formatCodeReview } from "./core/code-review.js";
import { generateAIReview, formatAIReview } from "./core/ai-code-review.js";
import { compareReviews, formatReviewRecord, listReviews, loadReview, saveReview } from "./core/review-history.js";
import { formatPatchValidation, validateReviewPatch } from "./core/patch-validation.js";
import { formatRegressionReport, generateRegressionReport } from "./core/regression-intelligence.js";
import { searchWorkspace } from "./core/code-search.js";
import { analyzeDependencyImpact, formatDependencyImpact } from "./core/dependency-impact.js";
import { analyzeEngineeringRisk, formatEngineeringRisk } from "./core/engineering-risk.js";
import { analyzeChangeIntelligence, formatChangeIntelligence } from "./core/change-intelligence.js";
import { captureIntelligenceSnapshot, compareLatestIntelligence, formatIntelligenceComparison } from "./core/intelligence-timeline.js";
import { analyzeDependencies, formatDependencyIntelligence } from "./core/dependency-intelligence.js";
import { generateRemediationPlan, formatRemediationPlan } from "./core/remediation-planner.js";
import { addProjectMemory, buildProjectMemoryContext, listProjectMemory, removeProjectMemory, type ProjectMemoryKind } from "./core/project-memory.js";
import { formatSkillContext, loadSkillRegistry, selectSkills } from "./core/skill-registry.js";
import { applyBeforeAgentHooks, loadHooks } from "./core/hook-engine.js";
import { ModelRouter } from "./core/model-router.js";
import { loadExecutionTrace, saveExecutionTrace } from "./core/execution-trace.js";
import { createReplayRun } from "./core/run-replay.js";
import { evaluateRun, evaluateRunWithJudge, formatEvaluationReport, loadEvaluationSuites, saveEvaluationReport, loadEvaluationReport, type EvaluationReport, type JudgedEvaluationReport } from "./core/evaluation-engine.js";
import { createBenchmarkTrial, formatBenchmark, listBenchmarks, recordBenchmarkTrial } from "./core/benchmark-engine.js";
import { executeBenchmarkMatrix, formatBenchmarkMatrix, loadBenchmarkMatrix, listBenchmarkMatrices, saveBenchmarkMatrix } from "./core/benchmark-matrix.js";
import { fingerprintAgentConfig } from "./core/benchmark-matrix.js";
import { loadAgentConfigVersion } from "./core/agent-config-versioning.js";
import { formatBenchmarkRegression, loadBenchmarkRegression } from "./core/benchmark-regression.js";
import { buildAgentOptimizationPlan, formatAgentOptimizationPlan } from "./core/agent-optimization.js";
import { approveAgentConfigVersion, captureAgentConfigVersion, compareAgentConfigVersions, formatAgentConfigVersion, listAgentConfigVersions } from "./core/agent-config-versioning.js";
import { decideAgentConfigRelease, formatAgentConfigRelease, listAgentConfigReleases, prepareAgentConfigRelease } from "./core/agent-config-release.js";

function readAgentTokenBudgets(): Record<string, number> | undefined {
  const raw = process.env.FORGE_MAX_ESTIMATED_TOKENS_PER_AGENT;
  if (!raw) return undefined;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("FORGE_MAX_ESTIMATED_TOKENS_PER_AGENT must be a JSON object mapping agent IDs to token limits.");
  const budgets: Record<string, number> = {};
  for (const [agent, value] of Object.entries(parsed)) {
    if (!agent.trim() || !Number.isSafeInteger(value) || (value as number) < 1) throw new Error("Every per-agent token budget must be a positive integer.");
    budgets[agent] = value as number;
  }
  return budgets;
}

function readAgentDurationBudgets(): Record<string, number> | undefined {
  const raw = process.env.FORGE_MAX_TASK_DURATION_MS_BY_AGENT;
  if (!raw) return undefined;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("FORGE_MAX_TASK_DURATION_MS_BY_AGENT must be a JSON object mapping agent IDs to milliseconds.");
  const budgets: Record<string, number> = {};
  for (const [agent, value] of Object.entries(parsed)) {
    if (!agent.trim() || !Number.isSafeInteger(value) || (value as number) < 1) throw new Error("Every per-agent duration budget must be a positive integer number of milliseconds.");
    budgets[agent] = value as number;
  }
  return budgets;
}

const VERSION = "0.34.0";

const HELP = `
FORGE — The AI Engineering Workbench

Usage:
  forge <command> [options]

Commands:
  init [path]      Create a safe, local-first .forge starter workspace
  inspect [path]   Analyze project languages, tooling, dependencies, and scripts
  evaluate RUNID  Score a saved run against a local evaluation suite
  benchmark [RUN_ID] [--suite SUITE_ID] [--path PROJECT]  Record or view benchmark results
  benchmark-matrix CONFIG.json --suite SUITE_ID --goal "..." [--path PROJECT]  Run model comparisons\n  benchmark-regression [MATRIX_ID] [--path PROJECT]  Compare latest matrix with its baseline\n  optimize-agents [--path PROJECT]  Recommend evidence-based agent improvements
  agent-config <snapshot|list|show|diff|approve> [options]  Version and review agent/skill configuration
  agent-release <prepare|list|show|approve|reject> [options]  Gate agent configuration promotion
  quality [path]   Generate an evidence-based static engineering quality report
  deps [path]       Analyze npm dependencies, licenses, and imported security reports\n  snapshot [path]   Capture a local engineering intelligence snapshot
  timeline [path]   Compare the latest snapshot with its predecessor
  change-risk [path] Analyze changed-file risk, downstream impact, and test candidates
  risk [path]      Rank engineering hotspots using dependency and quality signals
  health [path]    Generate a unified engineering score, evidence coverage, and health snapshot
  deep [path]      Analyze AST symbols, circular imports, and change impact
  git [path]       Analyze changed files, impact, suggested tests, and risk
  review [path]    Review changed source files; add --ai for provider-backed suggestions
  review-history [path] List saved review snapshots
  review-show ID   Display one saved review snapshot
  review-compare A B Compare two saved reviews
  patch-check ID N  Dry-run validate AI patch N from a saved review
  regression [path] Compare verification history with Git changes and impact
  verify --list    Discover available npm scripts without running them
  verify SCRIPT    Explicitly run one selected npm script and record its result
  verify-history   List saved verification runs for a project
  map [path]       Map source modules and import relationships
  agents [path]    List built-in and workspace agent roles\n  memory <action>  Manage local project memory (add, list, remove, context)\n  skills [path]    List built-in and workspace skills\n  hooks [path]     List configured declarative lifecycle hooks
  plan --goal TEXT Create and save a reviewable draft plan
  run --goal TEXT  Run the plan using a configured AI provider
  runs [path]      List locally saved run history\n  evals [path]     List local agent evaluation suites
  trace RUNID      Show per-agent execution telemetry
  replay RUNID     Create a new run from retryable failed tasks
  resume RUNID     Continue pending or approved tasks in a saved run
  approve RUNID TASK_ID  Approve a task awaiting human review
  show-run ID      Display one saved run (use --path for project directory)
  dashboard [path] Start the local read-only web dashboard
  version          Print the installed version
  help             Show this help message

Options:
  --json           Output machine-readable JSON
  --help           Show command usage

Examples:
  forge inspect .
  forge inspect ./my-app --json
  forge map .
  forge agents .
  forge plan --goal "Add authentication safely"
  forge run --goal "Review the API design"
  forge runs .
  forge replay forge-RUN-ID
  forge approve forge-RUN-ID TASK_ID
  forge resume forge-RUN-ID
  forge dashboard .
`.trim();

async function main(args: string[]): Promise<void> {
  const [command = "help", ...rest] = args;
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      process.stdout.write(`${HELP}\n`);
      return;
    case "version":
    case "--version":
    case "-v":
      process.stdout.write(`forge ${VERSION}\n`);
      return;
    case "init": {
      const target = rest.find(arg => !arg.startsWith("--")) ?? ".";
      try {
        const result = await initializeProject(path.resolve(target));
        process.stdout.write(`FORGE initialized in ${path.resolve(target)}\n`);
        for (const file of result.created) process.stdout.write(`  created  ${file}\n`);
        for (const file of result.skipped) process.stdout.write(`  kept     ${file} (already exists)\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE could not initialize this project: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "evals": {
      const target = path.resolve(rest.find(arg => !arg.startsWith("--")) ?? ".");
      try {
        const suites = await loadEvaluationSuites(target);
        process.stdout.write(suites.length ? suites.map(suite => suite.id + "  " + suite.name + " · " + suite.cases.length + " cases").join("\n") + "\n" : "No evaluation suites. Add JSON suites under .forge/evals/.\n");
      } catch (error) { process.stderr.write("Could not load evaluation suites: " + (error instanceof Error ? error.message : String(error)) + "\n"); process.exitCode = 1; }
      return;
    }
    case "agent-release": {
      const action = rest[0] ?? "list";
      const option = (name: string) => { const index = rest.indexOf(name); return index >= 0 ? rest[index + 1] : undefined; };
      const pathIndex = rest.indexOf("--path");
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".");
      const args = rest.slice(1).filter((arg, index, all) => !arg.startsWith("--") && all[index - 1] !== "--path" && all[index - 1] !== "--reviewer" && all[index - 1] !== "--matrix");
      try {
        if (action === "prepare") {
          const [candidateVersionId, baselineVersionId] = args;
          const matrixId = option("--matrix");
          if (!candidateVersionId || !baselineVersionId || !matrixId) throw new Error("Usage: forge agent-release prepare CANDIDATE_CONFIG_ID BASELINE_CONFIG_ID --matrix MATRIX_ID --path PROJECT");
          const regression = await loadBenchmarkRegression(target, matrixId);
          const release = await prepareAgentConfigRelease(target, { candidateVersionId, baselineVersionId, regression });
          process.stdout.write(formatAgentConfigRelease(release) + "\\nHuman approval is still required. No live files were changed.\\n");
        } else if (action === "list") {
          const items = await listAgentConfigReleases(target);
          process.stdout.write(items.length ? items.map(item => item.id + "  " + item.status.padEnd(17) + "  " + item.candidateVersionId + "  " + item.benchmarkStatus).join("\\n") + "\\n" : "No agent configuration releases found.\\n");
        } else if (action === "show") {
          const id = args[0]; if (!id) throw new Error("Usage: forge agent-release show RELEASE_ID --path PROJECT");
          const item = (await listAgentConfigReleases(target)).find(entry => entry.id === id);
          if (!item) throw new Error("Release not found: " + id);
          process.stdout.write(formatAgentConfigRelease(item) + "\\n");
        } else if (action === "approve" || action === "reject") {
          const id = args[0]; if (!id) throw new Error("Usage: forge agent-release approve|reject RELEASE_ID --reviewer NAME --path PROJECT");
          const reviewer = option("--reviewer"); if (!reviewer?.trim()) throw new Error("A reviewer is required via --reviewer NAME.");
          const item = await decideAgentConfigRelease(target, id, reviewer, action);
          process.stdout.write(formatAgentConfigRelease(item) + "\\n");
        } else throw new Error("Unknown action. Use prepare, list, show, approve or reject.");
      } catch (error) {
        process.stderr.write("FORGE agent release failed: " + (error instanceof Error ? error.message : String(error)) + "\\n");
        process.exitCode = 1;
      }
      return;
    }
    case "agent-config": {
      const action = rest[0] ?? "list";
      const pathIndex = rest.indexOf("--path");
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".");
      const ids = rest.slice(1).filter((arg, index, all) => !arg.startsWith("--") && all[index - 1] !== "--path" && all[index - 1] !== "--note" && all[index - 1] !== "--reviewer");
      const option = (name: string) => { const index = rest.indexOf(name); return index >= 0 ? rest[index + 1] : undefined; };
      try {
        if (action === "snapshot") {
          const version = await captureAgentConfigVersion(target, { note: option("--note") ?? "", createdBy: option("--author") ?? "local-user" });
          process.stdout.write(formatAgentConfigVersion(version) + "\\n");
        } else if (action === "list") {
          const versions = await listAgentConfigVersions(target);
          process.stdout.write(versions.length ? versions.map(item => item.id + "  " + item.status.padEnd(9) + "  " + item.createdAt + "  " + item.files.length + " files").join("\\n") + "\\n" : "No agent configuration snapshots found. Run forge agent-config snapshot first.\\n");
        } else if (action === "show") {
          const id = ids[0]; if (!id) throw new Error("Usage: forge agent-config show CONFIG_ID --path PROJECT");
          process.stdout.write(formatAgentConfigVersion(await loadAgentConfigVersion(target, id)) + "\\n");
        } else if (action === "diff") {
          if (ids.length < 2) throw new Error("Usage: forge agent-config diff BEFORE_ID AFTER_ID --path PROJECT");
          const [before, after] = await Promise.all([loadAgentConfigVersion(target, ids[0]!), loadAgentConfigVersion(target, ids[1]!)]);
          const diff = compareAgentConfigVersions(before, after);
          process.stdout.write(["Agent configuration diff", "Added: " + (diff.added.join(", ") || "none"), "Changed: " + (diff.changed.join(", ") || "none"), "Removed: " + (diff.removed.join(", ") || "none"), "Unchanged: " + diff.unchanged.length].join("\\n") + "\\n");
        } else if (action === "approve") {
          const id = ids[0]; if (!id) throw new Error("Usage: forge agent-config approve CONFIG_ID --reviewer NAME --path PROJECT");
          const reviewer = option("--reviewer"); if (!reviewer?.trim()) throw new Error("Approval requires --reviewer NAME.");
          process.stdout.write(formatAgentConfigVersion(await approveAgentConfigVersion(target, id, reviewer.trim())) + "\\nApproved snapshot pointer updated. This does not rewrite live agent or skill files.\\n");
        } else throw new Error("Unknown action. Use snapshot, list, show, diff or approve.");
      } catch (error) {
        process.stderr.write("FORGE agent configuration command failed: " + (error instanceof Error ? error.message : String(error)) + "\\n");
        process.exitCode = 1;
      }
      return;
    }
    case "optimize-agents": {
      const pathIndex = rest.indexOf("--path");
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".");
      try {
        const matrices = await listBenchmarkMatrices(target);
        const plan = buildAgentOptimizationPlan(matrices);
        process.stdout.write(formatAgentOptimizationPlan(plan) + "\n");
        if (plan.status === "insufficient-history") process.exitCode = 2;
      } catch (error) {
        process.stderr.write("FORGE adaptive agent optimization failed: " + (error instanceof Error ? error.message : String(error)) + "\\n");
        process.exitCode = 1;
      }
      return;
    }
    case "benchmark-regression": {
      const targetIndex = rest.indexOf("--path");
      const target = path.resolve(targetIndex >= 0 ? rest[targetIndex + 1] ?? "." : ".");
      const matrixId = rest.find((arg, index) => !arg.startsWith("--") && index === 0);
      try {
        const report = await loadBenchmarkRegression(target, matrixId);
        process.stdout.write(formatBenchmarkRegression(report) + "\n");
        if (report.status === "blocked") process.exitCode = 2;
      } catch (error) {
        process.stderr.write("FORGE benchmark regression failed: " + (error instanceof Error ? error.message : String(error)) + "\n");
        process.exitCode = 1;
      }
      return;
    }
    case "benchmark-matrix": {
      const configFile = rest.find(arg => !arg.startsWith("--"));
      const suiteIndex = rest.indexOf("--suite"), goalIndex = rest.indexOf("--goal"), pathIndex = rest.indexOf("--path");
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".");
      const suiteId = suiteIndex >= 0 ? rest[suiteIndex + 1] : undefined;
      const goalEnd = goalIndex >= 0 ? rest.findIndex((arg, index) => index > goalIndex && arg.startsWith("--")) : -1;
      const goal = goalIndex >= 0 ? rest.slice(goalIndex + 1, goalEnd >= 0 ? goalEnd : rest.length).join(" ").trim() : "";
      if (!configFile || !suiteId || !goal) { process.stderr.write("Usage: forge benchmark-matrix CONFIG.json --suite SUITE_ID --goal \"engineering task\" [--path PROJECT]\n"); process.exitCode = 1; return; }
      try {
        const config = await loadBenchmarkMatrix(path.resolve(configFile));
        const configVersions = new Map<string, { id: string; fingerprint: string }>();
        for (const candidate of config.candidates) {
          if (!candidate.configVersionId) continue;
          const snapshot = await loadAgentConfigVersion(target, candidate.configVersionId);
          configVersions.set(candidate.id, { id: snapshot.id, fingerprint: fingerprintAgentConfig(snapshot.files) });
        }
        const suites = await loadEvaluationSuites(target);
        const suite = suites.find(item => item.id === suiteId);
        if (!suite) throw new Error("Evaluation suite not found: " + suiteId);
        const apiKey = process.env.FORGE_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
        const baseUrl = process.env.FORGE_BASE_URL ?? "https://api.openai.com/v1";
        const report = await executeBenchmarkMatrix(config, async (candidate, _repeat) => {
          if (candidate.provider === "openai" && !apiKey) throw new Error("Candidate " + candidate.id + " requires FORGE_API_KEY or OPENAI_API_KEY.");
          const createProvider = (selectedModel: string) => candidate.provider === "claude-code"
            ? new ClaudeCodeProvider({ cwd: target, model: selectedModel })
            : new OpenAICompatibleProvider({ apiKey, model: selectedModel, baseUrl });
          const router = new ModelRouter({
            fastModel: candidate.model, balancedModel: candidate.model, reasoningModel: candidate.model,
            retryAttempts: Number(process.env.FORGE_MODEL_RETRY_ATTEMPTS ?? 2),
            retryDelayMs: Number(process.env.FORGE_MODEL_RETRY_DELAY_MS ?? 500),
            ...(process.env.FORGE_MAX_INPUT_TOKENS_PER_TASK ? { maxInputTokensPerTask: Number(process.env.FORGE_MAX_INPUT_TOKENS_PER_TASK) } : {}),
            ...(process.env.FORGE_MAX_OUTPUT_TOKENS_PER_TASK ? { maxOutputTokensPerTask: Number(process.env.FORGE_MAX_OUTPUT_TOKENS_PER_TASK) } : {}),
            ...(process.env.FORGE_MAX_ESTIMATED_TOKENS_PER_RUN ? { maxEstimatedTokensPerRun: Number(process.env.FORGE_MAX_ESTIMATED_TOKENS_PER_RUN) } : {}),
            ...(process.env.FORGE_MAX_ESTIMATED_TOKENS_PER_AGENT ? { maxEstimatedTokensPerAgent: readAgentTokenBudgets()! } : {}),
            ...(process.env.FORGE_MAX_TASK_DURATION_MS ? { maxTaskDurationMs: Number(process.env.FORGE_MAX_TASK_DURATION_MS) } : {}),
            ...(process.env.FORGE_MAX_TASK_DURATION_MS_BY_AGENT ? { maxTaskDurationMsByAgent: readAgentDurationBudgets()! } : {}),
            createProvider,
          });
          const run = createReviewPlan(goal);
          const skillRegistry = await loadSkillRegistry(target);
          const requestedSkillIds = candidate.skillIds;
          const unknownSkills = (requestedSkillIds ?? []).filter(id => !skillRegistry.some(skill => skill.id === id));
          if (unknownSkills.length) throw new Error("Candidate " + candidate.id + " references unknown skill(s): " + unknownSkills.join(", "));
          const selectedSkillsForTask = (task: { agent: string; title: string; prompt: string }) => requestedSkillIds === undefined ? selectSkills(skillRegistry, task.agent + " " + task.title + " " + task.prompt) : skillRegistry.filter(skill => requestedSkillIds.includes(skill.id));
          const hooks = await loadHooks(target);
          for (const record of run.tasks) {
            const applied = applyBeforeAgentHooks(record.task, hooks);
            record.task = { ...applied.task, prompt: applied.context.length ? applied.task.prompt + "\n\nHook guidance:\n" + applied.context.join("\n") : applied.task.prompt };
            if (applied.blockedReason) { record.status = "blocked"; record.error = "Blocked by policy hook: " + applied.blockedReason; }
          }
          const memory = await buildProjectMemoryContext(target, goal);
          const projectContext = memory.text;
          const started = Date.now();
          const completed = await advanceRun(run, router, new Set(), { maxConcurrency: 4, projectContext, projectContextForTask: task => formatSkillContext(selectedSkillsForTask(task)) });
          const durationMs = Date.now() - started;
          await saveRun(target, completed);
          await saveExecutionTrace(target, completed.id, router.traces);
          const evaluation = evaluateRun(completed, suite);
          await saveEvaluationReport(target, evaluation);
          return {
            runId: completed.id, score: evaluation.score, passed: evaluation.passed,
            durationMs,
            estimatedTokens: router.traces.reduce((sum, item) => sum + item.inputTokensEstimate + item.outputTokensEstimate, 0),
            agentScores: evaluation.cases.filter(item => item.status === "scored").map(item => { const task = completed.tasks.find(record => record.task.id === item.taskId)?.task; const appliedSkills = task ? selectedSkillsForTask(task) : []; return { agent: item.agent, caseId: item.caseId, score: item.score, passed: item.passed, skillIds: appliedSkills.map(skill => skill.id), failedCriteria: item.criteria.filter(criterion => !criterion.passed).map(criterion => ({ id: criterion.id, failedChecks: criterion.checks.filter(check => !check.passed).map(check => check.rule + ": " + check.detail) })) }; }),
          };
        });
        report.suiteId = suite.id;
        report.goal = goal;
        if (configVersions.size) report.candidateProvenance = [...configVersions.entries()].map(([candidateId, item]) => ({ candidateId, configVersionId: item.id, fingerprint: item.fingerprint }));
        const saved = await saveBenchmarkMatrix(target, report);
        process.stdout.write(formatBenchmarkMatrix(report) + "\nSaved: " + path.relative(target, saved) + "\n");
        if (report.results.some(item => item.status === "failed") || report.results.some(item => !item.passed)) process.exitCode = 2;
      } catch (error) { process.stderr.write("FORGE benchmark matrix failed: " + (error instanceof Error ? error.message : String(error)) + "\n"); process.exitCode = 1; }
      return;
    }
    case "benchmark": {
      const pathIndex = rest.indexOf("--path"), suiteIndex = rest.indexOf("--suite");
      const runId = rest.find((arg, index) => !arg.startsWith("--") && rest[index - 1] !== "--path" && rest[index - 1] !== "--suite");
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".");
      const suiteId = suiteIndex >= 0 ? rest[suiteIndex + 1] : undefined;
      try {
        if (!runId) {
          const documents = await listBenchmarks(target);
          process.stdout.write(documents.length ? documents.map(document => formatBenchmark(document)).join("\n\n") + "\n" : "No benchmark history. Evaluate and record a run with: forge benchmark RUN_ID --path .\n");
          return;
        }
        const report = await loadEvaluationReport(target, runId, suiteId);
        const trace = await loadExecutionTrace(target, runId);
        const document = await recordBenchmarkTrial(target, createBenchmarkTrial(report, trace));
        process.stdout.write(formatBenchmark(document) + "\n");
      } catch (error) { process.stderr.write("FORGE benchmark failed: " + (error instanceof Error ? error.message : String(error)) + "\n"); process.exitCode = 1; }
      return;
    }
    case "evaluate": {
      const runId = rest.find(arg => !arg.startsWith("--"));
      const pathIndex = rest.indexOf("--path"), suiteIndex = rest.indexOf("--suite");
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".");
      const suiteId = suiteIndex >= 0 ? rest[suiteIndex + 1] : undefined;
      if (!runId) { process.stderr.write("Usage: forge evaluate RUNID [--suite SUITE_ID] [--path PROJECT]\n"); process.exitCode = 1; return; }
      try {
        const suites = await loadEvaluationSuites(target);
        const suite = suiteId ? suites.find(item => item.id === suiteId) : suites[0];
        if (!suite) throw new Error(suiteId ? "Evaluation suite not found: " + suiteId : "No evaluation suite found. Add one under .forge/evals/.");
        const run = await loadRun(target, runId);
        const judgeEnabled = rest.includes("--judge");
        let report: EvaluationReport | JudgedEvaluationReport;
        if (judgeEnabled) {
          const providerChoice = process.env.FORGE_AI_PROVIDER ?? "openai";
          const model = process.env.FORGE_EVAL_JUDGE_MODEL ?? process.env.FORGE_AI_MODEL ?? process.env.FORGE_MODEL ?? (providerChoice === "claude-code" ? "sonnet" : "gpt-4.1");
          const apiKey = process.env.FORGE_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
          const baseUrl = process.env.FORGE_BASE_URL ?? "https://api.openai.com/v1";
          if (providerChoice !== "claude-code" && !apiKey) throw new Error("Set FORGE_API_KEY or OPENAI_API_KEY to use model-judged evaluation.");
          const judgeProvider = providerChoice === "claude-code" ? new ClaudeCodeProvider({ cwd: target, model }) : new OpenAICompatibleProvider({ apiKey, model, baseUrl });
          report = await evaluateRunWithJudge(run, suite, judgeProvider);
        } else report = evaluateRun(run, suite);
        const reportPath = await saveEvaluationReport(target, report);
        process.stdout.write(formatEvaluationReport(report) + "\n");
        if ("judgedCases" in report) {
          process.stdout.write("Model judge: " + report.judge.provider + (report.judge.model ? " / " + report.judge.model : "") + " · " + report.judge.evaluatedCases + " cases\n");
          for (const item of report.judgedCases) process.stdout.write("  " + item.caseId + " · " + item.result.score + "/100 · " + item.result.rationale + "\n");
        }
        process.stdout.write("Saved: " + reportPath + "\n");
        if (!report.passed || ("judge" in report && !report.judge.passed)) process.exitCode = 2;
      } catch (error) { process.stderr.write("FORGE evaluation failed: " + (error instanceof Error ? error.message : String(error)) + "\n"); process.exitCode = 1; }
      return;
    }
    case "agents": {
      const target = rest.find(arg => !arg.startsWith("--")) ?? ".";
      try {
        const agents = await loadAgentRegistry(path.resolve(target));
        process.stdout.write("FORGE agent registry\n\n");
        for (const agent of agents) {
          process.stdout.write(`  ${agent.id.padEnd(20)} ${agent.name} [${agent.source}]\n    ${agent.description}\n`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE could not load agents: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "skills": {
      const target = path.resolve(rest.find(arg => !arg.startsWith("--")) ?? ".");
      try {
        const skills = await loadSkillRegistry(target);
        process.stdout.write("FORGE skill registry\n\n");
        for (const skill of skills) process.stdout.write("  " + skill.id.padEnd(24) + " " + skill.name + " [" + skill.source + "]\n    " + skill.description + "\n");
      } catch (error) {
        process.stderr.write("Could not load skills: " + (error instanceof Error ? error.message : String(error)) + "\n");
        process.exitCode = 1;
      }
      return;
    }
    case "hooks": {
      const target = path.resolve(rest.find(arg => !arg.startsWith("--")) ?? ".");
      try {
        const hooks = await loadHooks(target);
        process.stdout.write(hooks.length ? hooks.map(hook => hook.id + " [" + hook.event + "] " + hook.action + ": " + hook.message).join("\n") + "\n" : "No lifecycle hooks configured.\n");
      } catch (error) {
        process.stderr.write("Could not load hooks: " + (error instanceof Error ? error.message : String(error)) + "\n");
        process.exitCode = 1;
      }
      return;
    }
    case "memory": {
      const [action = "list", ...memoryArgs] = rest;
      const targetIndex = memoryArgs.findIndex(arg => !arg.startsWith("--"));
      const target = path.resolve(targetIndex >= 0 ? memoryArgs[targetIndex] ?? "." : ".");
      const option = (name: string) => { const index = memoryArgs.indexOf(name); return index >= 0 ? memoryArgs[index + 1] : undefined; };
      try {
        if (action === "list") {
          const entries = await listProjectMemory(target);
          process.stdout.write(entries.length ? entries.map(entry => `${entry.id} [${entry.kind}] ${entry.content}`).join("\n") + "\n" : "No project memory entries.\n");
        } else if (action === "add") {
          const kind = option("--kind") as ProjectMemoryKind | undefined;
          const content = option("--content");
          const allowed: ProjectMemoryKind[] = ["decision", "architecture", "constraint", "preference", "fact"];
          if (!kind || !allowed.includes(kind) || !content) throw new Error("Usage: forge memory add [path] --kind decision|architecture|constraint|preference|fact --content TEXT [--tags a,b]");
          const tags = option("--tags")?.split(",") ?? [];
          const entry = await addProjectMemory(target, { kind, content, tags });
          process.stdout.write(`Saved ${entry.id} to .forge/memory.json\n`);
        } else if (action === "remove") {
          const id = memoryArgs.find(arg => arg.startsWith("mem-"));
          if (!id) throw new Error("Usage: forge memory remove [path] mem-ID");
          const removed = await removeProjectMemory(target, id);
          process.stdout.write(removed ? `Removed ${id}.\n` : `Memory entry ${id} was not found.\n`);
        } else if (action === "context") {
          const query = option("--query") ?? "";
          const context = await buildProjectMemoryContext(target, query);
          process.stdout.write(context.text || "No relevant project memory.\n");
        } else {
          throw new Error("Memory actions: add, list, remove, context.");
        }
      } catch (error) {
        process.stderr.write("FORGE memory command failed: " + (error instanceof Error ? error.message : String(error)) + "\n");
        process.exitCode = 1;
      }
      return;
    }
    case "plan": {
      const goalIndex = rest.indexOf("--goal");
      const pathIndex = rest.indexOf("--path");
      const goalEnd = pathIndex >= 0 ? pathIndex : rest.length;
      const goal = goalIndex >= 0 ? rest.slice(goalIndex + 1, goalEnd).join(" ").trim() : "";
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".");
      try {
        const plan = createReviewPlan(goal);
        const saved = await saveRun(target, plan);
        process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
        process.stdout.write(`\nDraft plan saved to ${path.relative(target, saved)}. No AI provider was called and no files or commands were executed.\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE could not create a plan: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "replay": {
      const runId = rest[0] ?? "";
      const pathIndex = rest.indexOf("--path");
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".");
      try {
        if (!runId) throw new Error("Usage: forge replay RUN_ID [--path PROJECT]");
        const source = await loadRun(target, runId);
        const replay = createReplayRun(source);
        const saved = await saveRun(target, replay);
        process.stdout.write("Created replay " + replay.id + " from " + runId + ".\n");
        process.stdout.write("Saved: " + path.relative(target, saved) + "\n");
        process.stdout.write("Run `forge resume " + replay.id + " --path " + target + "` when ready to call the configured provider.\n");
      } catch (error) { process.stderr.write("Could not create replay: " + (error instanceof Error ? error.message : String(error)) + "\n"); process.exitCode = 1; }
      return;
    }
    case "approve": {
      const runId = rest[0] ?? "";
      const taskId = rest[1] ?? "";
      const pathIndex = rest.indexOf("--path");
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".");
      const reviewerIndex = rest.indexOf("--reviewer");
      const reasonIndex = rest.indexOf("--reason");
      try {
        if (!runId || !taskId) throw new Error("Usage: forge approve RUN_ID TASK_ID [--reviewer NAME] [--reason TEXT] [--path PROJECT]");
        const updated = await decideTaskApproval(target, runId, taskId, "approved", reviewerIndex >= 0 ? rest[reviewerIndex + 1] ?? "local-user" : "local-user", reasonIndex >= 0 ? rest.slice(reasonIndex + 1, pathIndex >= 0 ? pathIndex : rest.length).join(" ") : undefined);
        process.stdout.write("Approved " + taskId + " in " + runId + ". Resume explicitly with `forge resume " + runId + "`.\n");
        process.stdout.write("Run status: " + updated.status + "\n");
      } catch (error) { process.stderr.write("Could not approve task: " + (error instanceof Error ? error.message : String(error)) + "\n"); process.exitCode = 1; }
      return;
    }
    case "resume": {
      const runId = rest[0] ?? "";
      const pathIndex = rest.indexOf("--path");
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".");
      try {
        if (!runId) throw new Error("Usage: forge resume RUN_ID [--path PROJECT]");
        const savedRun = await loadRun(target, runId);
        if (savedRun.status !== "pending" && savedRun.status !== "awaiting_approval") throw new Error("Only pending or approval-cleared runs can be resumed. Use `forge replay` for a failed run.");
        const model = process.env.FORGE_AI_MODEL ?? process.env.FORGE_MODEL;
        const providerChoice = (process.env.FORGE_AI_PROVIDER ?? "openai").toLowerCase();
        const baseModel = model ?? (providerChoice === "claude-code" ? "sonnet" : "gpt-4.1-mini");
        const apiKey = process.env.FORGE_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
        const baseUrl = process.env.FORGE_BASE_URL ?? "https://api.openai.com/v1";
        if (providerChoice !== "claude-code" && !apiKey) throw new Error("Set FORGE_AI_PROVIDER=claude-code or FORGE_API_KEY before resuming.");
        const createProvider = (selectedModel: string) => providerChoice === "claude-code" ? new ClaudeCodeProvider({ cwd: target, model: selectedModel }) : new OpenAICompatibleProvider({ apiKey, model: selectedModel, baseUrl });
        const router = new ModelRouter({ fastModel: process.env.FORGE_MODEL_FAST ?? baseModel, balancedModel: process.env.FORGE_MODEL_BALANCED ?? baseModel, reasoningModel: process.env.FORGE_MODEL_REASONING ?? baseModel, ...(process.env.FORGE_FALLBACK_MODEL ? { fallbackModel: process.env.FORGE_FALLBACK_MODEL } : {}), retryAttempts: Number(process.env.FORGE_MODEL_RETRY_ATTEMPTS ?? 2), retryDelayMs: Number(process.env.FORGE_MODEL_RETRY_DELAY_MS ?? 500), ...(process.env.FORGE_MAX_INPUT_TOKENS_PER_TASK ? { maxInputTokensPerTask: Number(process.env.FORGE_MAX_INPUT_TOKENS_PER_TASK) } : {}), ...(process.env.FORGE_MAX_OUTPUT_TOKENS_PER_TASK ? { maxOutputTokensPerTask: Number(process.env.FORGE_MAX_OUTPUT_TOKENS_PER_TASK) } : {}), ...(process.env.FORGE_MAX_ESTIMATED_TOKENS_PER_RUN ? { maxEstimatedTokensPerRun: Number(process.env.FORGE_MAX_ESTIMATED_TOKENS_PER_RUN) } : {}),
          ...(process.env.FORGE_MAX_ESTIMATED_TOKENS_PER_AGENT ? { maxEstimatedTokensPerAgent: readAgentTokenBudgets()! } : {}),
          ...(process.env.FORGE_MAX_TASK_DURATION_MS ? { maxTaskDurationMs: Number(process.env.FORGE_MAX_TASK_DURATION_MS) } : {}),
          ...(process.env.FORGE_MAX_TASK_DURATION_MS_BY_AGENT ? { maxTaskDurationMsByAgent: readAgentDurationBudgets()! } : {}), createProvider });
        const memory = await buildProjectMemoryContext(target, savedRun.goal);
        let persistedTraceEntries = 0;
        const completed = await advanceRun(savedRun, router, new Set(), { maxConcurrency: 4, projectContext: memory.text, shouldCancel: async () => (await loadRun(target, runId)).status === "cancelled", onUpdate: async snapshot => {
          await saveRun(target, snapshot);
          const newEntries = router.traces.slice(persistedTraceEntries);
          if (newEntries.length) { await saveExecutionTrace(target, snapshot.id, newEntries); persistedTraceEntries = router.traces.length; }
        } });
        const saved = await saveRun(target, completed);
        const tracePath = await saveExecutionTrace(target, completed.id, router.traces.slice(persistedTraceEntries));
        process.stdout.write("Resumed " + runId + ": " + completed.status + "\n");
        process.stdout.write("Saved: " + path.relative(target, saved) + "\nTrace: " + path.relative(target, tracePath) + "\n");
      } catch (error) { process.stderr.write("Could not resume run: " + (error instanceof Error ? error.message : String(error)) + "\n"); process.exitCode = 1; }
      return;
    }
    case "trace": {
      const runId = rest[0];
      const pathIndex = rest.indexOf("--path");
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".");
      if (!runId) { process.stderr.write("Usage: forge trace RUNID [--path PROJECT]\n"); process.exitCode = 1; return; }
      try {
        const trace = await loadExecutionTrace(target, runId);
        process.stdout.write("FORGE execution trace: " + runId + "\n");
        for (const entry of trace.entries) process.stdout.write("  " + entry.taskId + " [" + entry.tier + "] " + entry.model + " | " + entry.durationMs + " ms | " + entry.outcome + " | ~" + entry.inputTokensEstimate + "/" + entry.outputTokensEstimate + " tokens\n");
        process.stdout.write("Totals: " + trace.totals.tasks + " tasks, " + trace.totals.estimatedInputTokens + " input tokens, " + trace.totals.estimatedOutputTokens + " output tokens, " + trace.totals.fallbacks + " fallbacks, " + trace.totals.failures + " failures\n");
        process.stdout.write("Provider health:\n");
        for (const provider of trace.providers ?? []) process.stdout.write("  " + provider.name + ": " + provider.requests + " requests, " + provider.successes + " successes, " + provider.fallbacks + " fallbacks, " + provider.failures + " failures, " + provider.retries + " retries, " + provider.durationMs + " ms\n");
      } catch (error) { process.stderr.write("Could not read execution trace: " + (error instanceof Error ? error.message : String(error)) + "\n"); process.exitCode = 1; }
      return;
    }
    case "runs": {
      const target = rest.find(arg => !arg.startsWith("--")) ?? ".";
      try {
        const runs = await listRuns(path.resolve(target));
        process.stdout.write(runs.length ? runs.map(run => `${run.id}  ${run.status.padEnd(18)} ${run.goal}`).join("\n") + "\n" : "No saved FORGE runs.\n");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Could not list run history: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "show-run": {
      const id = rest.find(arg => !arg.startsWith("--")) ?? "";
      const pathIndex = rest.indexOf("--path");
      const target = pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".";
      try {
        if (!id) throw new Error("Usage: forge show-run RUN_ID [--path PROJECT]");
        const run = await loadRun(path.resolve(target), id);
        process.stdout.write(`${JSON.stringify(run, null, 2)}\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Could not load run: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "run": {
      const goalIndex = rest.indexOf("--goal");
      const pathIndex = rest.indexOf("--path");
      const goalEnd = pathIndex >= 0 ? pathIndex : rest.length;
      const goal = goalIndex >= 0 ? rest.slice(goalIndex + 1, goalEnd).join(" ").trim() : "";
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".");
      try {
        const model = process.env.FORGE_AI_MODEL ?? process.env.FORGE_MODEL;
        const providerChoice = (process.env.FORGE_AI_PROVIDER ?? "openai").toLowerCase();
        const baseModel = model ?? (providerChoice === "claude-code" ? "sonnet" : "gpt-4.1-mini");
        const apiKey = process.env.FORGE_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
        const baseUrl = process.env.FORGE_BASE_URL ?? "https://api.openai.com/v1";
        if (providerChoice !== "claude-code" && !apiKey) throw new Error("Set FORGE_AI_PROVIDER=claude-code to use your configured Claude Code CLI, or set FORGE_API_KEY for an OpenAI-compatible provider.");
        const createProvider = (selectedModel: string) => providerChoice === "claude-code"
          ? new ClaudeCodeProvider({ cwd: target, model: selectedModel })
          : new OpenAICompatibleProvider({ apiKey, model: selectedModel, baseUrl });
        const router = new ModelRouter({
          fastModel: process.env.FORGE_MODEL_FAST ?? baseModel,
          balancedModel: process.env.FORGE_MODEL_BALANCED ?? baseModel,
          reasoningModel: process.env.FORGE_MODEL_REASONING ?? baseModel,
          ...(process.env.FORGE_FALLBACK_MODEL ? { fallbackModel: process.env.FORGE_FALLBACK_MODEL } : {}),
          retryAttempts: Number(process.env.FORGE_MODEL_RETRY_ATTEMPTS ?? 2),
          retryDelayMs: Number(process.env.FORGE_MODEL_RETRY_DELAY_MS ?? 500),
          createProvider,
          ...(process.env.FORGE_MAX_INPUT_TOKENS_PER_TASK ? { maxInputTokensPerTask: Number(process.env.FORGE_MAX_INPUT_TOKENS_PER_TASK) } : {}),
          ...(process.env.FORGE_MAX_OUTPUT_TOKENS_PER_TASK ? { maxOutputTokensPerTask: Number(process.env.FORGE_MAX_OUTPUT_TOKENS_PER_TASK) } : {}),
          ...(process.env.FORGE_MAX_ESTIMATED_TOKENS_PER_RUN ? { maxEstimatedTokensPerRun: Number(process.env.FORGE_MAX_ESTIMATED_TOKENS_PER_RUN) } : {}),
          ...(process.env.FORGE_MAX_ESTIMATED_TOKENS_PER_AGENT ? { maxEstimatedTokensPerAgent: readAgentTokenBudgets()! } : {}),
          ...(process.env.FORGE_MAX_TASK_DURATION_MS ? { maxTaskDurationMs: Number(process.env.FORGE_MAX_TASK_DURATION_MS) } : {}),
          ...(process.env.FORGE_MAX_TASK_DURATION_MS_BY_AGENT ? { maxTaskDurationMsByAgent: readAgentDurationBudgets()! } : {}),
        });
        const provider = router;
        const plan = createReviewPlan(goal);
        const skills = selectSkills(await loadSkillRegistry(target), goal);
        const skillContext = formatSkillContext(skills);
        const hooks = await loadHooks(target);
        for (const record of plan.tasks) {
          const applied = applyBeforeAgentHooks(record.task, hooks);
          record.task = { ...applied.task, prompt: applied.context.length ? applied.task.prompt + "\n\nHook guidance:\n" + applied.context.join("\n") : applied.task.prompt };
          if (applied.blockedReason) { record.status = "blocked"; record.error = "Blocked by policy hook: " + applied.blockedReason; }
        }
        process.stdout.write("Starting " + plan.id + " with provider " + provider.name + (model ? " (model " + model + ")" : "") + "\n");
        if (skills.length) process.stdout.write("Selected skills: " + skills.map(skill => skill.id).join(", ") + "\n");
        if (hooks.length) process.stdout.write("Loaded policy hooks: " + hooks.length + "\n");
        const memory = await buildProjectMemoryContext(target, goal);
        const projectContext = [memory.text, skillContext].filter(Boolean).join("\n\n");
        const completed = await advanceRun(plan, provider, new Set(), { maxConcurrency: 4, projectContext });
        const saved = await saveRun(target, completed);
        const tracePath = await saveExecutionTrace(target, completed.id, router.traces);
        process.stdout.write(`Run status: ${completed.status}\nSaved history: ${path.relative(target, saved)}\nExecution trace: ${path.relative(target, tracePath)}\n`);
        const totals = router.traces.reduce((sum, trace) => ({ input: sum.input + trace.inputTokensEstimate, output: sum.output + trace.outputTokensEstimate, duration: sum.duration + trace.durationMs, fallback: sum.fallback + (trace.outcome === "fallback" ? 1 : 0) }), { input: 0, output: 0, duration: 0, fallback: 0 });
        process.stdout.write(`Estimated tokens: ${totals.input} in / ${totals.output} out | Agent time: ${totals.duration} ms | Fallbacks: ${totals.fallback}\n`);
        for (const task of completed.tasks) process.stdout.write(`  ${task.status.padEnd(18)} ${task.task.agent}: ${task.task.title}\n`);
        if (completed.status === "failed") process.exitCode = 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE run failed: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "deps": {
      if (rest.includes("--help")) {
        process.stdout.write("Usage: forge deps [path] [--audit-report FILE] [--outdated-report FILE] [--json]\n");
        return;
      }
      const option = (name:string) => { const index=rest.indexOf(name); return index>=0 ? rest[index+1] : undefined; };
      const target=path.resolve(rest.find((arg,index)=>!arg.startsWith("--")&&rest[index-1]!=="--audit-report"&&rest[index-1]!=="--outdated-report")??".");
      try {
        const auditReport=option("--audit-report"),outdatedReport=option("--outdated-report");
        const report=await analyzeDependencies(target,{...(auditReport?{auditReport}:{}),...(outdatedReport?{outdatedReport}:{})});
        process.stdout.write(rest.includes("--json")?JSON.stringify(report,null,2)+"\n":formatDependencyIntelligence(report)+"\n");
      } catch(error) {
        process.stderr.write("FORGE dependency analysis failed: "+(error instanceof Error?error.message:String(error))+"\n");
        process.exitCode=1;
      }
      return;
    }
    case "snapshot": {
      const target=path.resolve(rest.find(arg=>!arg.startsWith("--"))??".");
      try { const comparison=await captureIntelligenceSnapshot(target);process.stdout.write(formatIntelligenceComparison(comparison)+"\n"); }
      catch(error){process.stderr.write("FORGE snapshot failed: "+(error instanceof Error?error.message:String(error))+"\n");process.exitCode=1;}
      return;
    }
    case "timeline": {
      const target=path.resolve(rest.find(arg=>!arg.startsWith("--"))??".");
      try { const comparison=await compareLatestIntelligence(target);process.stdout.write(comparison?formatIntelligenceComparison(comparison)+"\n":"No engineering snapshots found. Run forge snapshot . first.\n"); }
      catch(error){process.stderr.write("FORGE timeline failed: "+(error instanceof Error?error.message:String(error))+"\n");process.exitCode=1;}
      return;
    }
    case "change-risk": {
      const pathIndex=rest.indexOf("--path"),baseIndex=rest.indexOf("--base");
      const target=path.resolve(pathIndex>=0?rest[pathIndex+1]??".":rest.find((arg,index)=>!arg.startsWith("--")&&rest[index-1]!=="--base")??".");
      const base=baseIndex>=0?rest[baseIndex+1]??"HEAD":"HEAD";
      const json=rest.includes("--json");
      try { const report=await analyzeChangeIntelligence(target,base);process.stdout.write(json?JSON.stringify(report,null,2)+"\n":formatChangeIntelligence(report)+"\n"); }
      catch(error){process.stderr.write("FORGE change-risk analysis failed: "+(error instanceof Error?error.message:String(error))+"\n");process.exitCode=1;}
      return;
    }
    case "risk": {
      const pathIndex=rest.indexOf("--path");
      const target=path.resolve(pathIndex>=0?rest[pathIndex+1]??".":rest.find(arg=>!arg.startsWith("--"))??".");
      const json=rest.includes("--json");
      try { const report=await analyzeEngineeringRisk(target);process.stdout.write(json?JSON.stringify(report,null,2)+"\n":formatEngineeringRisk(report)+"\n"); }
      catch(error){process.stderr.write("FORGE engineering risk analysis failed: "+(error instanceof Error?error.message:String(error))+"\n");process.exitCode=1;}
      return;
    }
    case "impact": {
      const pathIndex=rest.indexOf("--path"),baseIndex=rest.indexOf("--base");
      const target=path.resolve(pathIndex>=0?rest[pathIndex+1]??".":rest.find((arg,index)=>!arg.startsWith("--")&&rest[index-1]!=="--base")??".");
      const base=baseIndex>=0?rest[baseIndex+1]??"HEAD":"HEAD";
      const json=rest.includes("--json");
      try { const report=await analyzeDependencyImpact(target,base);process.stdout.write(json?JSON.stringify(report,null,2)+"\n":formatDependencyImpact(report)+"\n"); }
      catch(error){process.stderr.write("FORGE dependency impact analysis failed: "+(error instanceof Error?error.message:String(error))+"\n");process.exitCode=1;}
      return;
    }
    case "search": {
      const pathIndex=rest.indexOf("--path"),limitIndex=rest.indexOf("--limit");
      const optionValues=new Set<number>();
      if(pathIndex>=0)optionValues.add(pathIndex+1);
      if(limitIndex>=0)optionValues.add(limitIndex+1);
      const target=path.resolve(pathIndex>=0?rest[pathIndex+1]??".":".");
      const query=rest.filter((arg,index)=>!arg.startsWith("--")&&!optionValues.has(index)).join(" ").trim();
      const limit=limitIndex>=0?Number(rest[limitIndex+1]):80;
      try { const report=await searchWorkspace(target,query,limit);process.stdout.write(JSON.stringify(report,null,2)+"\n"); }
      catch(error){process.stderr.write("FORGE code search failed: "+(error instanceof Error?error.message:String(error))+"\n");process.exitCode=1;}
      return;
    }
    case "dashboard": {
      const target = path.resolve(rest.find(arg => !arg.startsWith("--")) ?? ".");
      const portIndex = rest.indexOf("--port");
      const portValue = portIndex >= 0 ? Number(rest[portIndex + 1]) : 4173;
      if (!Number.isInteger(portValue) || portValue < 0 || portValue > 65535) {
        process.stderr.write("Dashboard port must be an integer from 0 to 65535.\n");
        process.exitCode = 1;
        return;
      }
      try {
        const dashboard = await startDashboard({ projectPath: target, port: portValue });
        const address = dashboard.server.address();
        const actualPort = address && typeof address !== "string" ? address.port : portValue;
        process.stdout.write(`FORGE dashboard: http://127.0.0.1:${actualPort}\nProject: ${target}\nPress Ctrl+C to stop.\n`);
        const shutdown = () => dashboard.server.close(() => process.exit(0));
        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Could not start dashboard: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "verify": {
      const listOnly = rest.includes("--list");
      const pathIndex = rest.indexOf("--path");
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : ".");
      const script = rest.find(arg => !arg.startsWith("--"));
      try {
        if (listOnly) {
          const checks = await discoverChecks(target);
          process.stdout.write(checks.length ? checks.map(check => `${check.name.padEnd(20)} ${check.command}`).join("\n") + "\n" : "No selectable npm scripts found.\n");
          return;
        }
        if (!script) throw new Error("Choose one script explicitly. Usage: forge verify SCRIPT [--path PROJECT], or use --list to discover scripts.");
        const result = await runVerification(target, script);
        const comparison = await compareVerification(target, result);
        await saveVerification(target, result);
        process.stdout.write(`${formatVerificationResult(result)}\n\n${formatVerificationComparison(comparison)}\n`);
        process.stdout.write(`\nSaved verification history: ${path.relative(target, path.join(target, ".forge", "verifications", result.id + ".json"))}\n`);
        if (result.status !== "passed") process.exitCode = 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE verification failed: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "verify-history": {
      const targetIndex = rest.indexOf("--path");
      const target = path.resolve(targetIndex >= 0 ? rest[targetIndex + 1] ?? "." : ".");
      try {
        const history = await listVerifications(target);
        if (!history.length) { process.stdout.write("No saved verification runs.\n"); return; }
        process.stdout.write(history.map(item => `${item.startedAt}  ${item.status.padEnd(12)} ${item.script.padEnd(16)} ${item.durationMs} ms  ${item.id}`).join("\n") + "\n");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Could not load verification history: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "review": {
      const json = rest.includes("--json");
      const all = rest.includes("--all");
      const pathIndex = rest.indexOf("--path");
      const baseIndex = rest.indexOf("--base");
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : rest.find((arg,index) => !arg.startsWith("--") && rest[index-1] !== "--base" && rest[index-1] !== "--path") ?? ".");
      const base = baseIndex >= 0 ? rest[baseIndex + 1] ?? "HEAD" : "HEAD";
      try {
        const report = await reviewProject(target, { base, all });
        let ai: Awaited<ReturnType<typeof generateAIReview>> | undefined;
        if (rest.includes("--ai")) {
          const apiKey = process.env.FORGE_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
          if (!apiKey) throw new Error("Set FORGE_API_KEY (or OPENAI_API_KEY) before using --ai.");
          const provider = new OpenAICompatibleProvider({ apiKey, model: process.env.FORGE_MODEL ?? "gpt-4.1-mini", baseUrl: process.env.FORGE_BASE_URL ?? "https://api.openai.com/v1" });
          ai = await generateAIReview(report, provider);
        }
        const saved = await saveReview(target, report, ai);
        process.stdout.write(json ? JSON.stringify({ ...saved, reviewId: saved.id }, null, 2) + "\n" : formatCodeReview(report) + (ai ? "\n\n" + formatAIReview(ai) : "") + "\n\nSaved review: " + saved.id + "\n");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE code review failed: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "review-history": {
      const target = path.resolve(rest.find((arg,index)=>!arg.startsWith("--")&&rest[index-1]!=="--path") ?? ".");
      try { const records=await listReviews(target); process.stdout.write(records.length?records.map(r=>r.id+"  "+r.createdAt+"  "+r.report.findings.length+" static findings").join("\n")+"\n":"No saved reviews found.\n"); }
      catch(error){process.stderr.write("FORGE review history failed: "+(error instanceof Error?error.message:String(error))+"\n");process.exitCode=1;}
      return;
    }
    case "review-show": {
      const id=rest.find(arg=>!arg.startsWith("--")) ?? "";
      const pathIndex=rest.indexOf("--path");const target=path.resolve(pathIndex>=0?rest[pathIndex+1]??".":".");
      try { const record=await loadReview(target,id); process.stdout.write(formatReviewRecord(record)+"\n"); }
      catch(error){process.stderr.write("FORGE could not load review: "+(error instanceof Error?error.message:String(error))+"\n");process.exitCode=1;}
      return;
    }
    case "review-compare": {
      const ids=rest.filter((arg,index)=>!arg.startsWith("--")&&rest[index-1]!=="--path");
      const pathIndex=rest.indexOf("--path");const target=path.resolve(pathIndex>=0?rest[pathIndex+1]??".":".");
      try { if(ids.length<2)throw new Error("Usage: forge review-compare REVIEW_ID_A REVIEW_ID_B --path PROJECT"); const [a,b]=await Promise.all([loadReview(target,ids[0]!),loadReview(target,ids[1]!)]);const diff=compareReviews(a,b);process.stdout.write(["Review comparison", "Added ("+diff.added.length+")",...diff.added.map(x=>"+ "+x),"Resolved ("+diff.resolved.length+")",...diff.resolved.map(x=>"- "+x),"Persistent ("+diff.persistent.length+")",...diff.persistent.map(x=>"= "+x)].join("\n")+"\n"); }
      catch(error){process.stderr.write("FORGE review comparison failed: "+(error instanceof Error?error.message:String(error))+"\n");process.exitCode=1;}
      return;
    }
    case "regression": {
      const pathIndex=rest.indexOf("--path");
      const baseIndex=rest.indexOf("--base");
      const target=path.resolve(pathIndex>=0?rest[pathIndex+1]??".":rest.find((arg,index)=>!arg.startsWith("--")&&rest[index-1]!=="--base")??".");
      const base=baseIndex>=0?rest[baseIndex+1]??"HEAD":"HEAD";
      const json=rest.includes("--json");
      try {
        const report=await generateRegressionReport(target,base);
        process.stdout.write(json?JSON.stringify(report,null,2)+"\n":formatRegressionReport(report)+"\n");
        if(report.summary.regressions>0)process.exitCode=1;
      } catch(error) {
        process.stderr.write("FORGE regression analysis failed: "+(error instanceof Error?error.message:String(error))+"\n");
        process.exitCode=1;
      }
      return;
    }
    case "patch-check": {
      const id=rest.find((arg,index)=>!arg.startsWith("--")&&rest[index-1]!=="--path") ?? "";
      const pathIndex=rest.indexOf("--path");
      const target=path.resolve(pathIndex>=0?rest[pathIndex+1]??".":".");
      const numberArg=rest.find((arg,index)=>index>0&&!arg.startsWith("--")&&rest[index-1]!==id&&rest[index-1]!=="--path");
      try {
        if(!id||!numberArg)throw new Error("Usage: forge patch-check REVIEW_ID SUGGESTION_NUMBER --path PROJECT");
        const record=await loadReview(target,id);
        const result=await validateReviewPatch(target,record,Number(numberArg));
        process.stdout.write(formatPatchValidation(result)+"\n");
        if(result.status!=="applicable")process.exitCode=1;
      } catch(error) {
        process.stderr.write("FORGE patch validation failed: "+(error instanceof Error?error.message:String(error))+"\n");
        process.exitCode=1;
      }
      return;
    }
    case "git": {
      const json = rest.includes("--json");
      const pathIndex = rest.indexOf("--path");
      const baseIndex = rest.indexOf("--base");
      const target = path.resolve(pathIndex >= 0 ? rest[pathIndex + 1] ?? "." : rest.find(arg => !arg.startsWith("--")) ?? ".");
      const base = baseIndex >= 0 ? rest[baseIndex + 1] ?? "HEAD" : "HEAD";
      try {
        const report = await analyzeGitChanges(target, base);
        process.stdout.write(json ? JSON.stringify(report, null, 2) + "\n" : formatGitIntelligence(report) + "\n");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE Git analysis failed: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "deep": {
      const json = rest.includes("--json");
      const target = path.resolve(rest.find(arg => !arg.startsWith("--")) ?? ".");
      try {
        const report = await analyzeCodebase(target);
        process.stdout.write(json ? JSON.stringify(report, null, 2) + "\n" : formatCodebaseAnalysis(report) + "\n");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE deep analysis failed: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "remediate": {
      if (rest.includes("--help")) {
        process.stdout.write("Usage: forge remediate [path] [--audit-report FILE] [--outdated-report FILE] [--json]\n");
        return;
      }
      const option = (name: string) => { const index = rest.indexOf(name); return index >= 0 ? rest[index + 1] : undefined; };
      const target = path.resolve(rest.find((arg, index) => !arg.startsWith("--") && rest[index - 1] !== "--audit-report" && rest[index - 1] !== "--outdated-report") ?? ".");
      try {
        const auditReport = option("--audit-report"), outdatedReport = option("--outdated-report");
        const plan = await generateRemediationPlan(target, { ...(auditReport ? { auditReport } : {}), ...(outdatedReport ? { outdatedReport } : {}) });
        process.stdout.write(rest.includes("--json") ? JSON.stringify(plan, null, 2) + "\n" : formatRemediationPlan(plan) + "\n");
      } catch (error) {
        process.stderr.write("FORGE remediation planning failed: " + (error instanceof Error ? error.message : String(error)) + "\n");
        process.exitCode = 1;
      }
      return;
    }
    case "health": {
      const json = rest.includes("--json");
      const target = path.resolve(rest.find(arg => !arg.startsWith("--")) ?? ".");
      try {
        const report = await generateProjectHealth(target);
        process.stdout.write(json ? JSON.stringify(report, null, 2) + "\n" : formatProjectHealthMarkdown(report) + "\n");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE health report failed: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "quality": {
      if (rest.includes("--help")) {
        process.stdout.write("Usage: forge quality [path] [--json]\n");
        return;
      }
      const json = rest.includes("--json");
      const target = rest.find(arg => !arg.startsWith("--")) ?? ".";
      try {
        const report = await auditProject(path.resolve(target));
        process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : `${formatQualityAudit(report)}\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE quality audit failed: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "inspect":
    case "map": {
      if (rest.includes("--help")) {
        process.stdout.write(`Usage: forge ${command} [path] [--json]\n`);
        return;
      }
      const json = rest.includes("--json");
      const target = rest.find(arg => !arg.startsWith("--")) ?? ".";
      try {
        if (command === "inspect") {
          const report = await inspectProject(path.resolve(target));
          process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : `${formatProjectReport(report)}\n`);
        } else {
          const report = await mapArchitecture(path.resolve(target));
          process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : `${formatArchitectureMap(report)}\n`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`FORGE could not ${command} this project: ${message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\nRun "forge help" to see available commands.\n`);
      process.exitCode = 1;
  }
}
void main(process.argv.slice(2));
