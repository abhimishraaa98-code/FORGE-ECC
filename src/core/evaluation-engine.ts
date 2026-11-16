import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunRecord } from "./orchestrator.js";

export interface EvaluationCriterion {
  id: string;
  weight: number;
  requiredTerms?: string[];
  forbiddenTerms?: string[];
  minWords?: number;
  maxWords?: number;
}
export interface EvaluationCase {
  id: string;
  description: string;
  agent?: string;
  taskId?: string;
  criteria: EvaluationCriterion[];
}
export interface EvaluationSuite {
  id: string;
  name: string;
  description: string;
  cases: EvaluationCase[];
}
export interface CriterionResult {
  id: string;
  weight: number;
  passed: boolean;
  checks: Array<{ rule: string; passed: boolean; detail: string }>;
}
export interface EvaluationCaseResult {
  caseId: string;
  taskId: string;
  agent: string;
  status: "scored" | "missing-output";
  score: number;
  passed: boolean;
  criteria: CriterionResult[];
}
export interface EvaluationReport {
  version: 1;
  suiteId: string;
  suiteName: string;
  runId: string;
  evaluatedAt: string;
  score: number;
  passed: boolean;
  cases: EvaluationCaseResult[];
  summary: { total: number; scored: number; passed: number; missingOutput: number };
}
const SAFE_ID = /^[a-z0-9][a-z0-9-]{1,47}$/;
function validateSuite(value: unknown, file: string): EvaluationSuite {
  if (!value || typeof value !== "object") throw new Error(`Invalid evaluation suite: ${file}`);
  const suite = value as EvaluationSuite;
  if (!SAFE_ID.test(suite.id) || typeof suite.name !== "string" || !suite.name.trim() || !Array.isArray(suite.cases) || suite.cases.length < 1 || suite.cases.length > 100) throw new Error(`Invalid evaluation suite metadata: ${file}`);
  const ids = new Set<string>();
  for (const item of suite.cases) {
    if (!item || !SAFE_ID.test(item.id) || ids.has(item.id) || typeof item.description !== "string" || (!item.agent && !item.taskId) || !Array.isArray(item.criteria) || item.criteria.length < 1) throw new Error(`Invalid evaluation case in ${file}`);
    ids.add(item.id);
    const criteriaIds = new Set<string>();
    for (const criterion of item.criteria) {
      if (!SAFE_ID.test(criterion.id) || criteriaIds.has(criterion.id) || !Number.isFinite(criterion.weight) || criterion.weight <= 0 || criterion.weight > 100 || (!criterion.requiredTerms?.length && !criterion.forbiddenTerms?.length && criterion.minWords === undefined && criterion.maxWords === undefined)) throw new Error(`Invalid criterion in evaluation case ${item.id}`);
      criteriaIds.add(criterion.id);
      if ([...(criterion.requiredTerms ?? []), ...(criterion.forbiddenTerms ?? [])].some(term => typeof term !== "string" || !term.trim() || term.length > 160)) throw new Error(`Invalid terms in evaluation criterion ${criterion.id}`);
      if (criterion.minWords !== undefined && (!Number.isSafeInteger(criterion.minWords) || criterion.minWords < 0)) throw new Error(`Invalid minWords in criterion ${criterion.id}`);
      if (criterion.maxWords !== undefined && (!Number.isSafeInteger(criterion.maxWords) || criterion.maxWords < 1)) throw new Error(`Invalid maxWords in criterion ${criterion.id}`);
      if (criterion.minWords !== undefined && criterion.maxWords !== undefined && criterion.minWords > criterion.maxWords) throw new Error(`minWords exceeds maxWords in criterion ${criterion.id}`);
    }
  }
  return suite;
}
export async function loadEvaluationSuites(projectPath: string): Promise<EvaluationSuite[]> {
  const directory = path.join(path.resolve(projectPath), ".forge", "evals");
  let files: string[];
  try { files = (await readdir(directory)).filter(file => file.endsWith(".json")).sort(); }
  catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return []; throw error; }
  const suites: EvaluationSuite[] = [];
  for (const file of files) suites.push(validateSuite(JSON.parse(await readFile(path.join(directory, file), "utf8")), file));
  return suites;
}
function wordCount(text: string): number { return text.trim() ? text.trim().split(/\s+/).length : 0; }
export function evaluateRun(run: RunRecord, suite: EvaluationSuite): EvaluationReport {
  const results: EvaluationCaseResult[] = [];
  for (const item of suite.cases) {
    const record = run.tasks.find(task => item.taskId ? task.task.id === item.taskId : task.task.agent === item.agent);
    const output = record?.result?.content;
    if (!record || !output) {
      results.push({ caseId: item.id, taskId: record?.task.id ?? item.taskId ?? "", agent: record?.task.agent ?? item.agent ?? "", status: "missing-output", score: 0, passed: false, criteria: [] });
      continue;
    }
    const criteria = item.criteria.map(criterion => {
      const checks: CriterionResult["checks"] = [];
      for (const term of criterion.requiredTerms ?? []) checks.push({ rule: "required-term", passed: output.toLowerCase().includes(term.toLowerCase()), detail: `Must contain: ${term}` });
      for (const term of criterion.forbiddenTerms ?? []) checks.push({ rule: "forbidden-term", passed: !output.toLowerCase().includes(term.toLowerCase()), detail: `Must not contain: ${term}` });
      const words = wordCount(output);
      if (criterion.minWords !== undefined) checks.push({ rule: "minimum-words", passed: words >= criterion.minWords, detail: `At least ${criterion.minWords} words (found ${words})` });
      if (criterion.maxWords !== undefined) checks.push({ rule: "maximum-words", passed: words <= criterion.maxWords, detail: `At most ${criterion.maxWords} words (found ${words})` });
      return { id: criterion.id, weight: criterion.weight, passed: checks.every(check => check.passed), checks };
    });
    const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    const earned = criteria.reduce((sum, criterion) => sum + (criterion.passed ? criterion.weight : 0), 0);
    const score = totalWeight ? Math.round(earned / totalWeight * 100) : 0;
    results.push({ caseId: item.id, taskId: record.task.id, agent: record.task.agent, status: "scored", score, passed: score === 100, criteria });
  }
  const scored = results.filter(result => result.status === "scored");
  const score = scored.length ? Math.round(scored.reduce((sum, result) => sum + result.score, 0) / scored.length) : 0;
  return { version: 1, suiteId: suite.id, suiteName: suite.name, runId: run.id, evaluatedAt: new Date().toISOString(), score, passed: scored.length === results.length && results.every(result => result.passed), cases: results, summary: { total: results.length, scored: scored.length, passed: results.filter(result => result.passed).length, missingOutput: results.length - scored.length } };
}
export async function saveEvaluationReport(projectPath: string, report: EvaluationReport): Promise<string> {
  const directory = path.join(path.resolve(projectPath), ".forge", "evaluations");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const destination = path.join(directory, `${report.runId}-${report.suiteId}.json`);
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(report, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  await rename(temporary, destination);
  return destination;
}
export function formatEvaluationReport(report: EvaluationReport): string {
  const lines = [`FORGE evaluation: ${report.suiteName} (${report.suiteId})`, `Run: ${report.runId}`, `Score: ${report.score}/100 · ${report.passed ? "PASS" : "NEEDS REVIEW"}`, `Cases: ${report.summary.passed}/${report.summary.total} passed · ${report.summary.missingOutput} missing output`, ""];
  for (const item of report.cases) {
    lines.push(`  ${item.caseId} · ${item.agent} · ${item.status} · ${item.score}/100 · ${item.passed ? "PASS" : "FAIL"}`);
    for (const criterion of item.criteria) for (const check of criterion.checks) if (!check.passed) lines.push(`    - ${criterion.id}: ${check.detail}`);
  }
  lines.push("", "Note: This is deterministic rubric scoring, not an AI semantic judge or a guarantee of engineering correctness.");
  return lines.join("\n");
}

export async function listEvaluationReports(projectPath: string): Promise<EvaluationReport[]> {
  const directory = path.join(path.resolve(projectPath), ".forge", "evaluations");
  let files: string[];
  try { files = (await readdir(directory)).filter(file => file.endsWith(".json")).sort().reverse(); }
  catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return []; throw error; }
  const reports: EvaluationReport[] = [];
  for (const file of files.slice(0, 100)) {
    const value: unknown = JSON.parse(await readFile(path.join(directory, file), "utf8"));
    if (value && typeof value === "object" && (value as EvaluationReport).version === 1 && Array.isArray((value as EvaluationReport).cases)) reports.push(value as EvaluationReport);
  }
  return reports;
}
