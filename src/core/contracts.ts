export type EvidenceConfidence = "CONFIRMED" | "INFERRED" | "UNKNOWN";

export type BehaviorFactCategory =
  | "participants"
  | "states"
  | "events"
  | "flows"
  | "constraints"
  | "effects"
  | "failures";

export interface EvidenceAnchor {
  filePath: string;
  lineStart: number;
  lineEnd?: number;
  snippet?: string;
}

export interface EvidenceClaim {
  id: string;
  claim: string;
  confidence: EvidenceConfidence;
  sourceConfidence: string;
  evidence: EvidenceAnchor[];
  providerObjectId: string;
  provenance: string | null;
}

export interface BehaviorFact {
  id: string;
  text: string;
  providerRefs: string[];
  requiredEvidenceClaimIds: string[];
}

export interface BehaviorSlice {
  owner: "LEGORA";
  subject: string;
  participants: BehaviorFact[];
  states: BehaviorFact[];
  events: BehaviorFact[];
  flows: BehaviorFact[];
  constraints: BehaviorFact[];
  effects: BehaviorFact[];
  failures: BehaviorFact[];
}

export interface AdapterDiagnostic {
  code: string;
  message: string;
  providerRef?: string;
}

export interface CartographerProjectionResult {
  provider: {
    kind: "CARTOGRAPHER";
    projectRoot: string;
    modelId: string | null;
    sliceId: string;
    decoderContract: "cartographer-decoder-v1";
  };
  behaviorSlice: BehaviorSlice;
  evidenceClaims: EvidenceClaim[];
  diagnostics: {
    warnings: AdapterDiagnostic[];
    ignoredKinds: string[];
    ignoredRelations: string[];
  };
}
