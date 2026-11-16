#!/usr/bin/env node

import path from "node:path";
import { initializeProject } from "./core/project-init.js";
import { formatArchitectureMap, mapArchitecture } from "./core/architecture-map.js";
import { formatProjectReport, inspectProject } from "./core/project-inspector.js";
import { loadAgentRegistry } from "./core/agent-registry.js";
import { createReviewPlan } from "./core/review-planner.js";
import { saveRun, listRuns, loadRun } from "./core/run-store.js";
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

const VERSION = "0.34.0";

const HELP = `
FORGE — The AI Engineering Workbench

Usage:
  forge <command> [options]

Commands:
  init [path]      Create a safe, local-first .forge starter workspace
  inspect [path]   Analyze project languages, tooling, dependencies, and scripts
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
  agents [path]    List built-in and workspace agent roles\n  memory <action>  Manage local project memory (add, list, remove, context)
  plan --goal TEXT Create and save a reviewable draft plan
  run --goal TEXT  Run the plan using a configured AI provider
  runs [path]      List locally saved run history
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
    case "memory": {
      const [action = "list", ...memoryArgs] = rest;
      const targetIndex = memoryArgs.findIndex(arg => !arg.startsWith("--"));
      const target = path.resolve(targetIndex >= 0 ? memoryArgs[targetIndex] ?? "." : ".");
      const option = (name: string) => { const index = memoryArgs.indexOf(name); return index >= 0 ? memoryArgs[index + 1] : undefined; };
      try {
        if (action === "list") {
          const entries = await listProjectMemory(target);
          process.stdout.write(entries.length ? entries.map(entry => `${entry.id} [${entry.kind}] ${entry.content}`).join("\n") + "\n" : "No project memory entries.\\n");
        } else if (action === "add") {
          const kind = option("--kind") as ProjectMemoryKind | undefined;
          const content = option("--content");
          const allowed: ProjectMemoryKind[] = ["decision", "architecture", "constraint", "preference", "fact"];
          if (!kind || !allowed.includes(kind) || !content) throw new Error("Usage: forge memory add [path] --kind decision|architecture|constraint|preference|fact --content TEXT [--tags a,b]");
          const tags = option("--tags")?.split(",") ?? [];
          const entry = await addProjectMemory(target, { kind, content, tags });
          process.stdout.write(`Saved ${entry.id} to .forge/memory.json\\n`);
        } else if (action === "remove") {
          const id = memoryArgs.find(arg => arg.startsWith("mem-"));
          if (!id) throw new Error("Usage: forge memory remove [path] mem-ID");
          const removed = await removeProjectMemory(target, id);
          process.stdout.write(removed ? `Removed ${id}.\\n` : `Memory entry ${id} was not found.\\n`);
        } else if (action === "context") {
          const query = option("--query") ?? "";
          const context = await buildProjectMemoryContext(target, query);
          process.stdout.write(context.text || "No relevant project memory.\\n");
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
        const providerChoice = (process.env.FORGE_AI_PROVIDER ?? "openai").toLowerCase();
        const model = process.env.FORGE_AI_MODEL ?? process.env.FORGE_MODEL;
        const provider = providerChoice === "claude-code"
          ? new ClaudeCodeProvider({ cwd: target, ...(model ? { model } : {}) })
          : (() => {
              const apiKey = process.env.FORGE_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
              const selectedModel = model ?? "gpt-4.1-mini";
              const baseUrl = process.env.FORGE_BASE_URL ?? "https://api.openai.com/v1";
              if (!apiKey) throw new Error("Set FORGE_AI_PROVIDER=claude-code to use your configured Claude Code CLI, or set FORGE_API_KEY for an OpenAI-compatible provider.");
              return new OpenAICompatibleProvider({ apiKey, model: selectedModel, baseUrl });
            })();
        const plan = createReviewPlan(goal);
        process.stdout.write(`Starting ${plan.id} with provider ${provider.name}...${model ? ` (model ${model})` : ""}\n`);
        const memory = await buildProjectMemoryContext(target, goal);
        const completed = await advanceRun(plan, provider, new Set(), { maxConcurrency: 4, projectContext: memory.text });
        const saved = await saveRun(target, completed);
        process.stdout.write(`Run status: ${completed.status}\nSaved history: ${path.relative(target, saved)}\n`);
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
        process.stdout.write("Usage: forge deps [path] [--audit-report FILE] [--outdated-report FILE] [--json]\\n");
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
        process.stdout.write("Usage: forge remediate [path] [--audit-report FILE] [--outdated-report FILE] [--json]\\n");
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
