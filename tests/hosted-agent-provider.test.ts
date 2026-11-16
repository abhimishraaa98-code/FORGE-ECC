import { afterEach, describe, expect, it, vi } from "vitest";
import { HostedAgentProvider } from "../src/core/hosted-agent-provider.js";
import type { AgentRequest } from "../src/core/orchestrator.js";

const request: AgentRequest = {
  task: { id: "task-1", agent: "architect", title: "Review design", prompt: "Propose a design." },
  completedDependencies: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hosted agent provider security and protocol handling", () => {
  it("requires credentials for hosted providers", () => {
    expect(() => new HostedAgentProvider({ provider: "anthropic", model: "claude-sonnet" })).toThrow("requires an API key");
    expect(() => new HostedAgentProvider({ provider: "google", model: "gemini" })).toThrow("requires an API key");
  });

  it("rejects insecure non-local provider endpoints", () => {
    expect(() => new HostedAgentProvider({
      provider: "anthropic", model: "claude-sonnet", apiKey: "test-key", baseUrl: "http://api.example.com",
    })).toThrow("HTTPS");
  });

  it("allows local HTTP endpoints for local model servers", () => {
    expect(() => new HostedAgentProvider({ provider: "ollama", model: "llama3.2", baseUrl: "http://localhost:11434" })).not.toThrow();
  });

  it("sends Anthropic credentials and parses proposal text", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("x-api-key")).toBe("test-key");
      expect(new Headers(init?.headers).get("anthropic-version")).toBe("2023-06-01");
      return new Response(JSON.stringify({ content: [{ type: "text", text: "Design proposal" }] }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new HostedAgentProvider({ provider: "anthropic", model: "claude-sonnet", apiKey: "test-key" });
    const result = await provider.complete(request);
    expect(result.content).toBe("Design proposal");
    expect(result.provider).toBe("anthropic");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects provider timeouts outside the supported range", async () => {
    const provider = new HostedAgentProvider({ provider: "ollama", model: "llama3.2", timeoutMs: 999 });
    await expect(provider.complete(request)).rejects.toThrow("between 1000 and 180000");
  });
});
