import { runLegoraEntry } from "../entry.ts";
import type { KnowledgeAcquisitionProposal } from "../repository-knowledge/acquisition-contracts.ts";
import { acquireRepositoryKnowledge } from "../repository-knowledge/acquisition-service.ts";
import { checkKnowledgeRecordFreshness } from "../repository-knowledge/freshness.ts";
import { queryKnowledgeRecords } from "../repository-knowledge/query.ts";
import { readKnowledgeRecords } from "../repository-knowledge/store.ts";

export interface CliCommandResult {
  exitCode: number;
  data: Record<string, any>;
}

const USAGE = [
  "legora entry <question>",
  "legora knowledge acquire < proposal.json",
  "legora knowledge query <question>",
  "legora knowledge status",
].join("\n");

export interface CliCommandInput {
  stdin?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isEvidenceLocator(value: unknown): boolean {
  return isObject(value)
    && typeof value.filePath === "string"
    && typeof value.lineStart === "number"
    && (value.lineEnd === undefined || typeof value.lineEnd === "number");
}

function isKnowledgeStructure(value: unknown): boolean {
  if (!isObject(value) || typeof value.type !== "string") return false;
  if (value.type === "ENTITY") {
    return typeof value.entityKind === "string"
      && isOptionalString(value.name)
      && isOptionalString(value.description);
  }
  if (value.type === "RELATIONSHIP") {
    return typeof value.relationshipKind === "string"
      && typeof value.sourceId === "string"
      && typeof value.targetId === "string";
  }
  if (value.type === "BEHAVIOR_FLOW") {
    return typeof value.flowKind === "string"
      && typeof value.name === "string"
      && Array.isArray(value.steps)
      && value.steps.every((step) => isObject(step)
        && typeof step.entityId === "string"
        && isOptionalString(step.label));
  }
  return false;
}

function parseAcquisitionProposal(raw: string | undefined): KnowledgeAcquisitionProposal | null {
  if (!raw?.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(parsed) || !Array.isArray(parsed.candidates)) {
    return null;
  }
  for (const candidate of parsed.candidates) {
    if (!isObject(candidate)
      || typeof candidate.id !== "string"
      || typeof candidate.kind !== "string"
      || typeof candidate.subject !== "string"
      || !Array.isArray(candidate.evidenceLocators)
      || !candidate.evidenceLocators.every(isEvidenceLocator)
      || (candidate.structure !== undefined && !isKnowledgeStructure(candidate.structure))) {
      return null;
    }
  }
  return parsed as unknown as KnowledgeAcquisitionProposal;
}

function usageError(message: string): CliCommandResult {
  return {
    exitCode: 2,
    data: { status: "USAGE_ERROR", message, usage: USAGE },
  };
}

function freshnessStatus(statuses: readonly string[]): "CURRENT" | "STALE" | "UNKNOWN" {
  if (statuses.includes("STALE")) return "STALE";
  if (statuses.includes("UNKNOWN")) return "UNKNOWN";
  return "CURRENT";
}

function statusExitCode(status: string): number {
  if (status === "STALE" || status === "KNOWLEDGE_STALE") return 4;
  if (status === "UNKNOWN" || status === "KNOWLEDGE_UNKNOWN") return 5;
  if (status === "EMPTY" || status === "KNOWLEDGE_NOT_FOUND") return 3;
  return 0;
}

export async function runCliCommand(
  argv: readonly string[],
  repositoryRoot: string,
  input: CliCommandInput = {},
): Promise<CliCommandResult> {
  if (argv[0] === "entry") {
    const question = argv.slice(1).join(" ").trim();
    if (!question) return usageError("entry requires a question.");
    const result = await runLegoraEntry({ repositoryRoot, question });
    return {
      exitCode: statusExitCode(result.status),
      data: { command: "entry", ...result },
    };
  }

  if (argv[0] === "knowledge" && argv[1] === "acquire" && argv.length === 2) {
    const proposal = parseAcquisitionProposal(input.stdin);
    if (!proposal) return usageError("knowledge acquire requires one valid proposal JSON document on stdin.");
    const result = await acquireRepositoryKnowledge({ repositoryRoot, proposal });
    return {
      exitCode: result.status === "ACQUIRED" ? 0 : 6,
      data: { command: "knowledge acquire", ...result },
    };
  }

  if (argv[0] === "knowledge" && argv[1] === "query") {
    const question = argv.slice(2).join(" ").trim();
    if (!question) return usageError("knowledge query requires a question.");
    const records = await readKnowledgeRecords(repositoryRoot);
    const matches = queryKnowledgeRecords(records, question);
    if (matches.length === 0) {
      return {
        exitCode: 3,
        data: { command: "knowledge query", status: "KNOWLEDGE_NOT_FOUND", question, records: [] },
      };
    }
    const results = await Promise.all(matches.map(async (record) => ({
      record,
      freshness: await checkKnowledgeRecordFreshness(repositoryRoot, record),
    })));
    const status = freshnessStatus(results.map((item) => item.freshness.status));
    return {
      exitCode: statusExitCode(status),
      data: { command: "knowledge query", status, question, records: results },
    };
  }

  if (argv[0] === "knowledge" && argv[1] === "status" && argv.length === 2) {
    const records = await readKnowledgeRecords(repositoryRoot);
    if (records.length === 0) {
      return {
        exitCode: 3,
        data: {
          command: "knowledge status",
          status: "EMPTY",
          totalRecords: 0,
          counts: { current: 0, stale: 0, unknown: 0 },
          records: [],
        },
      };
    }
    const results = await Promise.all(records.map(async (record) => ({
      recordId: record.id,
      freshness: await checkKnowledgeRecordFreshness(repositoryRoot, record),
    })));
    const counts = {
      current: results.filter((item) => item.freshness.status === "CURRENT").length,
      stale: results.filter((item) => item.freshness.status === "STALE").length,
      unknown: results.filter((item) => item.freshness.status === "UNKNOWN").length,
    };
    const status = freshnessStatus(results.map((item) => item.freshness.status));
    return {
      exitCode: statusExitCode(status),
      data: { command: "knowledge status", status, totalRecords: records.length, counts, records: results },
    };
  }

  return usageError("Unknown Legora command.");
}

export { USAGE as LEGORA_CLI_USAGE };
