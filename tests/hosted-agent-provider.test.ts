import { afterEach, describe, expect, it, vi } from "vitest";
import { createHostedAgentProvider, HostedAgentProvider } from "../src/core/hosted-agent-provider.js";

afterEach(() => vi.unstubAllGlobals());
const request = { task: { id: "task-1", agent: "planner", title: "Plan", prompt: "Plan the change" }, completedDependencies: [] };

describe("hosted provider adapters", () => {
  it("calls Anthropic Messages API and parses text blocks", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: "text", text: "Anthropic proposal" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new HostedAgentProvider({ provider: "anthropic", model: "claude-test", apiKey: "secret" });
    const result = await provider.complete(request);
    expect(result.content).toBe("Anthropic proposal");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.anthropic.com/v1/messages");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({ "x-api-key": "secret", "anthropic-version": "2023-06-01" });
  });

  it("calls Google generateContent API and parses candidate text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Gemini proposal" }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new HostedAgentProvider({ provider: "google", model: "gemini-test", apiKey: "secret" });
    const result = await provider.complete(request);
    expect(result.content).toBe("Gemini proposal");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v1beta/models/gemini-test:generateContent");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({ "x-goog-api-key": "secret" });
  });

  it("supports local Ollama without an API key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: "Local proposal" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new HostedAgentProvider({ provider: "ollama", model: "llama-test" });
    const result = await provider.complete(request);
    expect(result.content).toBe("Local proposal");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:11434/api/chat");
  });

  it("resolves provider environment and rejects missing credentials", () => {
    expect(createHostedAgentProvider({ FORGE_AI_PROVIDER: "google", GOOGLE_API_KEY: "g-key" }).name).toBe("google");
    expect(() => createHostedAgentProvider({ FORGE_AI_PROVIDER: "anthropic" })).toThrow("ANTHROPIC_API_KEY");
    expect(createHostedAgentProvider({ FORGE_AI_PROVIDER: "ollama" }).name).toBe("ollama");
  });

  it("rejects remote plaintext endpoints and hides error response bodies", async () => {
    expect(() => new HostedAgentProvider({ provider: "ollama", model: "m", baseUrl: "http://example.com:11434" })).toThrow(/HTTPS/);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("sensitive", { status: 503 })));
    const provider = new HostedAgentProvider({ provider: "anthropic", model: "m", apiKey: "key" });
    await expect(provider.complete(request)).rejects.toThrow("HTTP 503");
  });
});
