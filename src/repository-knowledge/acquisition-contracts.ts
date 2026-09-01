import type { KnowledgeStructure } from "./contracts.ts";

export interface KnowledgeEvidenceLocator {
  filePath: string;
  lineStart: number;
  lineEnd?: number;
}

export interface NativeKnowledgeCandidate {
  id: string;
  kind: string;
  subject: string;
  structure?: KnowledgeStructure;
  evidenceLocators: KnowledgeEvidenceLocator[];
  evidenceCaptureLocators?: KnowledgeEvidenceLocator[];
}

export interface KnowledgeAcquisitionProposal {
  candidates: NativeKnowledgeCandidate[];
}
