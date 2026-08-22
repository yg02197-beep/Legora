import type { BootstrapResult } from "../bootstrap/service.ts";
import type { DoctorResult } from "../doctor/contracts.ts";

function labelAgent(agent: string): string {
  if (agent === "codex") return "Codex";
  if (agent === "claude") return "Claude Code";
  if (agent === "gemini") return "Gemini CLI";
  return agent;
}

export function renderBootstrapResult(result: BootstrapResult): string {
  const lines = [
    `Legora bootstrap: ${result.status}`,
    `physical_writes: ${result.physicalWrites}`,
  ];
  for (const agent of result.agents) {
    lines.push(`${labelAgent(agent.agent)}  executable=${agent.executable}  action=${agent.action}  target=${agent.targetPath}`);
  }
  if (result.message) lines.push(`message: ${result.message}`);
  return `${lines.join("\n")}\n`;
}

export function renderDoctorResult(result: DoctorResult): string {
  const lines = [
    `Legora doctor: ${result.status}`,
    `canonical_skill_format: ${result.canonicalSkillFormat}`,
  ];
  for (const agent of result.agents) {
    lines.push(
      `${labelAgent(agent.agent)}  executable=${agent.executable}  install=${agent.installTarget}  digest=${agent.managedDigest}  native_discovery=${agent.nativeDiscovery}`,
    );
  }
  return `${lines.join("\n")}\n`;
}
