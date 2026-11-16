import { describe, expect, it } from "vitest";
import { buildContainerRunArgs, detectDockerRootless } from "../src/core/container-sandbox.js";
import { formatSandboxRuntimeReport, parseSandboxRuntimeReport } from "../src/core/sandbox-runtime.js";
import { getSandboxSecurityProfile, listSandboxSecurityProfiles, validateSandboxSecurityProfile } from "../src/core/sandbox-security-profiles.js";
import { createSandboxComplianceReport, formatSandboxComplianceReport } from "../src/core/sandbox-compliance.js";
import { loadSandboxPolicy, validateSandboxPolicy } from "../src/core/sandbox-policy.js";
import { verifyStagedPatch } from "../src/core/staged-verification.js";
import { formatSandboxCleanupReport, parseManagedContainers, selectStoppedManagedContainers } from "../src/core/sandbox-lifecycle.js";
import { appendSandboxCleanupAudit, formatSandboxCleanupHistory, readSandboxCleanupAudit } from "../src/core/sandbox-cleanup-audit.js";
import { mkdtemp, rm, writeFile, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const image = "node:22-alpine@sha256:" + "a".repeat(64);

describe("container sandbox arguments", () => {
  it("requires an immutable image digest", () => {
    expect(() => buildContainerRunArgs("/tmp/project", "node:22", "test", "forge-test"))
      .toThrow(/pinned by an immutable sha256 digest/);
  });

  it("disables networking and privilege escalation while bounding resources", () => {
    const args = buildContainerRunArgs("/tmp/project", image, "test", "forge-test");
    expect(args).toContain("--network=none");
    expect(args).toContain("--read-only");
    expect(args).toContain("--cap-drop=ALL");
    expect(args).toContain("--security-opt=no-new-privileges");
    expect(args).toContain("--pids-limit=128");
    expect(args).toContain("--memory=1g");
    expect(args).toContain("--cpus=2");
    expect(args).toContain("--pull=never");
    expect(args).toContain("--tmpfs");
    expect(args.some(value => value.includes("readonly"))).toBe(true);
    expect(args).toContain("--entrypoint");
    expect(args).toContain("node");
    expect(args.some(value => value.includes("fs.cpSync"))).toBe(true);
    expect(args).toContain("test");
  });

  it("rejects lifecycle hooks and unsafe script names", () => {
    expect(() => buildContainerRunArgs("/tmp/project", image, "pretest", "forge-test"))
      .toThrow(/explicit package script/);
    expect(() => buildContainerRunArgs("/tmp/project", image, "../test", "forge-test"))
      .toThrow(/explicit package script/);
  });

  it("rejects comma-containing mount paths to avoid mount option injection", () => {
    expect(() => buildContainerRunArgs("/tmp/proj,ect", image, "test", "forge-test"))
      .toThrow(/cannot contain commas/);
  });
});

describe("custom sandbox policy runtime enforcement", () => {
  const policy = {
    version: 1 as const, profile: "balanced" as const, network: "none" as const,
    readOnlyRoot: true as const, dropAllCapabilities: true as const,
    noNewPrivileges: true as const, maxMemory: "512m", maxCpus: 1,
    maxProcesses: 64, requireRootless: false, requireImageDigest: true as const,
  };

  it("maps validated policy resource limits into actual container arguments", () => {
    const args = buildContainerRunArgs("/tmp/project", image, "test", "forge-policy", getSandboxSecurityProfile("balanced"), policy);
    expect(args).toContain("--memory=512m");
    expect(args).toContain("--memory-swap=512m");
    expect(args).toContain("--cpus=1");
    expect(args).toContain("--pids-limit=64");
    expect(args).toContain("--network=none");
    expect(args).toContain("--read-only");
    expect(args).toContain("--cap-drop=ALL");
    expect(args).toContain("--security-opt=no-new-privileges");
  });

  it("keeps built-in limits when no custom policy is supplied", () => {
    const args = buildContainerRunArgs("/tmp/project", image, "test", "forge-default");
    expect(args).toContain("--memory=1g");
    expect(args).toContain("--cpus=2");
    expect(args).toContain("--pids-limit=128");
  });
});

describe("container runtime security detection", () => {
  it("recognizes rootless Docker security options", () => {
    expect(detectDockerRootless('["name=seccomp,profile=builtin","name=rootless"]')).toBe(true);
  });
  it("recognizes a reported rootful runtime", () => {
    expect(detectDockerRootless('["name=seccomp,profile=builtin"]')).toBe(false);
  });
  it("fails closed when runtime security options are unknown", () => {
    expect(detectDockerRootless("not-json")).toBeNull();
    expect(detectDockerRootless("[]")).toBeNull();
  });
});

describe("staged verification CLI security flags", () => {
  it("documents rootless mode as a container-only option", () => {
    const usage = "forge patch-verify PATCH_STAGE_ID SCRIPT [--install-dependencies] [--sandbox-image IMAGE@sha256:DIGEST] [--require-rootless] [--path PROJECT]";
    expect(usage).toContain("--require-rootless");
    expect(usage).toContain("--sandbox-image");
  });
});

describe("staged verification policy integration", () => {
  const policy = {
    version: 1, profile: "balanced", network: "none", readOnlyRoot: true,
    dropAllCapabilities: true, noNewPrivileges: true, maxMemory: "512m",
    maxCpus: 1, maxProcesses: 64, requireRootless: false, requireImageDigest: true,
  };

  it("requires container execution when a policy file is supplied", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "forge-policy-cli-"));
    try {
      const policyPath = path.join(root, "policy.json");
      await writeFile(policyPath, JSON.stringify(policy), "utf8");
      await expect(verifyStagedPatch(root, "patch-stage-12345678901234567890", "test", {
        sandboxPolicyPath: policyPath,
      })).rejects.toThrow(/requires --sandbox-image/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a profile that conflicts with the loaded policy", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "forge-policy-profile-"));
    try {
      const policyPath = path.join(root, "policy.json");
      await writeFile(policyPath, JSON.stringify(policy), "utf8");
      await expect(verifyStagedPatch(root, "patch-stage-12345678901234567890", "test", {
        sandboxImage: image, sandboxPolicyPath: policyPath, securityProfile: "hardened",
      })).rejects.toThrow(/must match the profile declared in --policy/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("sandbox runtime status report", () => {
  it("reports available rootless Docker capabilities", () => {
    const report = parseSandboxRuntimeReport("docker", "Docker version 27.0.0", '["name=rootless","name=seccomp"]');
    expect(report.available).toBe(true);
    expect(report.rootless).toBe(true);
    expect(formatSandboxRuntimeReport(report)).toContain("Rootless: yes");
  });
  it("warns when rootless status cannot be established", () => {
    const report = parseSandboxRuntimeReport("docker", "Docker version 27.0.0", "invalid");
    expect(report.rootless).toBeNull();
    expect(report.warnings.join(" ")).toMatch(/could not be determined/);
  });
});

describe("sandbox lifecycle cleanup selection", () => {
  it("parses managed container records", () => {
    expect(parseManagedContainers("abcdef123456\tExited (0) 2 hours ago\tforge-verify-old")).toEqual([
      { id: "abcdef123456", status: "Exited (0) 2 hours ago", name: "forge-verify-old" },
    ]);
  });
  it("selects only stopped managed containers", () => {
    const items = parseManagedContainers([
      "abcdef123456\tExited (0) 2 hours ago\tforge-verify-old",
      "abcdef123457\tUp 5 minutes\tforge-verify-active",
      "abcdef123458\tCreated\tforge-verify-created",
    ].join("\n"));
    expect(selectStoppedManagedContainers(items).map(item => item.id)).toEqual(["abcdef123456", "abcdef123458"]);
  });
  it("rejects malformed container output", () => {
    expect(() => parseManagedContainers("not-an-id\tExited\tunknown")).toThrow(/invalid managed-container/);
  });
  it("defaults cleanup reporting to dry-run", () => {
    const report = formatSandboxCleanupReport([], [], false);
    expect(report).toContain("DRY RUN");
    expect(report).toContain("Active containers are never selected");
  });
});

describe("sandbox cleanup audit history", () => {
  it("persists bounded cleanup history and formats it", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "forge-cleanup-audit-"));
    try {
      const entry = {
        id: "cleanup-test",
        timestamp: "2026-11-16T12:00:00.000Z",
        mode: "apply" as const,
        candidates: [{ id: "abcdef123456", name: "forge-old", status: "Exited (0)" }],
        removed: ["abcdef123456"],
      };
      await appendSandboxCleanupAudit(root, entry);
      const history = await readSandboxCleanupAudit(root);
      expect(history).toEqual([entry]);
      expect(formatSandboxCleanupHistory(history)).toContain("Removed: 1");
      expect(formatSandboxCleanupHistory([])).toContain("No cleanup runs recorded");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("sandbox security profiles", () => {
  it("exposes immutable baseline controls for every built-in profile", () => {
    const profiles = listSandboxSecurityProfiles();
    expect(profiles.map(profile => profile.name)).toEqual(["balanced", "hardened", "rootless-required"]);
    for (const profile of profiles) expect(validateSandboxSecurityProfile(profile)).toBe(true);
  });
  it("requires rootless mode for hardened profiles", () => {
    expect(getSandboxSecurityProfile("hardened").requireRootless).toBe(true);
    expect(getSandboxSecurityProfile("balanced").requireRootless).toBe(false);
  });
  it("rejects unknown profile names", () => {
    expect(() => getSandboxSecurityProfile("permissive")).toThrow(/Unknown sandbox security profile/);
  });
});

describe("container verification profile policy", () => {
  it("requires rootless runtime for hardened profiles", () => {
    expect(getSandboxSecurityProfile("hardened").requireRootless).toBe(true);
    expect(getSandboxSecurityProfile("rootless-required").requireRootless).toBe(true);
  });
  it("keeps balanced profile explicit about rootless being optional", () => {
    expect(getSandboxSecurityProfile("balanced").requireRootless).toBe(false);
  });
});

describe("sandbox compliance reporting", () => {
  it("reports all configured controls and observed runtime facts", () => {
    const report = createSandboxComplianceReport(getSandboxSecurityProfile("balanced"), {
      available: true, rootless: true, imageDigestPinned: true,
    });
    expect(report.status).toBe("compliant");
    expect(report.checks.every(check => check.status === "pass")).toBe(true);
    expect(formatSandboxComplianceReport(report)).toContain("Immutable image reference");
  });
  it("marks unavailable runtime as non-compliant", () => {
    const report = createSandboxComplianceReport(getSandboxSecurityProfile("balanced"), {
      available: false, rootless: null, imageDigestPinned: false,
    });
    expect(report.status).toBe("non-compliant");
    expect(report.checks.some(check => check.id === "runtime" && check.status === "fail")).toBe(true);
  });
  it("fails hardened compliance when rootless mode is unknown", () => {
    const report = createSandboxComplianceReport(getSandboxSecurityProfile("hardened"), {
      available: true, rootless: null, imageDigestPinned: true,
    });
    expect(report.status).toBe("non-compliant");
    expect(report.checks.some(check => check.id === "rootless" && check.status === "fail")).toBe(true);
  });
});

describe("fail-closed sandbox policy validation", () => {
  const validPolicy = {
    version: 1, profile: "balanced", network: "none", readOnlyRoot: true,
    dropAllCapabilities: true, noNewPrivileges: true, maxMemory: "512m",
    maxCpus: 1, maxProcesses: 64, requireRootless: false, requireImageDigest: true,
  };
  it("accepts a valid restrictive policy", () => {
    expect(validateSandboxPolicy(validPolicy).valid).toBe(true);
  });
  it("rejects attempts to enable network or writable root", () => {
    const result = validateSandboxPolicy({ ...validPolicy, network: "bridge", readOnlyRoot: false });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.join(" ")).toMatch(/network must remain none/);
  });
  it("rejects unknown fields and relaxed limits", () => {
    const result = validateSandboxPolicy({ ...validPolicy, maxCpus: 8, extra: true });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.join(" ")).toMatch(/Unknown policy field/);
  });

  it("loads a valid policy file and rejects symlink paths", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "forge-policy-file-"));
    try {
      const policyPath = path.join(root, "policy.json");
      const linkPath = path.join(root, "policy-link.json");
      await writeFile(policyPath, JSON.stringify(validPolicy), "utf8");
      const loaded = await loadSandboxPolicy(policyPath);
      expect(loaded.valid).toBe(true);
      await symlink(policyPath, linkPath);
      const linked = await loadSandboxPolicy(linkPath);
      expect(linked.valid).toBe(false);
      if (!linked.valid) expect(linked.errors.join(" ")).toMatch(/non-symlink file/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects malformed and oversized policy files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "forge-policy-invalid-"));
    try {
      const policyPath = path.join(root, "policy.json");
      await writeFile(policyPath, "{broken", "utf8");
      const malformed = await loadSandboxPolicy(policyPath);
      expect(malformed.valid).toBe(false);
      if (!malformed.valid) expect(malformed.errors.join(" ")).toMatch(/valid JSON/);
      await writeFile(policyPath, " ".repeat(16 * 1024 + 1), "utf8");
      const oversized = await loadSandboxPolicy(policyPath);
      expect(oversized.valid).toBe(false);
      if (!oversized.valid) expect(oversized.errors.join(" ")).toMatch(/16 KiB/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("requires rootless for hardened policy", () => {
    const result = validateSandboxPolicy({ ...validPolicy, profile: "hardened" });
    expect(result.valid).toBe(false);
  });
});
