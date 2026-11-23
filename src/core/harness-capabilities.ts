/**
 * Versioned capability manifest for supported agent harnesses.
 *
 * These declarations describe FORGE's current renderer and hook integration,
 * not every feature the upstream harness may support. "shared" means FORGE
 * installs common Markdown/instructions rather than a native harness feature.
 */

import type { HarnessTarget } from "./harness-installer.js";

export const HARNESS_CAPABILITY_SCHEMA_VERSION = 1 as const;

export type CapabilitySupport = "native" | "shared" | "unsupported";

export interface HarnessCapability {
  target: HarnessTarget;
  displayName: string;
  schemaVersion: typeof HARNESS_CAPABILITY_SCHEMA_VERSION;
  capabilities: {
    agents: CapabilitySupport;
    skills: CapabilitySupport;
    commands: CapabilitySupport;
    rules: CapabilitySupport;
    hooks: CapabilitySupport;
  };
  notes: string[];
}

export const HARNESS_CAPABILITIES: readonly HarnessCapability[] = [
  {
    target: "claude",
    displayName: "Claude Code",
    schemaVersion: HARNESS_CAPABILITY_SCHEMA_VERSION,
    capabilities: { agents: "native", skills: "native", commands: "native", rules: "native", hooks: "native" },
    notes: ["FORGE can merge its runtime hooks into Claude Code settings when --hooks is enabled."],
  },
  {
    target: "cursor",
    displayName: "Cursor",
    schemaVersion: HARNESS_CAPABILITY_SCHEMA_VERSION,
    capabilities: { agents: "shared", skills: "shared", commands: "native", rules: "native", hooks: "unsupported" },
    notes: ["Agents and skills are rendered as Cursor rules; they are not installed as native subagents or skill packages.", "FORGE runtime hooks are not installed for this target."],
  },
  {
    target: "codex",
    displayName: "Codex",
    schemaVersion: HARNESS_CAPABILITY_SCHEMA_VERSION,
    capabilities: { agents: "shared", skills: "native", commands: "shared", rules: "shared", hooks: "unsupported" },
    notes: ["Shared project instructions are referenced from AGENTS.md; skills use the shared .agents/skills layout.", "FORGE runtime hooks are not installed for this target."],
  },
  {
    target: "opencode",
    displayName: "OpenCode",
    schemaVersion: HARNESS_CAPABILITY_SCHEMA_VERSION,
    capabilities: { agents: "native", skills: "unsupported", commands: "native", rules: "shared", hooks: "unsupported" },
    notes: ["Rules are exposed through shared FORGE Markdown and project instructions.", "FORGE runtime hooks are not installed for this target."],
  },
  {
    target: "gemini",
    displayName: "Gemini CLI",
    schemaVersion: HARNESS_CAPABILITY_SCHEMA_VERSION,
    capabilities: { agents: "shared", skills: "native", commands: "native", rules: "shared", hooks: "unsupported" },
    notes: ["Shared instructions are referenced from GEMINI.md; skills use the shared .agents/skills layout.", "FORGE runtime hooks are not installed for this target."],
  },
] as const;

export function getHarnessCapability(target: HarnessTarget): HarnessCapability {
  const capability = HARNESS_CAPABILITIES.find(item => item.target === target);
  if (!capability) throw new Error(`No capability manifest exists for harness "${target}".`);
  return capability;
}

export function listHarnessCapabilities(): HarnessCapability[] {
  return HARNESS_CAPABILITIES.map(item => ({
    ...item,
    capabilities: { ...item.capabilities },
    notes: [...item.notes],
  }));
}
