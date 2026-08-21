import { runLegoraEntry } from "../entry.ts";
import { checkKnowledgeRecordFreshness } from "../repository-knowledge/freshness.ts";
import { queryKnowledgeRecords } from "../repository-knowledge/query.ts";
import { readKnowledgeRecords } from "../repository-knowledge/store.ts";

export interface CliCommandResult {
  exitCode: number;
  data: Record<string, any>;
}

const USAGE = [
  "legora entry <question>",
  "legora knowledge query <question>",
  "legora knowledge status",
].join("\n");

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
