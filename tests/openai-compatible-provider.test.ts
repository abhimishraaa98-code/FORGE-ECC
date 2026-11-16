import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleProvider } from "../src/core/openai-compatible-provider.js";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validatePermissionPolicy } from "../src/core/permission-policy.js";

afterEach(() => vi.unstubAllGlobals());

describe("OpenAI-compatible provider", () => {
  it("sends a task and parses the assistant proposal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "A reviewed implementation proposal." } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider({
      apiKey: "test-secret",
      model: "test-model",
    });
    const result = await provider.complete({
      task: { id: "review", agent: "reviewer", title: "Review", prompt: "Review this change" },
      completedDependencies: [],
    });
    expect(result.content).toContain("implementation proposal");
    expect(fetchMock).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((request.headers as Record<string, string>).authorization).toBe("Bearer test-secret");
  });

  it("rejects non-HTTPS remote endpoints", () => {
    expect(() => new OpenAICompatibleProvider({
      apiKey: "key",
      model: "model",
      baseUrl: "http://example.com/v1",
    })).toThrow(/HTTPS/);
  });

  it("does not expose provider response bodies in errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret-bearing response", { status: 500 })));
    const provider = new OpenAICompatibleProvider({ apiKey: "test-secret", model: "test-model" });
    await expect(provider.complete({
      task: { id: "x", agent: "planner", title: "x", prompt: "x" },
      completedDependencies: [],
    })).rejects.toThrow("HTTP 500");
  });
  it("executes an explicitly allowed read-only tool call and returns its result to the model", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "forge-agent-tools-"));
    try {
      await mkdir(path.join(workspace, "src"));
      await writeFile(path.join(workspace, "src", "hello.ts"), "export const greeting = 'hello from workspace';");
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: "call_read_1", type: "function", function: { name: "read-file", arguments: JSON.stringify({ relativePath: "src/hello.ts" }) } }] } }] }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "The file exports a greeting constant." } }] }), { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);
      const policy = validatePermissionPolicy({ version: 1, mode: "restricted", allowedTools: ["read-file"] });
      const provider = new OpenAICompatibleProvider({ apiKey: "test-secret", model: "test-model", workspacePath: workspace, permissionPolicy: policy });
      const result = await provider.complete({ task: { id: "inspect", agent: "reviewer", title: "Inspect file", prompt: "Read src/hello.ts" }, completedDependencies: [] });
      expect(result.content).toContain("greeting constant");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const body = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body));
      expect(JSON.stringify(body.messages)).toContain("hello from workspace");
    } finally { await rm(workspace, { recursive: true, force: true }); }
  });

  it("does not advertise tools under the default proposal-only policy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Proposal only." } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider({ apiKey: "test-secret", model: "test-model" });
    await provider.complete({ task: { id: "plan", agent: "planner", title: "Plan", prompt: "Plan" }, completedDependencies: [] });
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.tools).toBeUndefined();
  });
});
