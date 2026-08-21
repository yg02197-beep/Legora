import path from "node:path";
import type { AdapterDiagnostic } from "../../core/contracts.ts";
import { CartographerAdapterError } from "./errors.ts";
import type {
  CartographerDecodeDiagnostics,
  CartographerEntityView,
  CartographerEvidenceView,
  CartographerModelView,
  CartographerRelationshipView,
  CartographerSliceView,
} from "./model-view.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function shapeError(message: string): never {
  throw new CartographerAdapterError("CARTOGRAPHER_MODEL_SHAPE_UNSUPPORTED", message);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    return shapeError(`Cartographer field '${field}' must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function decodeEvidence(value: unknown, ownerId: string): CartographerEvidenceView[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return shapeError(`Evidence for '${ownerId}' must be an array.`);

  return value.map((item, index) => {
    if (!isRecord(item)) return shapeError(`Evidence '${ownerId}[${index}]' must be an object.`);
    if (item.anchors !== undefined && !Array.isArray(item.anchors)) {
      return shapeError(`Evidence anchors '${ownerId}[${index}]' must be an array.`);
    }
    return {
      id: optionalString(item.id),
      confidence: optionalString(item.confidence),
      provenance: optionalString(item.provenance),
      anchors: Array.isArray(item.anchors)
        ? item.anchors.filter(isRecord).map((anchor) => ({
            filePath: optionalString(anchor.filePath),
            lineStart: typeof anchor.lineStart === "number" ? anchor.lineStart : undefined,
            lineEnd: typeof anchor.lineEnd === "number" ? anchor.lineEnd : undefined,
            snippet: optionalString(anchor.snippet),
          }))
        : [],
    };
  });
}

function decodeEntity(value: unknown, index: number): CartographerEntityView {
  if (!isRecord(value)) return shapeError(`Entity at index ${index} must be an object.`);
  const id = requiredString(value.id, `entities[${index}].id`);
  return {
    id,
    kind: requiredString(value.kind, `entities[${index}].kind`),
    name: optionalString(value.name),
    description: optionalString(value.description),
    parentBoundary: optionalString(value.parentBoundary),
    evidence: decodeEvidence(value.evidence, id),
  };
}

function decodeRelationship(value: unknown, index: number): CartographerRelationshipView {
  if (!isRecord(value)) return shapeError(`Relationship at index ${index} must be an object.`);
  const id = requiredString(value.id, `relationships[${index}].id`);
  return {
    id,
    kind: requiredString(value.kind, `relationships[${index}].kind`),
    source: requiredString(value.source, `relationships[${index}].source`),
    target: requiredString(value.target, `relationships[${index}].target`),
    description: optionalString(value.description),
    evidence: decodeEvidence(value.evidence, id),
  };
}

function decodeSlice(value: unknown, index: number): CartographerSliceView {
  if (!isRecord(value)) return shapeError(`Slice at index ${index} must be an object.`);
  const id = requiredString(value.id, `slices[${index}].id`);
  if (!Array.isArray(value.steps)) return shapeError(`Slice '${id}' steps must be an array.`);
  return {
    id,
    name: requiredString(value.name, `slices[${index}].name`),
    description: optionalString(value.description),
    kind: optionalString(value.kind),
    steps: value.steps.map((step, stepIndex) => {
      if (!isRecord(step)) return shapeError(`Slice '${id}' step ${stepIndex} must be an object.`);
      return {
        entityId: requiredString(step.entityId, `slices[${index}].steps[${stepIndex}].entityId`),
        label: optionalString(step.label),
      };
    }),
    evidence: decodeEvidence(value.evidence, id),
  };
}

function normalizedRoot(value: string): string {
  return path.resolve(value).replaceAll("\\", "/").replace(/\/$/, "").toLowerCase();
}

export function decodeCartographerModel(document: unknown, expectedRepositoryRoot: string): CartographerModelView {
  if (!isRecord(document)) return shapeError("Cartographer model must be a JSON object.");
  const rootPath = requiredString(document.rootPath, "rootPath");
  if (!Array.isArray(document.entities) || !Array.isArray(document.relationships) || !Array.isArray(document.slices)) {
    return shapeError("Cartographer model requires entities[], relationships[], and slices[].");
  }

  if (normalizedRoot(rootPath) !== normalizedRoot(expectedRepositoryRoot)) {
    throw new CartographerAdapterError(
      "CARTOGRAPHER_ROOT_MISMATCH",
      `Cartographer root '${rootPath}' does not match expected repository root '${expectedRepositoryRoot}'.`,
    );
  }

  const entities = document.entities.map(decodeEntity);
  const relationships = document.relationships.map(decodeRelationship);
  const slices = document.slices.map(decodeSlice);

  const seen = new Set<string>();
  for (const object of [...entities, ...relationships, ...slices]) {
    if (seen.has(object.id)) {
      throw new CartographerAdapterError("CARTOGRAPHER_DUPLICATE_ID", `Duplicate Cartographer object id '${object.id}'.`);
    }
    seen.add(object.id);
  }

  const entityIds = new Set(entities.map((entity) => entity.id));
  for (const slice of slices) {
    for (const step of slice.steps) {
      if (!entityIds.has(step.entityId)) {
        throw new CartographerAdapterError(
          "CARTOGRAPHER_SLICE_ENTITY_NOT_FOUND",
          `Slice '${slice.id}' references missing entity '${step.entityId}'.`,
        );
      }
    }
  }

  const knownTopLevel = new Set([
    "id", "rootPath", "entities", "relationships", "slices", "perspectives",
    "activePerspectiveId", "createdAt", "updatedAt",
  ]);
  const ignoredFields = Object.keys(document).filter((key) => !knownTopLevel.has(key));
  const warnings: AdapterDiagnostic[] = ignoredFields.map((field) => ({
    code: "CARTOGRAPHER_UNKNOWN_TOP_LEVEL_FIELD",
    message: `Unknown Cartographer top-level field '${field}' was ignored.`,
  }));
  const decodeDiagnostics: CartographerDecodeDiagnostics = { warnings, ignoredFields };

  return {
    id: optionalString(document.id) ?? null,
    rootPath,
    entities,
    relationships,
    slices,
    decodeDiagnostics,
  };
}
