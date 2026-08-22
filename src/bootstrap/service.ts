import { loadCanonicalSkillSnapshot } from "../skills/canonical.ts";
import { inspectManagedCopy, publishManagedCopy } from "./managed-copy.ts";
import { detectSupportedAgents, resolveBootstrapTargets } from "./targets.ts";
import type {
  BootstrapFileOps,
  HostEnvironment,
  ManagedCopyInspection,
  ManagedCopyPublication,
  PhysicalTargetKind,
  SupportedAgent,
} from "./contracts.ts";

export type BootstrapAction = "INSTALL" | "NO_CHANGE" | "MANAGED_UPDATE" | "CONFLICT";

export interface BootstrapAgentResult {
  agent: SupportedAgent;
  executable: "FOUND" | "NOT_FOUND";
  targetKind: PhysicalTargetKind;
  targetPath: string;
  action: BootstrapAction;
}

export interface BootstrapResult {
  status: "BOOTSTRAP_READY" | "BOOTSTRAP_CONFLICT" | "BOOTSTRAP_FAILED";
  dryRun: boolean;
  physicalWrites: number;
  agents: readonly BootstrapAgentResult[];
  message?: string;
}

const CANONICAL_AGENT_ORDER: readonly SupportedAgent[] = ["codex", "gemini", "claude"];

function uniqueCanonicalAgents(agents: readonly SupportedAgent[]): SupportedAgent[] {
  const requested = new Set(agents);
  return CANONICAL_AGENT_ORDER.filter((agent) => requested.has(agent));
}

function actionForInspection(inspection: ManagedCopyInspection): BootstrapAction {
  if (inspection.state === "ABSENT") return "INSTALL";
  if (inspection.state === "NO_CHANGE") return "NO_CHANGE";
  if (inspection.state === "MANAGED_UPDATE") return "MANAGED_UPDATE";
  return "CONFLICT";
}

export async function bootstrapLegora(input: {
  requested: readonly SupportedAgent[] | "detected";
  dryRun: boolean;
  host: HostEnvironment;
  packageVersion: string;
  canonicalSkillRoot?: string;
  fileOps?: BootstrapFileOps;
}): Promise<BootstrapResult> {
  const availability = await detectSupportedAgents(input.host);
  const availabilityByAgent = new Map(availability.map((entry) => [entry.agent, entry.executable]));
  const requestedAgents = input.requested === "detected"
    ? availability.filter((entry) => entry.executable !== null).map((entry) => entry.agent)
    : uniqueCanonicalAgents(input.requested);

  const snapshot = await loadCanonicalSkillSnapshot(input.canonicalSkillRoot);
  const targets = resolveBootstrapTargets(input.host.homeDir, requestedAgents);
  const preflight = await Promise.all(targets.map(async (target) => ({
    target,
    inspection: await inspectManagedCopy(target.path, snapshot),
  })));

  const agents: BootstrapAgentResult[] = [];
  for (const item of preflight) {
    const action = actionForInspection(item.inspection);
    for (const agent of item.target.agents) {
      agents.push({
        agent,
        executable: availabilityByAgent.get(agent) ? "FOUND" : "NOT_FOUND",
        targetKind: item.target.kind,
        targetPath: item.target.path,
        action,
      });
    }
  }

  if (preflight.some((item) => item.inspection.state === "CONFLICT")) {
    return {
      status: "BOOTSTRAP_CONFLICT",
      dryRun: input.dryRun,
      physicalWrites: 0,
      agents,
      message: "At least one required Skill target is not safely managed by Legora.",
    };
  }

  if (input.dryRun) {
    return { status: "BOOTSTRAP_READY", dryRun: true, physicalWrites: 0, agents };
  }

  const receipts: ManagedCopyPublication[] = [];
  try {
    for (const item of preflight) {
      if (item.inspection.state === "NO_CHANGE") continue;
      receipts.push(await publishManagedCopy({
        target: item.target.path,
        snapshot,
        packageVersion: input.packageVersion,
        fileOps: input.fileOps,
      }));
    }
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const receipt of [...receipts].reverse()) {
      try {
        await receipt.rollback();
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Bootstrap publication failed and one or more prior targets could not be restored.",
      );
    }
    return {
      status: "BOOTSTRAP_FAILED",
      dryRun: false,
      physicalWrites: 0,
      agents,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const changed = receipts.filter((receipt) => receipt.changed).length;
  try {
    for (const receipt of receipts) await receipt.finalize();
  } catch (error) {
    return {
      status: "BOOTSTRAP_FAILED",
      dryRun: false,
      physicalWrites: changed,
      agents,
      message: `Skill targets were published but transaction cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  return {
    status: "BOOTSTRAP_READY",
    dryRun: false,
    physicalWrites: changed,
    agents,
  };
}
