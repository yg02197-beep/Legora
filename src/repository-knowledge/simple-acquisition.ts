import type {
  KnowledgeAcquisitionProposal,
  KnowledgeEvidenceLocator,
  NativeKnowledgeCandidate,
} from "./acquisition-contracts.ts";
import {
  acquireRepositoryKnowledge,
  type NativeAcquisitionResult,
} from "./acquisition-service.ts";
import type { KnowledgeRecord } from "./contracts.ts";
import { readKnowledgeRecords } from "./store.ts";

interface SimpleAcquisitionBase {
  subject: string;
  evidenceLocators: KnowledgeEvidenceLocator[];
}

export interface SimpleEntityAcquisitionInput extends SimpleAcquisitionBase {
  type: "entity";
  name?: string;
  entityKind?: string;
  description?: string;
}

export interface SimpleFlowAcquisitionStep {
  entity: string;
  label?: string;
  evidenceLocators?: KnowledgeEvidenceLocator[];
}

export interface SimpleFlowAcquisitionInput extends SimpleAcquisitionBase {
  type: "flow";
  flowKind?: string;
  steps: SimpleFlowAcquisitionStep[];
}

export interface SimpleRelationshipAcquisitionInput extends SimpleAcquisitionBase {
  type: "relationship";
  relationshipKind?: string;
  source: string;
  target: string;
}

export type SimpleKnowledgeAcquisitionInput =
  | SimpleEntityAcquisitionInput
  | SimpleFlowAcquisitionInput
  | SimpleRelationshipAcquisitionInput;

export const SIMPLE_ACQUISITION_EXAMPLES: readonly SimpleKnowledgeAcquisitionInput[] = [
  {
    type: "entity",
    subject: "service entry point",
    name: "Service",
    entityKind: "service",
    evidenceLocators: [{ filePath: "src/service.ts", lineStart: 1 }],
  },
  {
    type: "flow",
    subject: "Download fallback chain",
    flowKind: "routing",
    steps: [
      { entity: "Direct attempt", label: "Try direct download" },
      { entity: "General fallback", label: "Try fallback" },
    ],
    evidenceLocators: [{ filePath: "src/download.ts", lineStart: 1, lineEnd: 20 }],
  },
  {
    type: "relationship",
    subject: "Direct fallback to General",
    relationshipKind: "fallback",
    source: "Direct attempt",
    target: "General fallback",
    evidenceLocators: [{ filePath: "src/download.ts", lineStart: 10, lineEnd: 20 }],
  },
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalNonEmptyString(value: unknown): boolean {
  return value === undefined || isNonEmptyString(value);
}

function isEvidenceLocator(value: unknown): value is KnowledgeEvidenceLocator {
  if (!isObject(value) || !isNonEmptyString(value.filePath) || !Number.isInteger(value.lineStart)) return false;
  if ((value.lineStart as number) < 1) return false;
  if (value.lineEnd !== undefined && (!Number.isInteger(value.lineEnd) || (value.lineEnd as number) < (value.lineStart as number))) {
    return false;
  }
  return true;
}

function hasEvidenceLocators(value: unknown): value is KnowledgeEvidenceLocator[] {
  return Array.isArray(value) && value.length > 0 && value.every(isEvidenceLocator);
}

function hasOptionalEvidenceLocators(value: unknown): boolean {
  return value === undefined || hasEvidenceLocators(value);
}

export function parseSimpleKnowledgeAcquisition(value: unknown): SimpleKnowledgeAcquisitionInput | null {
  if (!isObject(value)
    || !isNonEmptyString(value.subject)
    || !hasEvidenceLocators(value.evidenceLocators)
    || !isNonEmptyString(value.type)) {
    return null;
  }

  if (value.type === "entity") {
    if (!isOptionalNonEmptyString(value.name)
      || !isOptionalNonEmptyString(value.entityKind)
      || (value.description !== undefined && typeof value.description !== "string")) {
      return null;
    }
    return value as unknown as SimpleEntityAcquisitionInput;
  }

  if (value.type === "flow") {
    if (!isOptionalNonEmptyString(value.flowKind)
      || !Array.isArray(value.steps)
      || value.steps.length === 0
      || !value.steps.every((step) => isObject(step)
        && isNonEmptyString(step.entity)
        && isOptionalNonEmptyString(step.label)
        && hasOptionalEvidenceLocators(step.evidenceLocators))) {
      return null;
    }
    return value as unknown as SimpleFlowAcquisitionInput;
  }

  if (value.type === "relationship") {
    if (!isOptionalNonEmptyString(value.relationshipKind)
      || !isNonEmptyString(value.source)
      || !isNonEmptyString(value.target)) {
      return null;
    }
    return value as unknown as SimpleRelationshipAcquisitionInput;
  }

  return null;
}

export function parseSimpleKnowledgeAcquisitionJson(raw: string | undefined): SimpleKnowledgeAcquisitionInput | null {
  if (!raw?.trim()) return null;
  try {
    return parseSimpleKnowledgeAcquisition(JSON.parse(raw));
  } catch {
    return null;
  }
}

function normalizedIdentity(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

function slug(value: string): string {
  const result = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return result || "knowledge";
}

function locatorKey(locator: KnowledgeEvidenceLocator): string {
  return `${locator.filePath}\u0000${locator.lineStart}\u0000${locator.lineEnd ?? locator.lineStart}`;
}

function flowEvidenceCapture(input: SimpleFlowAcquisitionInput): {
  captureLocators: KnowledgeEvidenceLocator[];
  stepIndexes: Array<number[] | undefined>;
  hasExplicitStepEvidence: boolean;
} {
  const captureLocators: KnowledgeEvidenceLocator[] = [];
  const indexesByLocator = new Map<string, number>();
  const addLocator = (locator: KnowledgeEvidenceLocator): number => {
    const key = locatorKey(locator);
    const existing = indexesByLocator.get(key);
    if (existing !== undefined) return existing;
    const index = captureLocators.length;
    captureLocators.push(locator);
    indexesByLocator.set(key, index);
    return index;
  };

  for (const locator of input.evidenceLocators) addLocator(locator);

  let hasExplicitStepEvidence = false;
  const stepIndexes = input.steps.map((step) => {
    if (step.evidenceLocators === undefined) return undefined;
    hasExplicitStepEvidence = true;
    return [...new Set(step.evidenceLocators.map(addLocator))];
  });

  return { captureLocators, stepIndexes, hasExplicitStepEvidence };
}

function existingEntityId(records: readonly KnowledgeRecord[], name: string): string | null {
  const target = normalizedIdentity(name);
  const found = records.find((record) => record.structure?.type === "ENTITY"
    && (normalizedIdentity(record.structure.name ?? "") === target
      || normalizedIdentity(record.subject) === target));
  return found?.id ?? null;
}

function participantCandidate(
  name: string,
  evidenceLocators: KnowledgeEvidenceLocator[],
): NativeKnowledgeCandidate {
  return {
    id: `native:entity:${slug(name)}`,
    kind: "entity:participant",
    subject: name.trim(),
    structure: {
      type: "ENTITY",
      entityKind: "participant",
      name: name.trim(),
    },
    evidenceLocators,
  };
}

function participantId(
  records: readonly KnowledgeRecord[],
  candidates: Map<string, NativeKnowledgeCandidate>,
  name: string,
  evidenceLocators: KnowledgeEvidenceLocator[],
): string {
  const existing = existingEntityId(records, name);
  if (existing) return existing;
  const candidate = participantCandidate(name, evidenceLocators);
  if (!candidates.has(candidate.id)) candidates.set(candidate.id, candidate);
  return candidate.id;
}

export function buildSimpleAcquisitionProposal(
  input: SimpleKnowledgeAcquisitionInput,
  existingRecords: readonly KnowledgeRecord[],
): KnowledgeAcquisitionProposal {
  if (input.type === "entity") {
    const name = (input.name ?? input.subject).trim();
    const entityKind = (input.entityKind ?? "concept").trim();
    return {
      candidates: [{
        id: `native:entity:${slug(name)}`,
        kind: `entity:${slug(entityKind)}`,
        subject: input.subject.trim(),
        structure: {
          type: "ENTITY",
          entityKind,
          name,
          ...(input.description === undefined ? {} : { description: input.description }),
        },
        evidenceLocators: input.evidenceLocators,
      }],
    };
  }

  const participants = new Map<string, NativeKnowledgeCandidate>();

  if (input.type === "flow") {
    const flowEvidence = flowEvidenceCapture(input);
    const steps = input.steps.map((step, index) => ({
      entityId: participantId(
        existingRecords,
        participants,
        step.entity,
        step.evidenceLocators ?? input.evidenceLocators,
      ),
      ...(step.label === undefined ? {} : { label: step.label }),
      ...(flowEvidence.stepIndexes[index] === undefined
        ? {}
        : { evidenceAnchorIndexes: flowEvidence.stepIndexes[index] }),
    }));
    const flowKind = (input.flowKind ?? "flow").trim();
    return {
      candidates: [
        ...participants.values(),
        {
          id: `native:flow:${slug(input.subject)}`,
          kind: `behavior-flow:${slug(flowKind)}`,
          subject: input.subject.trim(),
          structure: {
            type: "BEHAVIOR_FLOW",
            flowKind,
            name: input.subject.trim(),
            steps,
          },
          evidenceLocators: input.evidenceLocators,
          ...(flowEvidence.hasExplicitStepEvidence
            ? { evidenceCaptureLocators: flowEvidence.captureLocators }
            : {}),
        },
      ],
    };
  }

  const sourceId = participantId(existingRecords, participants, input.source, input.evidenceLocators);
  const targetId = participantId(existingRecords, participants, input.target, input.evidenceLocators);
  const relationshipKind = (input.relationshipKind ?? "related").trim();
  return {
    candidates: [
      ...participants.values(),
      {
        id: `native:relationship:${slug(input.subject)}`,
        kind: `relationship:${slug(relationshipKind)}`,
        subject: input.subject.trim(),
        structure: {
          type: "RELATIONSHIP",
          relationshipKind,
          sourceId,
          targetId,
        },
        evidenceLocators: input.evidenceLocators,
      },
    ],
  };
}

export async function acquireSimpleRepositoryKnowledge(input: {
  repositoryRoot: string;
  input: SimpleKnowledgeAcquisitionInput;
}): Promise<NativeAcquisitionResult> {
  const existingRecords = await readKnowledgeRecords(input.repositoryRoot);
  const proposal = buildSimpleAcquisitionProposal(input.input, existingRecords);
  return acquireRepositoryKnowledge({
    repositoryRoot: input.repositoryRoot,
    proposal,
  });
}
