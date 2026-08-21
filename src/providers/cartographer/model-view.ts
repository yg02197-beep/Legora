import type { AdapterDiagnostic } from "../../core/contracts.ts";

export interface CartographerAnchorView {
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  snippet?: string;
}

export interface CartographerEvidenceView {
  id?: string;
  confidence?: string;
  provenance?: string;
  anchors?: CartographerAnchorView[];
}

export interface CartographerEntityView {
  id: string;
  kind: string;
  name?: string;
  description?: string;
  parentBoundary?: string;
  evidence: CartographerEvidenceView[];
}

export interface CartographerRelationshipView {
  id: string;
  kind: string;
  source: string;
  target: string;
  description?: string;
  evidence: CartographerEvidenceView[];
}

export interface CartographerSliceStepView {
  entityId: string;
  label?: string;
}

export interface CartographerSliceView {
  id: string;
  name: string;
  description?: string;
  kind?: string;
  steps: CartographerSliceStepView[];
  evidence: CartographerEvidenceView[];
}

export interface CartographerDecodeDiagnostics {
  warnings: AdapterDiagnostic[];
  ignoredFields: string[];
}

export interface CartographerModelView {
  id: string | null;
  rootPath: string;
  entities: CartographerEntityView[];
  relationships: CartographerRelationshipView[];
  slices: CartographerSliceView[];
  decodeDiagnostics: CartographerDecodeDiagnostics;
}
