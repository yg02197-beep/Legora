import type { AdapterDiagnostic } from "../core/contracts.ts";
import { decodeCartographerModel } from "../providers/cartographer/decoder.ts";
import { normalizeCartographerEvidence } from "../providers/cartographer/evidence.ts";
import type {
  CartographerEntityView,
  CartographerModelView,
  CartographerRelationshipView,
  CartographerSliceView,
} from "../providers/cartographer/model-view.ts";
import { readCartographerModelDocument } from "../providers/cartographer/source.ts";
import type { KnowledgeEvidenceSet, KnowledgeRecord } from "./contracts.ts";
import { readKnowledgeRecords, writeKnowledgeRecord } from "./store.ts";

export interface CartographerKnowledgeImportResult {
  records: KnowledgeRecord[];
  diagnostics: AdapterDiagnostic[];
}

function activeEvidenceFor(
  object: CartographerEntityView | CartographerRelationshipView | CartographerSliceView,
  diagnostics: AdapterDiagnostic[],
): KnowledgeEvidenceSet {
  const seen = new Set<string>();
  const result: KnowledgeEvidenceSet = [];

  for (const claim of normalizeCartographerEvidence(object, diagnostics)) {
    for (const anchor of claim.evidence) {
      const knowledgeAnchor = {
        ...anchor,
        confidence: claim.confidence,
        sourceConfidence: claim.sourceConfidence,
        provenance: claim.provenance,
      };
      const key = JSON.stringify(knowledgeAnchor);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(knowledgeAnchor);
    }
  }

  return result;
}

function entitySubject(entity: CartographerEntityView): string {
  if (entity.name && entity.description) return `${entity.name} — ${entity.description}`;
  return entity.name ?? entity.description ?? entity.id;
}

function relationshipSubject(relationship: CartographerRelationshipView): string {
  const base = `${relationship.source} ${relationship.kind} ${relationship.target}`;
  return relationship.description ? `${base} — ${relationship.description}` : base;
}

function flowSubject(slice: CartographerSliceView): string {
  const description = slice.description ? ` — ${slice.description}` : "";
  const steps = slice.steps
    .map((step) => `${step.entityId}${step.label ? ` (${step.label})` : ""}`)
    .join(" -> ");
  return `${slice.name}${description}${steps ? ` — steps: ${steps}` : ""}`;
}

function entityRecordId(entityId: string): string {
  return `cartographer:entity:${entityId}`;
}

export function importCartographerModelView(
  model: CartographerModelView,
  importedAt: string,
): CartographerKnowledgeImportResult {
  const diagnostics = [...model.decodeDiagnostics.warnings];

  const entityRecords = model.entities.map<KnowledgeRecord>((entity) => ({
    id: entityRecordId(entity.id),
    kind: `entity:${entity.kind}`,
    subject: entitySubject(entity),
    structure: {
      type: "ENTITY",
      entityKind: entity.kind,
      ...(entity.name ? { name: entity.name } : {}),
      ...(entity.description ? { description: entity.description } : {}),
    },
    activeEvidence: activeEvidenceFor(entity, diagnostics),
    history: [],
    createdAt: importedAt,
    updatedAt: importedAt,
  }));

  const relationshipRecords = model.relationships.map<KnowledgeRecord>((relationship) => ({
    id: `cartographer:relationship:${relationship.id}`,
    kind: `relationship:${relationship.kind}`,
    subject: relationshipSubject(relationship),
    structure: {
      type: "RELATIONSHIP",
      relationshipKind: relationship.kind,
      sourceId: entityRecordId(relationship.source),
      targetId: entityRecordId(relationship.target),
    },
    activeEvidence: activeEvidenceFor(relationship, diagnostics),
    history: [],
    createdAt: importedAt,
    updatedAt: importedAt,
  }));

  const flowRecords = model.slices.map<KnowledgeRecord>((slice) => ({
    id: `cartographer:flow:${slice.id}`,
    kind: `behavior-flow:${slice.kind ?? "flow"}`,
    subject: flowSubject(slice),
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: slice.kind ?? "flow",
      name: slice.name,
      steps: slice.steps.map((step) => ({
        entityId: entityRecordId(step.entityId),
        ...(step.label ? { label: step.label } : {}),
      })),
    },
    activeEvidence: activeEvidenceFor(slice, diagnostics),
    history: [],
    createdAt: importedAt,
    updatedAt: importedAt,
  }));

  return {
    records: [...entityRecords, ...relationshipRecords, ...flowRecords],
    diagnostics,
  };
}

function sameEvidence(left: KnowledgeEvidenceSet, right: KnowledgeEvidenceSet): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeImportedRecord(
  imported: KnowledgeRecord,
  existing: KnowledgeRecord | undefined,
): KnowledgeRecord {
  if (!existing) return imported;

  return {
    ...imported,
    createdAt: existing.createdAt,
    history: sameEvidence(existing.activeEvidence, imported.activeEvidence)
      ? existing.history
      : [...existing.history, existing.activeEvidence],
  };
}

export async function importCartographerRepositoryKnowledge(
  repositoryRoot: string,
  importedAt: string = new Date().toISOString(),
): Promise<CartographerKnowledgeImportResult> {
  const document = await readCartographerModelDocument(repositoryRoot);
  const model = decodeCartographerModel(document, repositoryRoot);
  const mapped = importCartographerModelView(model, importedAt);
  const existing = await readKnowledgeRecords(repositoryRoot);
  const existingById = new Map(existing.map((record) => [record.id, record]));
  const records = mapped.records.map((record) => mergeImportedRecord(record, existingById.get(record.id)));

  for (const record of records) {
    await writeKnowledgeRecord(repositoryRoot, record);
  }

  return { records, diagnostics: mapped.diagnostics };
}
