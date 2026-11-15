import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { startDashboard, type DashboardHandle } from "../src/core/dashboard-server.js";
import { advanceRun, createRun, DemoAgentProvider } from "../src/core/orchestrator.js";
import { saveRun } from "../src/core/run-store.js";

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
    expect(await page.text()).toContain("FORGE");

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

    const agents = await fetch(base + "/api/agents");
    expect(agents.status).toBe(200);
    const agentList = await agents.json();
    expect(agentList.some((agent: { id: string }) => agent.id === "planner")).toBe(true);
    expect(agentList[0]).not.toHaveProperty("instructions");

    const forbidden = await fetch(base + "/api/overview", { method: "POST" });
    expect(forbidden.status).toBe(405);

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

    const detail = await fetch(base + "/api/runs/" + pendingRun.id);
    const detailResult = await detail.json();
    expect(detailResult.tasks[0].approval.decision).toBe("approved");
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
