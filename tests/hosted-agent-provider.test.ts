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

  it("sends Google credentials and parses candidate text", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain(":generateContent");
      expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("google-test-key");
      const body = JSON.parse(String(init?.body)) as { systemInstruction?: { parts?: Array<{ text?: string }> }; contents?: Array<{ parts?: Array<{ text?: string }> }> };
      expect(body.systemInstruction?.parts?.[0]?.text).toContain("proposal only");
      expect(body.contents?.[0]?.parts?.[0]?.text).toContain("Propose a design.");
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Google proposal" }] } }] }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new HostedAgentProvider({ provider: "google", model: "gemini-test", apiKey: "google-test-key" });
    const result = await provider.complete(request);
    expect(result.content).toBe("Google proposal");
    expect(result.provider).toBe("google");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("sends Ollama chat requests and parses message content", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://localhost:11434/api/chat");
      const body = JSON.parse(String(init?.body)) as { stream?: boolean; messages?: Array<{ role: string; content: string }> };
      expect(body.stream).toBe(false);
      expect(body.messages?.[0]?.role).toBe("system");
      expect(body.messages?.[0]?.content).toContain("proposal only");
      return new Response(JSON.stringify({ message: { content: "Local proposal" } }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new HostedAgentProvider({ provider: "ollama", model: "llama-test" });
    const result = await provider.complete(request);
    expect(result.content).toBe("Local proposal");
    expect(result.provider).toBe("ollama");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("reports non-success provider responses without exposing response bodies", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("sensitive upstream detail", { status: 429 })));
    const provider = new HostedAgentProvider({ provider: "anthropic", model: "claude-test", apiKey: "test-key" });
    await expect(provider.complete(request)).rejects.toThrow("HTTP 429");
    await expect(provider.complete(request)).rejects.not.toThrow("sensitive upstream detail");
  });


  it("encodes Google model identifiers in the request path", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain("/models/model%2Fwith%20spaces:generateContent");
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Encoded model response" }] } }] }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new HostedAgentProvider({ provider: "google", model: "model/with spaces", apiKey: "test-key" });
    await expect(provider.complete(request)).resolves.toMatchObject({ content: "Encoded model response" });
  });

  it("passes the configured timeout to the network request", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.signal?.aborted).toBe(false);
      return new Response(JSON.stringify({ message: { content: "Timed request response" } }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new HostedAgentProvider({ provider: "ollama", model: "llama-test", timeoutMs: 12_000 });
    await expect(provider.complete(request)).resolves.toMatchObject({ content: "Timed request response" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects empty provider responses rather than returning a blank proposal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ content: [] }), {
      status: 200, headers: { "content-type": "application/json" },
    })));
    const provider = new HostedAgentProvider({ provider: "anthropic", model: "claude-test", apiKey: "test-key" });
    await expect(provider.complete(request)).rejects.toThrow("empty assistant response");
  });

});
