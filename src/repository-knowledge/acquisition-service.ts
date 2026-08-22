import fs from "node:fs/promises";
import type { KnowledgeAcquisitionProposal } from "./acquisition-contracts.ts";
import {
  validateAcquisitionProposal,
  type AcquisitionValidationResult,
} from "./acquisition-validator.ts";
import { captureEvidence } from "./evidence-capture.ts";
import type { KnowledgeEvidenceAnchor, KnowledgeRecord } from "./contracts.ts";
import { readKnowledgeRecords, transactKnowledgeRecordsAtomic } from "./store.ts";

export type NativeAcquisitionCode =
  | "ACQUIRED"
  | "STRUCTURE_INVALID"
  | "EVIDENCE_CAPTURE_FAILED";

export interface NativeAcquisitionResult {
  status: "ACQUIRED" | "REJECTED";
  code: NativeAcquisitionCode;
  recordIds: string[];
  validation: AcquisitionValidationResult;
  candidateId?: string;
  reason?: string;
}

async function captureCandidateEvidence(
  repositoryRoot: string,
  proposal: KnowledgeAcquisitionProposal,
): Promise<
  | { ok: true; evidenceByCandidateId: Map<string, KnowledgeEvidenceAnchor[]> }
  | { ok: false; candidateId: string; reason: string }
> {
  const evidenceByCandidateId = new Map<string, KnowledgeEvidenceAnchor[]>();

  for (const candidate of proposal.candidates) {
    const captured: KnowledgeEvidenceAnchor[] = [];
    for (const locator of candidate.evidenceLocators) {
      let result;
      try {
        result = await captureEvidence({
          repositoryRoot,
          locator,
          readFile: (filePath) => fs.readFile(filePath, "utf8"),
        });
      } catch (error) {
        return {
          ok: false,
          candidateId: candidate.id,
          reason: (error as NodeJS.ErrnoException).code ?? "EVIDENCE_READ_FAILED",
        };
      }

      if (result.status === "REJECTED") {
        return {
          ok: false,
          candidateId: candidate.id,
          reason: result.reason,
        };
      }

      captured.push({
        ...result.evidence,
        confidence: "INFERRED",
        sourceConfidence: "repository-captured",
        provenance: "legora-native-acquisition",
      });
    }
    evidenceByCandidateId.set(candidate.id, captured);
  }

  return { ok: true, evidenceByCandidateId };
}

function evidenceSetsEqual(
  left: readonly KnowledgeEvidenceAnchor[],
  right: readonly KnowledgeEvidenceAnchor[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((anchor, index) => {
    const candidate = right[index];
    return candidate !== undefined
      && anchor.filePath === candidate.filePath
      && anchor.lineStart === candidate.lineStart
      && anchor.lineEnd === candidate.lineEnd
      && anchor.snippet === candidate.snippet
      && anchor.confidence === candidate.confidence
      && anchor.sourceConfidence === candidate.sourceConfidence
      && anchor.provenance === candidate.provenance;
  });
}

export async function acquireRepositoryKnowledge(input: {
  repositoryRoot: string;
  proposal: KnowledgeAcquisitionProposal;
}): Promise<NativeAcquisitionResult> {
  const existingRecords = await readKnowledgeRecords(input.repositoryRoot);
  const validation = validateAcquisitionProposal(input.proposal, existingRecords);
  if (!validation.valid) {
    return {
      status: "REJECTED",
      code: "STRUCTURE_INVALID",
      recordIds: [],
      validation,
    };
  }

  const captured = await captureCandidateEvidence(input.repositoryRoot, input.proposal);
  if (!captured.ok) {
    return {
      status: "REJECTED",
      code: "EVIDENCE_CAPTURE_FAILED",
      recordIds: [],
      validation,
      candidateId: captured.candidateId,
      reason: captured.reason,
    };
  }

  return transactKnowledgeRecordsAtomic<NativeAcquisitionResult>(input.repositoryRoot, (currentRecords) => {
    const currentValidation = validateAcquisitionProposal(input.proposal, currentRecords);
    if (!currentValidation.valid) {
      return {
        result: {
          status: "REJECTED" as const,
          code: "STRUCTURE_INVALID" as const,
          recordIds: [],
          validation: currentValidation,
        },
      };
    }

    const acquiredAt = new Date().toISOString();
    const existingById = new Map(currentRecords.map((record) => [record.id, record]));
    const acquiredRecords: KnowledgeRecord[] = input.proposal.candidates.map((candidate) => {
      const previous = existingById.get(candidate.id);
      const activeEvidence = captured.evidenceByCandidateId.get(candidate.id) ?? [];
      const history = previous === undefined
        ? []
        : evidenceSetsEqual(previous.activeEvidence, activeEvidence)
          ? previous.history
          : [...previous.history, previous.activeEvidence];

      return {
        id: candidate.id,
        kind: candidate.kind,
        subject: candidate.subject,
        structure: candidate.structure,
        activeEvidence,
        history,
        createdAt: previous?.createdAt ?? acquiredAt,
        updatedAt: acquiredAt,
      };
    });

    const records = [...currentRecords];
    for (const record of acquiredRecords) {
      const existingIndex = records.findIndex((candidate) => candidate.id === record.id);
      if (existingIndex === -1) records.push(record);
      else records[existingIndex] = record;
    }

    return {
      records,
      result: {
        status: "ACQUIRED" as const,
        code: "ACQUIRED" as const,
        recordIds: acquiredRecords.map((record) => record.id),
        validation: currentValidation,
      },
    };
  });
}
