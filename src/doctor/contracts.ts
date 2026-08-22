import type { SupportedAgent } from "../bootstrap/contracts.ts";

export type DiagnosticState = "PASS" | "FAIL" | "NOT_FOUND" | "NOT_PROBED" | "CONFIRMED" | "TIMEOUT";

export interface AgentDoctorResult {
  agent: SupportedAgent;
  executable: DiagnosticState;
  installTarget: DiagnosticState;
  managedDigest: DiagnosticState;
  nativeDiscovery: DiagnosticState;
}

export interface DoctorResult {
  status: "READY" | "NOT_READY";
  cliRuntime: "PASS";
  canonicalSkillFormat: DiagnosticState;
  agents: readonly AgentDoctorResult[];
}

export interface LocalCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export type LocalCommandRunner = (
  command: string,
  args: readonly string[],
  timeoutMs: number,
) => Promise<LocalCommandResult>;
