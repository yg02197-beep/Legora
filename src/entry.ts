import type { BehaviorSlice, EvidenceClaim } from "./core/contracts.ts";
import type { KnowledgeRecord } from "./repository-knowledge/contracts.ts";
import {
  checkKnowledgeRecordFreshness,
  type KnowledgeFreshnessResult,
} from "./repository-knowledge/freshness.ts";
import {
  projectKnowledgeBehaviorSlice,
  type KnowledgeProjectionResult,
} from "./repository-knowledge/projector.ts";
import { queryKnowledgeRecords } from "./repository-knowledge/query.ts";
import { readKnowledgeRecords } from "./repository-knowledge/store.ts";

export interface LegoraEntryInput {
  repositoryRoot: string;
  question: string;
}

export interface LegoraEntryFreshness {
  recordId: string;
  result: KnowledgeFreshnessResult;
}

export type LegoraEntryStatus =
  | "READY"
  | "KNOWLEDGE_NOT_FOUND"
  | "KNOWLEDGE_STALE"
  | "KNOWLEDGE_UNKNOWN";

export type LegoraEntryNextAction =
  | {
      type: "ACQUIRE_KNOWLEDGE";
      question: string;
    }
  | {
      type: "REFRESH_KNOWLEDGE";
      question: string;
      recordIds: string[];
    };

export interface LegoraEntryResult {
  status: LegoraEntryStatus;
  question: string;
  flowRecordId: string | null;
  behaviorSlice: BehaviorSlice | null;
  evidenceClaims: EvidenceClaim[];
  diagnostics: KnowledgeProjectionResult["diagnostics"] | null;
  freshness: LegoraEntryFreshness[];
  nextAction: LegoraEntryNextAction | null;
}

function flowRecords(records: readonly KnowledgeRecord[]): KnowledgeRecord[] {
  return records.filter((record) => record.structure?.type === "BEHAVIOR_FLOW");
}

function relatedRecordIds(record: KnowledgeRecord): string[] {
  if (record.structure?.type === "ENTITY") return [record.id];
  if (record.structure?.type === "RELATIONSHIP") {
    return [record.id, record.structure.sourceId, record.structure.targetId];
  }
  if (record.structure?.type === "BEHAVIOR_FLOW") {
    return [record.id, ...record.structure.steps.map((step) => step.entityId)];
  }
  return [record.id];
}

function selectFlowRecord(
  records: readonly KnowledgeRecord[],
  matches: readonly KnowledgeRecord[],
): KnowledgeRecord | null {
  const flows = flowRecords(records).sort((left, right) => left.id.localeCompare(right.id));

  for (const match of matches) {
    if (match.structure?.type === "BEHAVIOR_FLOW") return match;

    const relatedIds = new Set(relatedRecordIds(match));
    const connected = flows.find((flow) => flow.structure?.type === "BEHAVIOR_FLOW"
      && flow.structure.steps.some((step) => relatedIds.has(step.entityId)));
    if (connected) return connected;
  }

  return null;
}

function referencedRecordIds(projection: KnowledgeProjectionResult): Set<string> {
  const ids = new Set<string>([projection.source.flowRecordId]);
  const facts = [
    ...projection.behaviorSlice.participants,
    ...projection.behaviorSlice.states,
    ...projection.behaviorSlice.events,
    ...projection.behaviorSlice.flows,
    ...projection.behaviorSlice.constraints,
    ...projection.behaviorSlice.effects,
    ...projection.behaviorSlice.failures,
  ];
  for (const fact of facts) {
    for (const ref of fact.providerRefs) ids.add(ref);
  }
  return ids;
}

async function checkProjectionFreshness(
  repositoryRoot: string,
  records: readonly KnowledgeRecord[],
  projection: KnowledgeProjectionResult,
): Promise<LegoraEntryFreshness[]> {
  const byId = new Map(records.map((record) => [record.id, record]));
  const freshness: LegoraEntryFreshness[] = [];
  for (const recordId of [...referencedRecordIds(projection)].sort()) {
    const record = byId.get(recordId);
    if (!record) continue;
    freshness.push({
      recordId,
      result: await checkKnowledgeRecordFreshness(repositoryRoot, record),
    });
  }
  return freshness;
}

function blockedStatus(freshness: readonly LegoraEntryFreshness[]): LegoraEntryStatus | null {
  if (freshness.some((item) => item.result.status === "STALE")) return "KNOWLEDGE_STALE";
  if (freshness.some((item) => item.result.status === "UNKNOWN")) return "KNOWLEDGE_UNKNOWN";
  return null;
}

export async function runLegoraEntry(input: LegoraEntryInput): Promise<LegoraEntryResult> {
  const records = await readKnowledgeRecords(input.repositoryRoot);
  const matches = queryKnowledgeRecords(records, input.question);
  const flow = selectFlowRecord(records, matches);

  if (!flow) {
    return {
      status: "KNOWLEDGE_NOT_FOUND",
      question: input.question,
      flowRecordId: null,
      behaviorSlice: null,
      evidenceClaims: [],
      diagnostics: null,
      freshness: [],
      nextAction: {
        type: "ACQUIRE_KNOWLEDGE",
        question: input.question,
      },
    };
  }

  const projection = projectKnowledgeBehaviorSlice(records, flow.id);
  const freshness = await checkProjectionFreshness(input.repositoryRoot, records, projection);
  const blocked = blockedStatus(freshness);

  if (blocked) {
    return {
      status: blocked,
      question: input.question,
      flowRecordId: flow.id,
      behaviorSlice: null,
      evidenceClaims: [],
      diagnostics: projection.diagnostics,
      freshness,
      nextAction: {
        type: "REFRESH_KNOWLEDGE",
        question: input.question,
        recordIds: freshness
          .filter((item) => item.result.status !== "CURRENT")
          .map((item) => item.recordId),
      },
    };
  }

  return {
    status: "READY",
    question: input.question,
    flowRecordId: flow.id,
    behaviorSlice: projection.behaviorSlice,
    evidenceClaims: projection.evidenceClaims,
    diagnostics: projection.diagnostics,
    freshness,
    nextAction: null,
  };
}

export const prepareLegoraEntry = runLegoraEntry;
