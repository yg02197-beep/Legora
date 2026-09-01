import type { KnowledgeRecord } from "./contracts.ts";
import type {
  KnowledgeAcquisitionProposal,
  KnowledgeEvidenceLocator,
  NativeKnowledgeCandidate,
} from "./acquisition-contracts.ts";

export type AcquisitionValidationIssueCode =
  | "CANDIDATE_REQUIRED"
  | "IDENTITY_REQUIRED"
  | "STRUCTURE_REQUIRED"
  | "EVIDENCE_REQUIRED"
  | "EVIDENCE_LOCATOR_INVALID"
  | "DUPLICATE_CANDIDATE_ID"
  | "REFERENCE_ENTITY_NOT_FOUND";

export interface AcquisitionValidationIssue {
  code: AcquisitionValidationIssueCode;
  candidateId: string;
  referenceId?: string;
}

export interface AcquisitionValidationResult {
  valid: boolean;
  issues: AcquisitionValidationIssue[];
}

function hasIdentity(candidate: NativeKnowledgeCandidate): boolean {
  return candidate.id.trim().length > 0
    && candidate.kind.trim().length > 0
    && candidate.subject.trim().length > 0;
}

function isValidEvidenceLocator(locator: KnowledgeEvidenceLocator): boolean {
  const end = locator.lineEnd ?? locator.lineStart;
  return locator.filePath.trim().length > 0
    && Number.isInteger(locator.lineStart)
    && Number.isInteger(end)
    && locator.lineStart >= 1
    && end >= locator.lineStart;
}

function evidenceLocatorKey(locator: KnowledgeEvidenceLocator): string {
  return `${locator.filePath}\u0000${locator.lineStart}\u0000${locator.lineEnd ?? locator.lineStart}`;
}

function hasValidEvidenceLocators(candidate: NativeKnowledgeCandidate): boolean {
  if (!candidate.evidenceLocators.every(isValidEvidenceLocator)) return false;
  if (candidate.evidenceCaptureLocators === undefined) return true;
  if (candidate.evidenceCaptureLocators.length === 0
    || !candidate.evidenceCaptureLocators.every(isValidEvidenceLocator)) {
    return false;
  }

  const captureLocatorKeys = new Set(candidate.evidenceCaptureLocators.map(evidenceLocatorKey));
  return candidate.evidenceLocators.every((locator) => captureLocatorKeys.has(evidenceLocatorKey(locator)));
}

function validateReferences(
  candidate: { id: string; structure?: KnowledgeRecord["structure"] },
  entityIds: ReadonlySet<string>,
  issues: AcquisitionValidationIssue[],
): void {
  const structure = candidate.structure;
  if (!structure) return;

  if (structure.type === "RELATIONSHIP") {
    for (const referenceId of [structure.sourceId, structure.targetId]) {
      if (!entityIds.has(referenceId)) {
        issues.push({
          code: "REFERENCE_ENTITY_NOT_FOUND",
          candidateId: candidate.id,
          referenceId,
        });
      }
    }
    return;
  }

  if (structure.type === "BEHAVIOR_FLOW") {
    for (const step of structure.steps) {
      if (!entityIds.has(step.entityId)) {
        issues.push({
          code: "REFERENCE_ENTITY_NOT_FOUND",
          candidateId: candidate.id,
          referenceId: step.entityId,
        });
      }
    }
  }
}

export function validateAcquisitionProposal(
  proposal: KnowledgeAcquisitionProposal,
  existingRecords: readonly KnowledgeRecord[],
): AcquisitionValidationResult {
  const issues: AcquisitionValidationIssue[] = [];
  const seenIds = new Set<string>();

  if (proposal.candidates.length === 0) {
    issues.push({ code: "CANDIDATE_REQUIRED", candidateId: "" });
  }

  for (const candidate of proposal.candidates) {
    if (seenIds.has(candidate.id)) {
      issues.push({
        code: "DUPLICATE_CANDIDATE_ID",
        candidateId: candidate.id,
      });
    } else {
      seenIds.add(candidate.id);
    }
  }

  const candidateIds = new Set(proposal.candidates.map((candidate) => candidate.id));
  const effectiveRecords: Array<{ id: string; structure?: KnowledgeRecord["structure"] }> = [
    ...existingRecords.filter((record) => !candidateIds.has(record.id)),
    ...proposal.candidates,
  ];
  const entityIds = new Set(
    effectiveRecords
      .filter((record) => record.structure?.type === "ENTITY")
      .map((record) => record.id),
  );

  for (const candidate of proposal.candidates) {
    if (!hasIdentity(candidate)) {
      issues.push({ code: "IDENTITY_REQUIRED", candidateId: candidate.id });
    }
    if (!candidate.structure) {
      issues.push({ code: "STRUCTURE_REQUIRED", candidateId: candidate.id });
    }
    if (candidate.evidenceLocators.length === 0) {
      issues.push({ code: "EVIDENCE_REQUIRED", candidateId: candidate.id });
    } else if (!hasValidEvidenceLocators(candidate)) {
      issues.push({ code: "EVIDENCE_LOCATOR_INVALID", candidateId: candidate.id });
    }
  }

  for (const record of effectiveRecords) validateReferences(record, entityIds, issues);

  return {
    valid: issues.length === 0,
    issues,
  };
}
