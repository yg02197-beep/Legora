export type KnowledgeEvidenceConfidence = "CONFIRMED" | "INFERRED" | "UNKNOWN";

export interface KnowledgeEvidenceAnchor {
  filePath: string;
  lineStart: number;
  lineEnd?: number;
  snippet?: string;
  confidence?: KnowledgeEvidenceConfidence;
  sourceConfidence?: string;
  provenance?: string | null;
}

export type KnowledgeEvidenceSet = KnowledgeEvidenceAnchor[];

export interface KnowledgeEntityStructure {
  type: "ENTITY";
  entityKind: string;
  name?: string;
  description?: string;
}

export interface KnowledgeRelationshipStructure {
  type: "RELATIONSHIP";
  relationshipKind: string;
  sourceId: string;
  targetId: string;
}

export interface KnowledgeBehaviorFlowStep {
  entityId: string;
  label?: string;
}

export interface KnowledgeBehaviorFlowStructure {
  type: "BEHAVIOR_FLOW";
  flowKind: string;
  name: string;
  steps: KnowledgeBehaviorFlowStep[];
}

export type KnowledgeStructure =
  | KnowledgeEntityStructure
  | KnowledgeRelationshipStructure
  | KnowledgeBehaviorFlowStructure;

export interface KnowledgeRecord {
  id: string;
  kind: string;
  subject: string;
  structure?: KnowledgeStructure;
  activeEvidence: KnowledgeEvidenceSet;
  history: KnowledgeEvidenceSet[];
  createdAt: string;
  updatedAt: string;
}
