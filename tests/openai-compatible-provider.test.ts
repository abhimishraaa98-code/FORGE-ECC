import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleProvider } from "../src/core/openai-compatible-provider.js";

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
});
