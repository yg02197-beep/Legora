import type {
  KnowledgeAcquisitionProposal,
  KnowledgeEvidenceLocator,
  NativeKnowledgeCandidate,
} from "./acquisition-contracts.ts";
import type { KnowledgeEvidenceAnchor, KnowledgeRecord } from "./contracts.ts";
import { queryKnowledgeRecordMatches } from "./query.ts";

export type DuplicateKnowledgeReason =
  | "STRUCTURE_IDENTITY"
  | "MEANING_OVERLAP"
  | "EVIDENCE_LOCATOR_OVERLAP";

export interface DuplicateKnowledgeMatch {
  candidateId: string;
  existingRecordId: string;
  reasons: DuplicateKnowledgeReason[];
}

function normalized(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function sameStructureIdentity(candidate: NativeKnowledgeCandidate, existing: KnowledgeRecord): boolean {
  const left = candidate.structure;
  const right = existing.structure;
  if (!left || !right || left.type !== right.type) return false;

  if (left.type === "ENTITY" && right.type === "ENTITY") {
    return normalized(left.entityKind) === normalized(right.entityKind)
      && Boolean(left.name && right.name)
      && normalized(left.name) === normalized(right.name);
  }

  if (left.type === "RELATIONSHIP" && right.type === "RELATIONSHIP") {
    return normalized(left.relationshipKind) === normalized(right.relationshipKind)
      && left.sourceId === right.sourceId
      && left.targetId === right.targetId;
  }

  if (left.type === "BEHAVIOR_FLOW" && right.type === "BEHAVIOR_FLOW") {
    const leftIds = left.steps.map((step) => step.entityId);
    const rightIds = right.steps.map((step) => step.entityId);
    return leftIds.length === rightIds.length
      && leftIds.every((entityId, index) => entityId === rightIds[index]);
  }

  return false;
}

function rangesOverlap(
  locator: KnowledgeEvidenceLocator,
  anchor: KnowledgeEvidenceAnchor,
): boolean {
  if (locator.filePath !== anchor.filePath) return false;
  const locatorEnd = locator.lineEnd ?? locator.lineStart;
  const anchorEnd = anchor.lineEnd ?? anchor.lineStart;
  return locator.lineStart <= anchorEnd && anchor.lineStart <= locatorEnd;
}

function evidenceOverlaps(candidate: NativeKnowledgeCandidate, existing: KnowledgeRecord): boolean {
  return candidate.evidenceLocators.some((locator) =>
    existing.activeEvidence.some((anchor) => rangesOverlap(locator, anchor)),
  );
}

function meaningOverlaps(candidate: NativeKnowledgeCandidate, existing: KnowledgeRecord): boolean {
  const [match] = queryKnowledgeRecordMatches([existing], candidate.subject);
  return match?.confidence === "STRONG";
}

function duplicateReasons(
  candidate: NativeKnowledgeCandidate,
  existing: KnowledgeRecord,
): DuplicateKnowledgeReason[] {
  if (candidate.structure && existing.structure
    && candidate.structure.type !== existing.structure.type) {
    return [];
  }
  const reasons: DuplicateKnowledgeReason[] = [];
  if (sameStructureIdentity(candidate, existing)) reasons.push("STRUCTURE_IDENTITY");
  if (meaningOverlaps(candidate, existing)) reasons.push("MEANING_OVERLAP");
  if (evidenceOverlaps(candidate, existing)) reasons.push("EVIDENCE_LOCATOR_OVERLAP");
  return reasons;
}

function isDuplicate(reasons: readonly DuplicateKnowledgeReason[]): boolean {
  return reasons.includes("STRUCTURE_IDENTITY") || reasons.length >= 2;
}

export function findKnowledgeDuplicates(
  proposal: KnowledgeAcquisitionProposal,
  existingRecords: readonly KnowledgeRecord[],
): DuplicateKnowledgeMatch[] {
  const matches: DuplicateKnowledgeMatch[] = [];
  for (const candidate of proposal.candidates) {
    for (const existing of existingRecords) {
      if (candidate.id === existing.id) continue;
      const reasons = duplicateReasons(candidate, existing);
      if (!isDuplicate(reasons)) continue;
      matches.push({
        candidateId: candidate.id,
        existingRecordId: existing.id,
        reasons,
      });
    }
  }
  return matches.sort((left, right) =>
    left.candidateId.localeCompare(right.candidateId)
      || left.existingRecordId.localeCompare(right.existingRecordId),
  );
}
