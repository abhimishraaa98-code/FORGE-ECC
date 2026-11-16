import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

export interface ForgePermissionPolicy {
  version: 1;
  mode: "proposal-only" | "restricted";
  allowedTools: string[];
}

export const DEFAULT_PERMISSION_POLICY: ForgePermissionPolicy = {
  version: 1,
  mode: "proposal-only",
  allowedTools: [],
};

export function validatePermissionPolicy(value: unknown): ForgePermissionPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Permission policy must be a JSON object.");
  }
  const item = value as Record<string, unknown>;
  if (item.version !== 1) throw new Error("Permission policy version must be 1.");
  if (item.mode !== "proposal-only" && item.mode !== "restricted") {
    throw new Error("Permission policy mode must be proposal-only or restricted.");
  }
  if (!Array.isArray(item.allowedTools) || item.allowedTools.length > 32 ||
      item.allowedTools.some(tool => typeof tool !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(tool))) {
    throw new Error("Permission policy allowedTools must be an array of at most 32 valid tool IDs.");
  }
  const keys = Object.keys(item);
  if (keys.some(key => !["version", "mode", "allowedTools"].includes(key))) {
    throw new Error("Permission policy contains unsupported fields.");
  }
  return { version: 1, mode: item.mode, allowedTools: [...new Set(item.allowedTools as string[])] };
}

/** Loads declarative policy. Missing files resolve to the safe proposal-only default. */
export async function loadPermissionPolicy(projectPath: string): Promise<ForgePermissionPolicy> {
  const file = path.join(path.resolve(projectPath), ".forge", "permissions.json");
  try {
    const info = await lstat(file);
    if (info.isSymbolicLink() || !info.isFile()) {
      throw new Error("The .forge/permissions.json policy file must be a regular file, not a symbolic link.");
    }
    return validatePermissionPolicy(JSON.parse(await readFile(file, "utf8")));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { ...DEFAULT_PERMISSION_POLICY, allowedTools: [] };
    }
    throw error;
  }
}
