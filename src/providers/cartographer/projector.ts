import type {
  AdapterDiagnostic,
  BehaviorFact,
  BehaviorFactCategory,
  CartographerProjectionResult,
  EvidenceClaim,
} from "../../core/contracts.ts";
import { createBehaviorFactId } from "../../core/fact-id.ts";
import { CartographerAdapterError } from "./errors.ts";
import { normalizeCartographerEvidence } from "./evidence.ts";
import type {
  CartographerEntityView,
  CartographerModelView,
  CartographerRelationshipView,
} from "./model-view.ts";

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function factText(entity: CartographerEntityView): string {
  return entity.name ?? entity.description ?? entity.id;
}

function claimsFor(
  object: { id: string; name?: string; description?: string; evidence?: CartographerEntityView["evidence"] },
  warnings: AdapterDiagnostic[],
): EvidenceClaim[] {
  return normalizeCartographerEvidence(object, warnings);
}

function makeFact(
  category: BehaviorFactCategory,
  text: string,
  providerRefs: string[],
  requiredEvidenceClaimIds: string[],
): BehaviorFact {
  return {
    id: createBehaviorFactId(category, providerRefs),
    text,
    providerRefs,
    requiredEvidenceClaimIds,
  };
}

function directFact(
  category: BehaviorFactCategory,
  entity: CartographerEntityView,
  warnings: AdapterDiagnostic[],
): { fact: BehaviorFact; claims: EvidenceClaim[] } {
  const claims = claimsFor(entity, warnings);
  return {
    fact: makeFact(category, factText(entity), [entity.id], claims.map((claim) => claim.id)),
    claims,
  };
}

function semanticFact(
  category: BehaviorFactCategory,
  semanticEntity: CartographerEntityView,
  relationship: CartographerRelationshipView,
  stepEntity: CartographerEntityView,
  warnings: AdapterDiagnostic[],
): { fact: BehaviorFact; claims: EvidenceClaim[] } {
  const semanticClaims = claimsFor(semanticEntity, warnings);
  const relationshipClaims = claimsFor(relationship, warnings);
  const stepClaims = claimsFor(stepEntity, warnings);
  const claims = [...semanticClaims, ...relationshipClaims, ...stepClaims];
  return {
    fact: makeFact(
      category,
      semanticEntity.description ?? semanticEntity.name ?? semanticEntity.id,
      [semanticEntity.id, relationship.id, stepEntity.id],
      claims.map((claim) => claim.id),
    ),
    claims,
  };
}

function appendUniqueFact(target: BehaviorFact[], fact: BehaviorFact): void {
  if (!target.some((candidate) => candidate.id === fact.id)) {
    target.push(fact);
  }
}

export function projectCartographerSlice(
  model: CartographerModelView,
  sliceId: string,
): CartographerProjectionResult {
  const slice = model.slices.find((candidate) => candidate.id === sliceId);
  if (!slice) {
    throw new CartographerAdapterError(
      "CARTOGRAPHER_SLICE_NOT_FOUND",
      `Cartographer slice '${sliceId}' was not found.`,
    );
  }

  const entitiesById = new Map(model.entities.map((entity) => [entity.id, entity]));
  const stepEntities = slice.steps.map((step) => {
    const entity = entitiesById.get(step.entityId);
    if (!entity) {
      throw new CartographerAdapterError(
        "CARTOGRAPHER_SLICE_ENTITY_NOT_FOUND",
        `Cartographer slice '${slice.id}' references missing entity '${step.entityId}'.`,
      );
    }
    return entity;
  });
  const stepIds = new Set(stepEntities.map((entity) => entity.id));

  const warnings: AdapterDiagnostic[] = [...model.decodeDiagnostics.warnings];
  const ignoredKinds: string[] = [];
  const ignoredRelations: string[] = [];
  const evidenceClaims: EvidenceClaim[] = [];
  const evidenceIds = new Set<string>();
  const addClaims = (claims: EvidenceClaim[]) => {
    for (const claim of claims) {
      if (!evidenceIds.has(claim.id)) {
        evidenceIds.add(claim.id);
        evidenceClaims.push(claim);
      }
    }
  };

  const sliceClaims = claimsFor(slice, warnings);
  addClaims(sliceClaims);

  const behaviorSlice: CartographerProjectionResult["behaviorSlice"] = {
    owner: "LEGORA",
    subject: slice.name,
    participants: [],
    states: [],
    events: [],
    flows: [],
    constraints: [],
    effects: [],
    failures: [],
  };

  slice.steps.forEach((step, index) => {
    const entity = stepEntities[index]!;
    if (entity.kind === "actor") {
      const direct = directFact("participants", entity, warnings);
      addClaims(direct.claims);
      appendUniqueFact(behaviorSlice.participants, direct.fact);
    }
    if (entity.kind === "state") {
      const direct = directFact("states", entity, warnings);
      addClaims(direct.claims);
      appendUniqueFact(behaviorSlice.states, direct.fact);
    }
    if (entity.kind === "event") {
      const direct = directFact("events", entity, warnings);
      addClaims(direct.claims);
      appendUniqueFact(behaviorSlice.events, direct.fact);
    }

    const stepClaims = claimsFor(entity, warnings);
    addClaims(stepClaims);

    if (typeof step.label === "string" && step.label.length > 0) {
      appendUniqueFact(behaviorSlice.flows, makeFact(
        "flows",
        step.label,
        [slice.id, entity.id],
        unique([
          ...sliceClaims.map((claim) => claim.id),
          ...stepClaims.map((claim) => claim.id),
        ]),
      ));
    }
  });

  for (const relationship of model.relationships) {
    const sourceStep = stepIds.has(relationship.source);
    const targetStep = stepIds.has(relationship.target);
    const sourceEntity = entitiesById.get(relationship.source);
    const targetEntity = entitiesById.get(relationship.target);

    if (!sourceStep && !targetStep) {
      if (sourceEntity?.kind === "side-effect" || sourceEntity?.kind === "failure-point" || sourceEntity?.kind === "invariant") {
        ignoredRelations.push(relationship.kind);
      }
      continue;
    }

    const stepEntity = sourceStep ? sourceEntity : targetEntity;
    const neighbor = sourceStep ? targetEntity : sourceEntity;
    if (!stepEntity || !neighbor) {
      ignoredRelations.push(relationship.kind);
      continue;
    }

    let destination: BehaviorFact[] | null = null;
    let category: BehaviorFactCategory | null = null;
    if (relationship.kind === "guards" && neighbor.kind === "invariant") {
      destination = behaviorSlice.constraints;
      category = "constraints";
    } else if (relationship.kind === "triggers" && neighbor.kind === "side-effect") {
      destination = behaviorSlice.effects;
      category = "effects";
    } else if (relationship.kind === "triggers" && neighbor.kind === "failure-point") {
      destination = behaviorSlice.failures;
      category = "failures";
    } else {
      ignoredRelations.push(relationship.kind);
      if (!["actor", "state", "event", "capability", "invariant", "side-effect", "failure-point", "boundary", "transition"].includes(neighbor.kind)) {
        ignoredKinds.push(neighbor.kind);
      } else if (neighbor.kind === "entity") {
        ignoredKinds.push(neighbor.kind);
      }
      continue;
    }

    const semantic = semanticFact(category, neighbor, relationship, stepEntity, warnings);
    addClaims(semantic.claims);
    appendUniqueFact(destination, semantic.fact);
  }

  return {
    provider: {
      kind: "CARTOGRAPHER",
      projectRoot: model.rootPath,
      modelId: model.id,
      sliceId: slice.id,
      decoderContract: "cartographer-decoder-v1",
    },
    behaviorSlice,
    evidenceClaims,
    diagnostics: {
      warnings,
      ignoredKinds: unique(ignoredKinds),
      ignoredRelations: unique(ignoredRelations),
    },
  };
}
