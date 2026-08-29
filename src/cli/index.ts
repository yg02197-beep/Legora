import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { HostEnvironment, SupportedAgent } from "../bootstrap/contracts.ts";
import { bootstrapLegora } from "../bootstrap/service.ts";
import { parseSupportedAgent } from "../bootstrap/targets.ts";
import { doctorLegora } from "../doctor/service.ts";
import type { LocalCommandRunner } from "../doctor/contracts.ts";
import { runLegoraEntry } from "../entry.ts";
import type { KnowledgeAcquisitionProposal } from "../repository-knowledge/acquisition-contracts.ts";
import { acquireRepositoryKnowledge } from "../repository-knowledge/acquisition-service.ts";
import { checkKnowledgeRecordFreshness } from "../repository-knowledge/freshness.ts";
import { queryKnowledgeRecords } from "../repository-knowledge/query.ts";
import {
  acquireSimpleRepositoryKnowledge,
  parseSimpleKnowledgeAcquisitionJson,
  SIMPLE_ACQUISITION_EXAMPLES,
} from "../repository-knowledge/simple-acquisition.ts";
import { readKnowledgeRecords } from "../repository-knowledge/store.ts";
import { resolveLegoraPackageRoot } from "../skills/canonical.ts";
import { computeScanCoverage } from "../scan/coverage.ts";
import { runLegoraVerify } from "../verify/service.ts";
import { renderBootstrapResult, renderDoctorResult, renderEntryResult, renderScanResult, renderVerifyResult } from "./render.ts";

export interface CliCommandResult {
  exitCode: number;
  data: Record<string, any>;
  stdout?: string;
}

const USAGE = [
  "legora entry <question>",
  "legora entry --candidate <record-id> <question>",
  "legora entry --reject-candidates <question>",
  "legora knowledge acquire < acquisition.json",
  "legora knowledge acquire --example",
  "legora knowledge query <question>",
  "legora knowledge status",
  "legora scan [--depth file|module] [--json]",
  "legora verify <flow-record-id> [--json]",
  "legora verify --answer <choice-id> <flow-record-id> [--json]",
  "legora bootstrap [--agent codex|claude|gemini|opencode|all] [--dry-run] [--json]",
  "legora doctor [--agent codex|claude|gemini|opencode] [--json]",
].join("\n");

export interface CliCommandInput {
  stdin?: string;
  host?: HostEnvironment;
  packageVersion?: string;
  canonicalSkillRoot?: string;
  runLocalCommand?: LocalCommandRunner;
}

interface ParsedBootstrapOptions {
  requested: readonly SupportedAgent[] | "detected";
  dryRun: boolean;
  json: boolean;
}

interface ParsedDoctorOptions {
  requested: readonly SupportedAgent[] | "all";
  json: boolean;
}

interface ParsedEntryOptions {
  question: string;
  candidateRecordId?: string;
  candidatesRejected?: boolean;
  json: boolean;
}

function defaultHost(): HostEnvironment {
  const homeDir = process.env.USERPROFILE?.trim() || process.env.HOME?.trim() || os.homedir();
  return { homeDir, platform: process.platform, env: process.env };
}

async function packageVersion(): Promise<string> {
  const raw = await fs.readFile(path.join(resolveLegoraPackageRoot(), "package.json"), "utf8");
  const parsed = JSON.parse(raw) as { version?: unknown };
  if (typeof parsed.version !== "string" || !parsed.version.trim()) throw new Error("Legora package version is missing.");
  return parsed.version;
}

function parseBootstrapOptions(argv: readonly string[]): ParsedBootstrapOptions | null {
  let agent: SupportedAgent | "all" | null = null;
  let dryRun = false;
  let json = false;
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--agent") {
      if (agent !== null || index + 1 >= argv.length) return null;
      const parsed = parseSupportedAgent(argv[index + 1]);
      if (!parsed) return null;
      agent = parsed;
      index += 1;
      continue;
    }
    if (token === "--dry-run") {
      if (dryRun) return null;
      dryRun = true;
      continue;
    }
    if (token === "--json") {
      if (json) return null;
      json = true;
      continue;
    }
    return null;
  }
  return {
    requested: agent === null
      ? "detected"
      : agent === "all"
        ? ["codex", "gemini", "opencode", "claude"]
        : [agent],
    dryRun,
    json,
  };
}

function parseDoctorOptions(argv: readonly string[]): ParsedDoctorOptions | null {
  let agent: SupportedAgent | null = null;
  let json = false;
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--agent") {
      if (agent !== null || index + 1 >= argv.length) return null;
      const parsed = parseSupportedAgent(argv[index + 1]);
      if (!parsed || parsed === "all") return null;
      agent = parsed;
      index += 1;
      continue;
    }
    if (token === "--json") {
      if (json) return null;
      json = true;
      continue;
    }
    return null;
  }
  return { requested: agent === null ? "all" : [agent], json };
}

function parseEntryOptions(argv: readonly string[]): ParsedEntryOptions | null {
  let candidateRecordId: string | undefined;
  let candidatesRejected = false;
  let json = false;
  const questionParts: string[] = [];
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--candidate") {
      if (candidateRecordId !== undefined || candidatesRejected || index + 1 >= argv.length) return null;
      const value = argv[index + 1]?.trim();
      if (!value) return null;
      candidateRecordId = value;
      index += 1;
      continue;
    }
    if (token === "--reject-candidates") {
      if (candidatesRejected || candidateRecordId !== undefined) return null;
      candidatesRejected = true;
      continue;
    }
    if (token === "--json") {
      if (json) return null;
      json = true;
      continue;
    }
    questionParts.push(token);
  }
  const question = questionParts.join(" ").trim();
  if (!question) return null;
  return {
    question,
    json,
    ...(candidateRecordId === undefined ? {} : { candidateRecordId }),
    ...(candidatesRejected ? { candidatesRejected: true } : {}),
  };
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
  if (status === "KNOWLEDGE_CANDIDATES") return 8;
  return 0;
}

export async function runCliCommand(
  argv: readonly string[],
  repositoryRoot: string,
  input: CliCommandInput = {},
): Promise<CliCommandResult> {
  if (argv[0] === "bootstrap") {
    const options = parseBootstrapOptions(argv);
    if (!options) return usageError("Invalid bootstrap options.");
    const result = await bootstrapLegora({
      requested: options.requested,
      dryRun: options.dryRun,
      host: input.host ?? defaultHost(),
      packageVersion: input.packageVersion ?? await packageVersion(),
      canonicalSkillRoot: input.canonicalSkillRoot,
    });
    return {
      exitCode: result.status === "BOOTSTRAP_READY" ? 0 : 7,
      data: { command: "bootstrap", ...result },
      stdout: options.json ? undefined : renderBootstrapResult(result),
    };
  }

  if (argv[0] === "doctor") {
    const options = parseDoctorOptions(argv);
    if (!options) return usageError("Invalid doctor options.");
    const result = await doctorLegora({
      requested: options.requested,
      host: input.host ?? defaultHost(),
      canonicalSkillRoot: input.canonicalSkillRoot,
      runLocalCommand: input.runLocalCommand,
    });
    return {
      exitCode: result.status === "READY" ? 0 : 7,
      data: { command: "doctor", ...result },
      stdout: options.json ? undefined : renderDoctorResult(result),
    };
  }

  if (argv[0] === "scan") {
    let depth: "file" | "module" = "module";
    let json = false;
    for (let index = 1; index < argv.length; index += 1) {
      const token = argv[index];
      if (token === "--depth") {
        if (index + 1 >= argv.length) return usageError("--depth requires a value (file or module).");
        const value = argv[index + 1];
        if (value !== "file" && value !== "module") return usageError("--depth must be 'file' or 'module'.");
        depth = value;
        index += 1;
        continue;
      }
      if (token === "--json") {
        json = true;
        continue;
      }
      return usageError("Invalid scan options.");
    }
    const result = await computeScanCoverage(repositoryRoot, { depth });
    return {
      exitCode: 0,
      data: { command: "scan", ...result },
      stdout: json ? undefined : renderScanResult(result),
    };
  }

  if (argv[0] === "verify") {
    let answerId: string | undefined;
    let json = false;
    let flowRecordId: string | undefined;
    for (let index = 1; index < argv.length; index += 1) {
      const token = argv[index];
      if (token === "--answer") {
        if (answerId !== undefined || index + 1 >= argv.length) return usageError("--answer requires a choice-id.");
        answerId = argv[index + 1];
        index += 1;
        continue;
      }
      if (token === "--json") {
        if (json) return usageError("Duplicate --json flag.");
        json = true;
        continue;
      }
      if (token!.startsWith("-")) {
        return usageError(`Unknown option: ${token}`);
      }
      if (flowRecordId !== undefined) {
        return usageError("Only one flow-record-id is allowed.");
      }
      flowRecordId = token;
    }
    if (!flowRecordId) return usageError("verify requires a <flow-record-id>.");
    const result = await runLegoraVerify({ repositoryRoot, flowRecordId, answerId });
    let exitCode: number;
    switch (result.status) {
      case "CHALLENGE_READY":
      case "CORRECT":
        exitCode = 0;
        break;
      case "INCORRECT":
        exitCode = 1;
        break;
      case "NOT_FLOW":
      case "INVALID_CHOICE":
        exitCode = 2;
        break;
      case "NOT_FOUND":
        exitCode = 3;
        break;
      case "STALE":
        exitCode = 4;
        break;
      case "UNKNOWN":
        exitCode = 5;
        break;
      case "INSUFFICIENT_EVIDENCE":
        exitCode = 6;
        break;
      default:
        exitCode = 2;
    }
    return {
      exitCode,
      data: { command: "verify", flowRecordId, ...result },
      stdout: json ? undefined : renderVerifyResult(result, flowRecordId),
    };
  }

  if (argv[0] === "entry") {
    const options = parseEntryOptions(argv);
    if (!options) return usageError("entry requires a question and at most one --candidate <record-id>.");
    const result = await runLegoraEntry({ repositoryRoot, ...options });
    return {
      exitCode: statusExitCode(result.status),
      data: { command: "entry", ...result },
      stdout: options.json ? undefined : renderEntryResult(result),
    };
  }

  if (argv[0] === "knowledge" && argv[1] === "acquire" && argv[2] === "--example" && argv.length === 3) {
    return {
      exitCode: 0,
      data: {
        command: "knowledge acquire --example",
        status: "EXAMPLE",
        examples: SIMPLE_ACQUISITION_EXAMPLES,
      },
    };
  }

  if (argv[0] === "knowledge" && argv[1] === "acquire" && argv.length === 2) {
    const proposal = parseAcquisitionProposal(input.stdin);
    const simpleInput = proposal ? null : parseSimpleKnowledgeAcquisitionJson(input.stdin);
    if (!proposal && !simpleInput) {
      return usageError("knowledge acquire requires one valid simple acquisition or proposal JSON document on stdin.");
    }
    const result = proposal
      ? await acquireRepositoryKnowledge({ repositoryRoot, proposal })
      : await acquireSimpleRepositoryKnowledge({ repositoryRoot, input: simpleInput! });
    return {
      exitCode: result.status === "ACQUIRED"
        ? 0
        : result.status === "EXISTING_KNOWLEDGE"
          ? 8
          : 6,
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

