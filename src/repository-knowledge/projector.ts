import type {
  AdapterDiagnostic,
  BehaviorFact,
  BehaviorFactCategory,
  BehaviorSlice,
  EvidenceClaim,
} from "../core/contracts.ts";
import { createBehaviorFactId } from "../core/fact-id.ts";
import type {
  KnowledgeEntityStructure,
  KnowledgeEvidenceAnchor,
  KnowledgeRecord,
  KnowledgeRelationshipStructure,
} from "./contracts.ts";
import { readKnowledgeRecords } from "./store.ts";

export interface KnowledgeProjectionResult {
  source: {
    kind: "REPOSITORY_KNOWLEDGE";
    flowRecordId: string;
  };
  behaviorSlice: BehaviorSlice;
  evidenceClaims: EvidenceClaim[];
  diagnostics: {
    warnings: AdapterDiagnostic[];
    ignoredKinds: string[];
    ignoredRelations: string[];
  };
}

export class RepositoryKnowledgeProjectionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "RepositoryKnowledgeProjectionError";
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function evidenceClaim(record: KnowledgeRecord, anchor: KnowledgeEvidenceAnchor, index: number): EvidenceClaim {
  return {
    id: `${record.id}#active-evidence-${index}`,
    claim: record.subject,
    confidence: anchor.confidence ?? "UNKNOWN",
    sourceConfidence: anchor.sourceConfidence ?? "unknown",
    evidence: [{
      filePath: anchor.filePath,
      lineStart: anchor.lineStart,
      ...(anchor.lineEnd !== undefined ? { lineEnd: anchor.lineEnd } : {}),
      ...(anchor.snippet !== undefined ? { snippet: anchor.snippet } : {}),
    }],
    providerObjectId: record.id,
    provenance: anchor.provenance ?? null,
  };
}

function claimsFor(record: KnowledgeRecord): EvidenceClaim[] {
  return record.activeEvidence.map((anchor, index) => evidenceClaim(record, anchor, index));
}

function claimsForExplicitFlowStep(
  flowRecordId: string,
  flowClaims: readonly EvidenceClaim[],
  indexes: readonly number[] | undefined,
): EvidenceClaim[] | null {
  if (indexes === undefined) return null;
  const seen = new Set<number>();
  if (indexes.length === 0) {
    throw new RepositoryKnowledgeProjectionError(
      "KNOWLEDGE_FLOW_EVIDENCE_INDEX_INVALID",
      `Repository knowledge flow '${flowRecordId}' contains an empty explicit step evidence index set.`,
    );
  }

  const claims: EvidenceClaim[] = [];
  for (const index of indexes) {
    if (!Number.isInteger(index) || index < 0 || index >= flowClaims.length || seen.has(index)) {
      throw new RepositoryKnowledgeProjectionError(
        "KNOWLEDGE_FLOW_EVIDENCE_INDEX_INVALID",
        `Repository knowledge flow '${flowRecordId}' contains invalid explicit step evidence index '${index}'.`,
      );
    }
    seen.add(index);
    claims.push(flowClaims[index]!);
  }
  return claims;
}

function makeFact(
  category: BehaviorFactCategory,
  text: string,
  recordRefs: string[],
  requiredEvidenceClaimIds: string[],
): BehaviorFact {
  return {
    id: createBehaviorFactId(category, recordRefs),
    text,
    providerRefs: recordRefs,
    requiredEvidenceClaimIds,
  };
}

function appendUniqueFact(target: BehaviorFact[], fact: BehaviorFact): void {
  if (!target.some((candidate) => candidate.id === fact.id)) target.push(fact);
}

function entityText(record: KnowledgeRecord, structure: KnowledgeEntityStructure): string {
  return structure.name ?? structure.description ?? record.subject;
}

function semanticText(record: KnowledgeRecord, structure: KnowledgeEntityStructure): string {
  return structure.description ?? structure.name ?? record.subject;
}

function relationshipKind(record: KnowledgeRecord, structure: KnowledgeRelationshipStructure): string {
  return structure.relationshipKind || record.kind.replace(/^relationship:/, "");
}

export function projectKnowledgeBehaviorSlice(
  records: readonly KnowledgeRecord[],
  flowRecordId: string,
): KnowledgeProjectionResult {
  const flow = records.find((record) => record.id === flowRecordId);
  if (!flow) {
    throw new RepositoryKnowledgeProjectionError(
      "KNOWLEDGE_FLOW_NOT_FOUND",
      `Repository knowledge flow '${flowRecordId}' was not found.`,
    );
  }
  if (flow.structure?.type !== "BEHAVIOR_FLOW") {
    throw new RepositoryKnowledgeProjectionError(
      "KNOWLEDGE_FLOW_STRUCTURE_REQUIRED",
      `Repository knowledge record '${flowRecordId}' is not a structured behavior flow.`,
    );
  }

  const entities = records.filter((record) => record.structure?.type === "ENTITY");
  const entitiesById = new Map(entities.map((record) => [record.id, record]));
  const relationships = records.filter((record) => record.structure?.type === "RELATIONSHIP");
  const stepEntities = flow.structure.steps.map((step) => {
    const entity = entitiesById.get(step.entityId);
    if (!entity) {
      throw new RepositoryKnowledgeProjectionError(
        "KNOWLEDGE_FLOW_ENTITY_NOT_FOUND",
        `Repository knowledge flow '${flowRecordId}' references missing entity '${step.entityId}'.`,
      );
    }
    return entity;
  });
  const stepIds = new Set(stepEntities.map((record) => record.id));
  const evidenceClaims: EvidenceClaim[] = [];
  const evidenceIds = new Set<string>();
  const addClaims = (claims: EvidenceClaim[]) => {
    for (const claim of claims) {
      if (evidenceIds.has(claim.id)) continue;
      evidenceIds.add(claim.id);
      evidenceClaims.push(claim);
    }
  };

  const flowClaims = claimsFor(flow);
  addClaims(flowClaims);
  const behaviorSlice: BehaviorSlice = {
    owner: "LEGORA",
    subject: flow.structure.name,
    participants: [],
    states: [],
    events: [],
    flows: [],
    constraints: [],
    effects: [],
    failures: [],
  };

  flow.structure.steps.forEach((step, index) => {
    const entity = stepEntities[index]!;
    const structure = entity.structure as KnowledgeEntityStructure;
    const entityClaims = claimsFor(entity);
    addClaims(entityClaims);

    let category: BehaviorFactCategory | null = null;
    let destination: BehaviorFact[] | null = null;
    if (structure.entityKind === "actor") {
      category = "participants";
      destination = behaviorSlice.participants;
    } else if (structure.entityKind === "state") {
      category = "states";
      destination = behaviorSlice.states;
    } else if (structure.entityKind === "event") {
      category = "events";
      destination = behaviorSlice.events;
    }
    if (category && destination) {
      appendUniqueFact(destination, makeFact(
        category,
        entityText(entity, structure),
        [entity.id],
        entityClaims.map((claim) => claim.id),
      ));
    }

    if (step.label) {
      const stepClaims = claimsForExplicitFlowStep(flow.id, flowClaims, step.evidenceAnchorIndexes);
      if (stepClaims) addClaims(stepClaims);
      appendUniqueFact(behaviorSlice.flows, makeFact(
        "flows",
        step.label,
        [flow.id, entity.id],
        stepClaims === null
          ? unique([
              ...flowClaims.map((claim) => claim.id),
              ...entityClaims.map((claim) => claim.id),
            ])
          : unique(stepClaims.map((claim) => claim.id)),
      ));
    }
  });

  const ignoredKinds: string[] = [];
  const ignoredRelations: string[] = [];
  for (const relationship of relationships) {
    const structure = relationship.structure as KnowledgeRelationshipStructure;
    const sourceStep = stepIds.has(structure.sourceId);
    const targetStep = stepIds.has(structure.targetId);
    if (!sourceStep && !targetStep) {
      const sourceEntity = entitiesById.get(structure.sourceId);
      if (sourceEntity?.structure?.type === "ENTITY"
        && ["invariant", "side-effect", "failure-point"].includes(sourceEntity.structure.entityKind)) {
        ignoredRelations.push(relationshipKind(relationship, structure));
      }
      continue;
    }

    const stepEntity = entitiesById.get(sourceStep ? structure.sourceId : structure.targetId);
    const neighbor = entitiesById.get(sourceStep ? structure.targetId : structure.sourceId);
    if (!stepEntity || !neighbor || neighbor.structure?.type !== "ENTITY") {
      ignoredRelations.push(relationshipKind(relationship, structure));
      continue;
    }

    const neighborStructure = neighbor.structure;
    const kind = relationshipKind(relationship, structure);
    let category: BehaviorFactCategory | null = null;
    let destination: BehaviorFact[] | null = null;
    if (kind === "guards" && neighborStructure.entityKind === "invariant") {
      category = "constraints";
      destination = behaviorSlice.constraints;
    } else if (kind === "triggers" && neighborStructure.entityKind === "side-effect") {
      category = "effects";
      destination = behaviorSlice.effects;
    } else if (kind === "triggers" && neighborStructure.entityKind === "failure-point") {
      category = "failures";
      destination = behaviorSlice.failures;
    } else {
      ignoredRelations.push(kind);
      if (!["actor", "state", "event", "capability", "invariant", "side-effect", "failure-point", "boundary", "transition"].includes(neighborStructure.entityKind)) {
        ignoredKinds.push(neighborStructure.entityKind);
      }
      continue;
    }

    const semanticClaims = claimsFor(neighbor);
    const relationshipClaims = claimsFor(relationship);
    const stepClaims = claimsFor(stepEntity);
    addClaims(semanticClaims);
    addClaims(relationshipClaims);
    addClaims(stepClaims);
    appendUniqueFact(destination, makeFact(
      category,
      semanticText(neighbor, neighborStructure),
      [neighbor.id, relationship.id, stepEntity.id],
      [...semanticClaims, ...relationshipClaims, ...stepClaims].map((claim) => claim.id),
    ));
  }

  return {
    source: { kind: "REPOSITORY_KNOWLEDGE", flowRecordId: flow.id },
    behaviorSlice,
    evidenceClaims,
    diagnostics: {
      warnings: [],
      ignoredKinds: unique(ignoredKinds),
      ignoredRelations: unique(ignoredRelations),
    },
  };
}

export async function projectRepositoryKnowledgeBehaviorSlice(
  repositoryRoot: string,
  flowRecordId: string,
): Promise<KnowledgeProjectionResult> {
  const records = await readKnowledgeRecords(repositoryRoot);
  return projectKnowledgeBehaviorSlice(records, flowRecordId);
}
