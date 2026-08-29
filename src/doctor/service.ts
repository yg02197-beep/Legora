import { spawn } from "node:child_process";
import path from "node:path";

import type { HostEnvironment, ManagedCopyInspection, SupportedAgent } from "../bootstrap/contracts.ts";
import { inspectManagedCopy } from "../bootstrap/managed-copy.ts";
import { detectSupportedAgents, resolveBootstrapTargets } from "../bootstrap/targets.ts";
import { loadCanonicalSkillSnapshot, validateCanonicalSkill } from "../skills/canonical.ts";
import type {
  AgentDoctorResult,
  DiagnosticState,
  DoctorResult,
  LocalCommandResult,
  LocalCommandRunner,
} from "./contracts.ts";

const AGENT_ORDER: readonly SupportedAgent[] = ["codex", "gemini", "opencode", "claude"];
const GEMINI_TIMEOUT_MS = 10_000;

function defaultLocalCommandRunner(
  command: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<LocalCommandResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const child = spawn(command, [...args], {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });

    const finish = (exitCode: number): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
    };
    child.on("error", (error) => {
      stderr += `${error instanceof Error ? error.message : String(error)}\n`;
      finish(1);
    });
    child.on("close", (code) => finish(code ?? 1));
  });
}

function selectedAgents(requested: readonly SupportedAgent[] | "all"): SupportedAgent[] {
  if (requested === "all") return [...AGENT_ORDER];
  const set = new Set(requested);
  return AGENT_ORDER.filter((agent) => set.has(agent));
}

function statesForInspection(inspection: ManagedCopyInspection): Pick<AgentDoctorResult, "installTarget" | "managedDigest"> {
  if (inspection.state === "NO_CHANGE") return { installTarget: "PASS", managedDigest: "PASS" };
  if (inspection.state === "MANAGED_UPDATE") return { installTarget: "PASS", managedDigest: "OUTDATED" };
  if (inspection.state === "ABSENT") return { installTarget: "NOT_FOUND", managedDigest: "NOT_FOUND" };
  return { installTarget: "FAIL", managedDigest: "FAIL" };
}

function samePath(left: string, right: string, platform: NodeJS.Platform): boolean {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function geminiEnabledLocation(stdout: string): string | null {
  const lines = stdout.split(/\r?\n/);
  if (!lines.some((line) => line.trim() === "Discovered Agent Skills:")) return null;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] !== "legora [Enabled]") continue;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (line && !/^\s/.test(line)) break;
      const match = line.match(/^\s+Location:\s*(.+?)\s*$/);
      if (match) return match[1].trim().replace(/^"|"$/g, "");
    }
    return null;
  }
  return null;
}

async function probeGemini(input: {
  executable: string;
  expectedSkillFile: string;
  platform: NodeJS.Platform;
  runLocalCommand: LocalCommandRunner;
}): Promise<DiagnosticState> {
  const result = await input.runLocalCommand(input.executable, ["skills", "list", "--all"], GEMINI_TIMEOUT_MS);
  if (result.timedOut) return "TIMEOUT";
  if (result.exitCode !== 0) return "FAIL";
  const location = geminiEnabledLocation(result.stdout);
  if (!location) return "FAIL";
  return samePath(location, input.expectedSkillFile, input.platform) ? "CONFIRMED" : "FAIL";
}

function isHealthy(agent: AgentDoctorResult): boolean {
  if (agent.executable !== "PASS") return false;
  if (agent.installTarget !== "PASS" || agent.managedDigest !== "PASS") return false;
  if (agent.agent === "gemini") return agent.nativeDiscovery === "CONFIRMED";
  return agent.nativeDiscovery === "NOT_PROBED";
}

export async function doctorLegora(input: {
  requested: readonly SupportedAgent[] | "all";
  host: HostEnvironment;
  canonicalSkillRoot?: string;
  packageVersion?: string;
  runLocalCommand?: LocalCommandRunner;
}): Promise<DoctorResult> {
  const requested = selectedAgents(input.requested);
  const availability = await detectSupportedAgents(input.host);
  const executableByAgent = new Map(availability.map((entry) => [entry.agent, entry.executable]));
  const validationIssues = await validateCanonicalSkill(input.canonicalSkillRoot);
  const canonicalSkillFormat: DiagnosticState = validationIssues.length === 0 ? "PASS" : "FAIL";

  if (canonicalSkillFormat !== "PASS") {
    const agents = requested.map<AgentDoctorResult>((agent) => ({
      agent,
      executable: executableByAgent.get(agent) ? "PASS" : "NOT_FOUND",
      installTarget: "FAIL",
      managedDigest: "FAIL",
      nativeDiscovery: executableByAgent.get(agent) ? "NOT_PROBED" : "NOT_FOUND",
    }));
    return { status: "NOT_READY", cliRuntime: "PASS", canonicalSkillFormat, agents };
  }

  const snapshot = await loadCanonicalSkillSnapshot(input.canonicalSkillRoot);
  const targets = resolveBootstrapTargets(input.host.homeDir, requested);
  const targetByAgent = new Map<SupportedAgent, (typeof targets)[number]>();
  for (const target of targets) for (const agent of target.agents) targetByAgent.set(agent, target);

  const inspectionByPath = new Map<string, ManagedCopyInspection>();
  for (const target of targets) {
    if (!inspectionByPath.has(target.path)) {
      inspectionByPath.set(target.path, await inspectManagedCopy(target.path, snapshot));
    }
  }

  const runLocalCommand = input.runLocalCommand ?? defaultLocalCommandRunner;
  const agents: AgentDoctorResult[] = [];
  for (const agent of requested) {
    const executable = executableByAgent.get(agent) ?? null;
    const target = targetByAgent.get(agent);
    if (!target) continue;
    const inspection = inspectionByPath.get(target.path)!;
    const targetStates = statesForInspection(inspection);
    let nativeDiscovery: DiagnosticState;
    if (!executable) {
      nativeDiscovery = "NOT_FOUND";
    } else if (agent !== "gemini") {
      nativeDiscovery = "NOT_PROBED";
    } else if (targetStates.installTarget !== "PASS" || targetStates.managedDigest !== "PASS") {
      nativeDiscovery = "NOT_PROBED";
    } else {
      nativeDiscovery = await probeGemini({
        executable,
        expectedSkillFile: path.join(target.path, "SKILL.md"),
        platform: input.host.platform,
        runLocalCommand,
      });
    }
    const versionFields =
      inspection.state === "MANAGED_UPDATE"
        ? {
            ...(inspection.installedPackageVersion === undefined
              ? {}
              : { installedVersion: inspection.installedPackageVersion }),
            ...(input.packageVersion === undefined ? {} : { currentVersion: input.packageVersion }),
          }
        : {};
    agents.push({
      agent,
      executable: executable ? "PASS" : "NOT_FOUND",
      ...targetStates,
      nativeDiscovery,
      ...versionFields,
    });
  }

  let ready: boolean;
  if (input.requested === "all") {
    const detected = agents.filter((agent) => agent.executable === "PASS");
    ready = detected.length > 0 && detected.every(isHealthy);
  } else {
    ready = agents.length === requested.length && agents.length > 0 && agents.every(isHealthy);
  }

  return {
    status: ready ? "READY" : "NOT_READY",
    cliRuntime: "PASS",
    canonicalSkillFormat,
    agents,
  };
}
