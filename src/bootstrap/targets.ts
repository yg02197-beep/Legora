import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";

import type {
  AgentAvailability,
  BootstrapTarget,
  HostEnvironment,
  SupportedAgent,
} from "./contracts.ts";

const AGENTS: readonly SupportedAgent[] = ["codex", "gemini", "opencode", "claude"];

function envValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const exact = env[key];
  if (exact !== undefined) return exact;
  const foundKey = Object.keys(env).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
  return foundKey ? env[foundKey] : undefined;
}

function pathEntries(host: HostEnvironment): string[] {
  const raw = envValue(host.env, "PATH") ?? "";
  const delimiter = host.platform === "win32" ? ";" : ":";
  return raw
    .split(delimiter)
    .map((entry) => entry.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

async function isRegularFile(filePath: string): Promise<boolean> {
  try {
    return (await fs.lstat(filePath)).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function isExecutableFile(filePath: string): Promise<boolean> {
  if (!await isRegularFile(filePath)) return false;
  try {
    await fs.access(filePath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findExecutable(command: string, host: HostEnvironment): Promise<string | null> {
  const directories = pathEntries(host);
  if (host.platform === "win32") {
    const rawExtensions = envValue(host.env, "PATHEXT") ?? ".COM;.EXE;.BAT;.CMD";
    const extensions = rawExtensions.split(";").map((item) => item.trim()).filter(Boolean);
    const names = [command, ...extensions.map((extension) => `${command}${extension.toLowerCase()}`)];
    for (const directory of directories) {
      for (const name of names) {
        const candidate = path.join(directory, name);
        if (await isRegularFile(candidate)) return candidate;
      }
    }
    return null;
  }

  for (const directory of directories) {
    const candidate = path.join(directory, command);
    if (await isExecutableFile(candidate)) return candidate;
  }
  return null;
}

export async function detectSupportedAgents(
  host: HostEnvironment,
): Promise<readonly AgentAvailability[]> {
  const availability: AgentAvailability[] = [];
  for (const agent of AGENTS) {
    availability.push({ agent, executable: await findExecutable(agent, host) });
  }
  return availability;
}

export function resolveBootstrapTargets(
  homeDir: string,
  agents: readonly SupportedAgent[],
): readonly BootstrapTarget[] {
  if (!homeDir.trim()) throw new Error("A non-empty home directory is required for bootstrap targets.");
  const requested = new Set(agents);
  const targets: BootstrapTarget[] = [];

  const sharedAgents = AGENTS.filter(
    (agent): agent is "codex" | "gemini" | "opencode" =>
      (agent === "codex" || agent === "gemini" || agent === "opencode") && requested.has(agent),
  );
  if (sharedAgents.length > 0) {
    targets.push({
      kind: "agents-shared",
      path: path.join(homeDir, ".agents", "skills", "legora"),
      agents: sharedAgents,
    });
  }

  if (requested.has("claude")) {
    targets.push({
      kind: "claude",
      path: path.join(homeDir, ".claude", "skills", "legora"),
      agents: ["claude"],
    });
  }
  return targets;
}

export function parseSupportedAgent(value: string): SupportedAgent | "all" | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "all") return "all";
  if (normalized === "codex" || normalized === "claude" || normalized === "gemini" || normalized === "opencode") {
    return normalized;
  }
  return null;
}
