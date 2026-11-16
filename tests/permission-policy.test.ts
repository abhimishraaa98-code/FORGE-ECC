import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertProposalOnlyPolicy, assertSupportedAgentPolicy, DEFAULT_PERMISSION_POLICY, loadPermissionPolicy, validatePermissionPolicy } from "../src/core/permission-policy.js";

describe("FORGE permission policy", () => {
  let root = "";
  afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = ""; });

  it("defaults to proposal-only with no tools", () => {
    expect(DEFAULT_PERMISSION_POLICY).toEqual({ version: 1, mode: "proposal-only", allowedTools: [] });
    expect(() => assertProposalOnlyPolicy(DEFAULT_PERMISSION_POLICY)).not.toThrow();
  });

  it("loads and validates an explicit policy", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-permissions-"));
    await mkdir(path.join(root, ".forge"));
    await writeFile(path.join(root, ".forge", "permissions.json"), JSON.stringify({ version: 1, mode: "proposal-only", allowedTools: [] }));
    await expect(loadPermissionPolicy(root)).resolves.toEqual(DEFAULT_PERMISSION_POLICY);
  });

  it("rejects policies that request tool execution or unknown properties", () => {
    const restricted = validatePermissionPolicy({ version: 1, mode: "restricted", allowedTools: ["shell"] });
    expect(() => assertProposalOnlyPolicy(restricted)).toThrow(/no registered tool executor/);
    expect(() => validatePermissionPolicy({ version: 1, mode: "proposal-only", allowedTools: [], execute: true })).toThrow(/unsupported fields/);
  });

  it("fails closed when a policy file is malformed", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "forge-permissions-"));
    await mkdir(path.join(root, ".forge"));
    await writeFile(path.join(root, ".forge", "permissions.json"), "{not-json");
    await expect(loadPermissionPolicy(root)).rejects.toThrow();
  });
  it("allows only OpenAI with explicitly allowlisted read-only tools in restricted mode", () => {
    const policy = validatePermissionPolicy({ version: 1, mode: "restricted", allowedTools: ["read-file", "search-code"] });
    expect(() => assertSupportedAgentPolicy(policy, "openai")).not.toThrow();
    expect(() => assertSupportedAgentPolicy(policy, "anthropic")).toThrow(/only OpenAI/);
    expect(() => assertSupportedAgentPolicy(policy, "openai-compatible")).toThrow(/only OpenAI/);
  });

  it("rejects unsupported or empty restricted tool policies", () => {
    expect(() => assertSupportedAgentPolicy({ version: 1, mode: "restricted", allowedTools: ["shell"] }, "openai")).toThrow(/only OpenAI/);
    expect(() => assertSupportedAgentPolicy({ version: 1, mode: "restricted", allowedTools: [] }, "openai")).toThrow(/only OpenAI/);
    expect(() => assertSupportedAgentPolicy(DEFAULT_PERMISSION_POLICY, "claude-code")).not.toThrow();
  });
  it("allows only OpenAI with explicitly allowlisted read-only tools in restricted mode", () => {
    const policy = validatePermissionPolicy({ version: 1, mode: "restricted", allowedTools: ["read-file", "search-code"] });
    expect(() => assertSupportedAgentPolicy(policy, "openai")).not.toThrow();
    expect(() => assertSupportedAgentPolicy(policy, "anthropic")).toThrow(/only OpenAI/);
  });

  it("rejects unsupported or empty restricted tool policies", () => {
    expect(() => assertSupportedAgentPolicy({ version: 1, mode: "restricted", allowedTools: ["shell"] }, "openai")).toThrow(/only OpenAI/);
    expect(() => assertSupportedAgentPolicy({ version: 1, mode: "restricted", allowedTools: [] }, "openai")).toThrow(/only OpenAI/);
    expect(() => assertSupportedAgentPolicy(DEFAULT_PERMISSION_POLICY, "claude-code")).not.toThrow();
  });
});
