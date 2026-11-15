import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
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

    const verifications = await fetch(base + "/api/verifications");
    expect(verifications.status).toBe(200);
    expect(Array.isArray(await verifications.json())).toBe(true);
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
