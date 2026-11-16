import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { startDashboard, type DashboardHandle } from "../src/core/dashboard-server.js";
import { advanceRun, createRun, DemoAgentProvider } from "../src/core/orchestrator.js";
import { saveRun } from "../src/core/run-store.js";
import { saveExecutionTrace } from "../src/core/execution-trace.js";

let root = "";
let dashboard: DashboardHandle | undefined;

afterEach(async () => {
  if (dashboard) await new Promise<void>(resolve => dashboard!.server.close(() => resolve()));
  dashboard = undefined;
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

describe("local dashboard server", () => {
  it("serves the dashboard and read-only project APIs on loopback", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-dashboard-"));
    dashboard = await startDashboard({ projectPath: root, port: 0 });
    const address = dashboard.server.address();
    if (!address || typeof address === "string") throw new Error("Dashboard did not bind a TCP port.");
    const base = `http://127.0.0.1:${address.port}`;

    const page = await fetch(base);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("FORGE");
    expect(html).toContain("Agent handoff map");
    expect(html).toContain("Execution telemetry");
    expect(html).toContain("Agent observability");
    expect(html).toContain("Per-agent utilization");
    expect(html).toContain("Provider health");
    expect(html).toContain("Evaluation history");
    expect(html).toContain("Live event stream");
    expect(html).toContain("Create replay of retryable tasks");
    expect(html).toContain("Compare with previous run");
    expect(html).toContain("Cancel run");
    expect(html).toContain("Retry this task and blocked dependants");

    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src", "demo.ts"), "export const demo = true;\\n");
    await writeFile(path.join(root, ".env"), "SECRET=hidden");
    const workspace = await fetch(base + "/api/workspace");
    expect(workspace.status).toBe(200);
    const workspaceListing = await workspace.json();
    expect(workspaceListing.entries.some((item: { name: string }) => item.name === "src")).toBe(true);
    expect(workspaceListing.entries.some((item: { name: string }) => item.name === ".env")).toBe(false);
    const preview = await fetch(base + "/api/workspace/file?path=src%2Fdemo.ts");
    expect(preview.status).toBe(200);
    expect((await preview.json()).content).toContain("demo = true");
    const traversal = await fetch(base + "/api/workspace?path=..");
    expect(traversal.status).toBe(500);

    const overview = await fetch(base + "/api/overview");
    expect(overview.status).toBe(200);
    expect((await overview.json()).runCount).toBe(0);

    const health = await fetch(base + "/api/health");
    expect(health.status).toBe(200);
    const healthReport = await health.json();
    expect(typeof healthReport.current.quality.score).toBe("number");
    expect(Array.isArray(healthReport.history)).toBe(true);

    const quality = await fetch(base + "/api/quality");
    expect(quality.status).toBe(200);
    const qualityReport = await quality.json();
    expect(typeof qualityReport.score).toBe("number");
    expect(Array.isArray(qualityReport.findings)).toBe(true);

    const regression = await fetch(base + "/api/regression");
    expect(regression.status).toBe(200);
    const regressionReport = await regression.json();
    expect(regressionReport.summary).toHaveProperty("regressions");
    expect(Array.isArray(regressionReport.checks)).toBe(true);

    const reviews = await fetch(base + "/api/reviews");
    expect(reviews.status).toBe(200);
    expect(Array.isArray(await reviews.json())).toBe(true);

    const verifications = await fetch(base + "/api/verifications");
    expect(verifications.status).toBe(200);
    expect(Array.isArray(await verifications.json())).toBe(true);
    const dependencyIntelResponse = await fetch(base + "/api/dependency-intelligence");
    expect(dependencyIntelResponse.status).toBe(200);
    const dependencyIntel = await dependencyIntelResponse.json();
    expect(dependencyIntel.summary).toHaveProperty("direct");
    expect(dependencyIntel.sources.vulnerabilityReport).toBeNull();
    const timelineResponse = await fetch(base + "/api/intelligence-timeline");
    expect(timelineResponse.status).toBe(200);
    const timeline = await timelineResponse.json();
    expect(timeline.comparison).toBeNull();
    expect(timeline.snapshots).toEqual([]);
    const changeRiskResponse = await fetch(base + "/api/change-intelligence");
    expect(changeRiskResponse.status).toBe(200);
    const changeRiskReport = await changeRiskResponse.json();
    expect(changeRiskReport.summary).toHaveProperty("changedFiles");
    expect(Array.isArray(changeRiskReport.changes)).toBe(true);
    const riskReportResponse = await fetch(base + "/api/engineering-risk");
    expect(riskReportResponse.status).toBe(200);
    const riskReport = await riskReportResponse.json();
    expect(Array.isArray(riskReport.hotspots)).toBe(true);
    expect(riskReport.summary).toHaveProperty("high");
    const dependencyGraph = await fetch(base + "/api/dependency-graph");
    expect(dependencyGraph.status).toBe(200);
    const dependencyReport = await dependencyGraph.json();
    expect(Array.isArray(dependencyReport.nodes)).toBe(true);
    expect(Array.isArray(dependencyReport.edges)).toBe(true);
    expect(dependencyReport.summary).toHaveProperty("undeclared");
    const architecture = await fetch(base + "/api/architecture");
    expect(architecture.status).toBe(200);
    const graph = await architecture.json();
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);

    const runs = await fetch(base + "/api/runs");
    expect(runs.status).toBe(200);
    const runList = await runs.json();
    expect(Array.isArray(runList)).toBe(true);
    if (runList[0]) {
      expect(runList[0].tasks[0]).toHaveProperty("status");
      expect(runList[0]).toHaveProperty("events");
      expect(runList[0].tasks[0]).not.toHaveProperty("prompt");
    }

    const runDetail = await fetch(base + "/api/runs/forge-not-found");
    expect(runDetail.status).toBe(500);

    const evaluations = await fetch(base + "/api/evaluations");
    expect(evaluations.status).toBe(200);
    expect(await evaluations.json()).toEqual([]);

    const observability = await fetch(base + "/api/observability");
    expect(observability.status).toBe(200);
    const telemetry = await observability.json();
    expect(telemetry).toHaveProperty("totals");
    expect(Array.isArray(telemetry.agents)).toBe(true);
    expect(Array.isArray(telemetry.providers)).toBe(true);
    expect(telemetry.budgets).toHaveProperty("perAgentTokens");

    const agents = await fetch(base + "/api/agents");
    expect(agents.status).toBe(200);
    const agentList = await agents.json();
    expect(agentList.some((agent: { id: string }) => agent.id === "planner")).toBe(true);
    expect(agentList[0]).not.toHaveProperty("instructions");

    const forbidden = await fetch(base + "/api/overview", { method: "POST" });
    expect(forbidden.status).toBe(405);

    const workflowResponse = await fetch(base + "/api/workflows", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "dashboard-flow", name: "Dashboard flow", description: "Test pipeline",
        tasks: [
          { id: "plan", agent: "planner", title: "Plan", prompt: "Create a plan." },
          { id: "review", agent: "code-reviewer", title: "Review", prompt: "Review the plan.", dependsOn: ["plan"], requiresApproval: true }
        ]
      })
    });
    expect(workflowResponse.status).toBe(201);
    const savedWorkflow = await workflowResponse.json();
    expect(savedWorkflow.id).toBe("dashboard-flow");
    const workflowListResponse = await fetch(base + "/api/workflows");
    expect((await workflowListResponse.json()).some((item: { id: string }) => item.id === "dashboard-flow")).toBe(true);
    const workflowRunResponse = await fetch(base + "/api/workflows/dashboard-flow/run", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}"
    });
    expect(workflowRunResponse.status).toBe(201);
    const workflowRun = await workflowRunResponse.json();
    expect(workflowRun.taskCount).toBe(2);
    const createdDraft = await fetch(base + "/api/runs/" + workflowRun.id);
    const createdDraftJson = await createdDraft.json();
    expect(createdDraftJson.status).toBe("pending");
    expect(createdDraftJson.tasks[1].dependsOn).toEqual(["plan"]);

    const pendingRun = await advanceRun(createRun("Review a release", [
      { id: "review", agent: "reviewer", title: "Review release", prompt: "Review the proposed release", requiresApproval: true },
    ]), new DemoAgentProvider());
    await saveRun(root, pendingRun);
    const approval = await fetch(base + "/api/runs/" + pendingRun.id + "/tasks/review/approval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: "review", decision: "approved", reviewer: "test-reviewer" }),
    });
    expect(approval.status).toBe(200);
    const approvalResult = await approval.json();
    expect(approvalResult.task.approval.decision).toBe("approved");
    expect(approvalResult.task.approval.reviewer).toBe("test-reviewer");

    const failedRun = createRun("Recover failed task", [
      { id: "retry-me", agent: "planner", title: "Retry me", prompt: "Try again" },
    ]);
    failedRun.status = "failed";
    failedRun.tasks[0]!.status = "failed";
    failedRun.tasks[0]!.error = "Temporary provider failure";
    await saveRun(root, failedRun);
    const replayResponse = await fetch(base + "/api/runs/" + failedRun.id + "/replay", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    expect(replayResponse.status).toBe(201);
    const replayResult = await replayResponse.json();
    expect(replayResult.sourceRunId).toBe(failedRun.id);
    const replayDetail = await fetch(base + "/api/runs/" + replayResult.id);
    const replayJson = await replayDetail.json();
    expect(replayJson.tasks[0].status).toBe("pending");

    const cancelResponse = await fetch(base + "/api/runs/" + pendingRun.id + "/cancel", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    expect(cancelResponse.status).toBe(200);
    const cancelledDetail = await fetch(base + "/api/runs/" + pendingRun.id);
    expect((await cancelledDetail.json()).status).toBe("cancelled");

    const retrySource = createRun("Retry one task", [
      { id: "done", agent: "architect", title: "Done", prompt: "Done" },
      { id: "broken", agent: "reviewer", title: "Broken", prompt: "Broken", dependsOn: ["done"] },
      { id: "next", agent: "planner", title: "Next", prompt: "Next", dependsOn: ["broken"] },
    ]);
    retrySource.tasks[0]!.status = "completed";
    retrySource.tasks[0]!.result = { provider: "test", content: "kept" };
    retrySource.tasks[1]!.status = "failed";
    retrySource.tasks[2]!.status = "blocked";
    await saveRun(root, retrySource);
    const taskRetryResponse = await fetch(base + "/api/runs/" + retrySource.id + "/tasks/broken/retry", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    expect(taskRetryResponse.status).toBe(201);
    const taskRetry = await taskRetryResponse.json();
    const taskRetryDetail = await fetch(base + "/api/runs/" + taskRetry.id);
    expect((await taskRetryDetail.json()).tasks.map((task: { status: string }) => task.status)).toEqual(["completed", "pending", "pending"]);

    const detail = await fetch(base + "/api/runs/" + pendingRun.id);
    const detailResult = await detail.json();
    expect(detailResult.tasks[0].approval.decision).toBe("approved");
    const handoffRun = createRun("Inspect agent handoffs", [
      { id: "architect", agent: "architect", title: "Map architecture", prompt: "Map" },
      { id: "reviewer", agent: "reviewer", title: "Review map", prompt: "Review", dependsOn: ["architect"] },
    ]);
    await saveRun(root, handoffRun);
    const handoffDetail = await fetch(base + "/api/runs/" + handoffRun.id);
    const handoffJson = await handoffDetail.json();
    expect(handoffJson.tasks[1].dependsOn).toEqual(["architect"]);
    await saveExecutionTrace(root, handoffRun.id, [{
      taskId: "architect", agent: "architect", tier: "reasoning", model: "test-model",
      provider: "test-provider", startedAt: new Date().toISOString(), durationMs: 42,
      outcome: "success", inputTokensEstimate: 20, outputTokensEstimate: 10,
    }]);
    const traceResponse = await fetch(base + "/api/runs/" + handoffRun.id + "/trace");
    expect(traceResponse.status).toBe(200);
    const traceJson = await traceResponse.json();
    expect(traceJson.entries[0].model).toBe("test-model");
    expect(traceJson.totals.durationMs).toBe(42);
    const missingTrace = await fetch(base + "/api/runs/" + pendingRun.id + "/trace");
    expect(missingTrace.status).toBe(404);
  });

  it("does not serve unknown routes", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-dashboard-"));
    dashboard = await startDashboard({ projectPath: root, port: 0 });
    const address = dashboard.server.address();
    if (!address || typeof address === "string") throw new Error("Dashboard did not bind a TCP port.");
    const response = await fetch(`http://127.0.0.1:${address.port}/unknown`);
    expect(response.status).toBe(404);
  });
});
