import type { BehaviorFact, BehaviorSlice, EvidenceClaim } from "./contracts.ts";
import { evaluateExecutableFact } from "./executable-evidence-gate.ts";
import { CausalScenarioError } from "./causal-scenario-errors.ts";

export interface BehaviorFactRef {
  sliceRef: string;
  factId: string;
}

export interface CausalScenarioCaseDraft {
  id: string;
  label: string;
  conditionFactRefs: BehaviorFactRef[];
  observationFactRefs: BehaviorFactRef[];
}

export interface CausalScenarioDraft {
  id: string;
  subject: string;
  learningGoal: string;
  cases: CausalScenarioCaseDraft[];
}

export interface ScenarioInputProjection {
  sliceRef: string;
  behaviorSlice: BehaviorSlice;
  evidenceClaims: EvidenceClaim[];
}

export interface ValidatedScenarioStatement {
  factRef: BehaviorFactRef;
  text: string;
  evidenceClaimIds: string[];
}

export interface ValidatedCausalScenarioCase {
  id: string;
  label: string;
  conditions: ValidatedScenarioStatement[];
  observations: ValidatedScenarioStatement[];
  evidenceClaimIds: string[];
}

export interface ValidatedCausalScenarioSet {
  schemaVersion: "causal-scenario-v1";
  id: string;
  subject: string;
  learningGoal: string;
  cases: ValidatedCausalScenarioCase[];
}

function allFacts(slice: BehaviorSlice): BehaviorFact[] {
  return [
    ...slice.participants,
    ...slice.states,
    ...slice.events,
    ...slice.flows,
    ...slice.constraints,
    ...slice.effects,
    ...slice.failures,
  ];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function dedupeRefs(refs: readonly BehaviorFactRef[]): BehaviorFactRef[] {
  const seen = new Set<string>();
  const result: BehaviorFactRef[] = [];
  for (const ref of refs) {
    const key = `${ref.sliceRef}\u0000${ref.factId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ref);
  }
  return result;
}

function resolveStatement(
  ref: BehaviorFactRef,
  projections: readonly ScenarioInputProjection[],
): ValidatedScenarioStatement {
  const projection = projections.find((candidate) => candidate.sliceRef === ref.sliceRef);
  if (!projection) {
    throw new CausalScenarioError(
      "SCENARIO_SLICE_NOT_FOUND",
      `Scenario slice '${ref.sliceRef}' was not found.`,
    );
  }

  const matches = allFacts(projection.behaviorSlice).filter((fact) => fact.id === ref.factId);
  if (matches.length === 0) {
    throw new CausalScenarioError(
      "SCENARIO_FACT_NOT_FOUND",
      `Scenario fact '${ref.factId}' was not found in '${ref.sliceRef}'.`,
    );
  }
  if (matches.length > 1) {
    throw new CausalScenarioError(
      "SCENARIO_FACT_AMBIGUOUS",
      `Scenario fact '${ref.factId}' is ambiguous in '${ref.sliceRef}'.`,
    );
  }

  const fact = matches[0]!;
  const decision = evaluateExecutableFact(fact, projection.evidenceClaims);
  if (!decision.eligible) {
    throw new CausalScenarioError(
      "SCENARIO_FACT_NOT_EXECUTABLE",
      `Scenario fact '${ref.factId}' is not executable: ${decision.reasons.join(",")}.`,
    );
  }

  return {
    factRef: { ...ref },
    text: fact.text,
    evidenceClaimIds: [...fact.requiredEvidenceClaimIds],
  };
}

export function validateCausalScenarioDraft(
  draft: CausalScenarioDraft,
  projections: readonly ScenarioInputProjection[],
): ValidatedCausalScenarioSet {
  if (draft.cases.length === 0) {
    throw new CausalScenarioError("SCENARIO_NO_VALID_CASES", "Scenario draft must contain at least one case.");
  }

  const caseIds = new Set<string>();
  for (const item of draft.cases) {
    if (caseIds.has(item.id)) {
      throw new CausalScenarioError(
        "SCENARIO_DUPLICATE_CASE_ID",
        `Scenario case id '${item.id}' is duplicated.`,
      );
    }
    caseIds.add(item.id);
  }

  const cases = draft.cases.map((item): ValidatedCausalScenarioCase => {
    if (item.conditionFactRefs.length === 0) {
      throw new CausalScenarioError(
        "SCENARIO_CONDITION_REQUIRED",
        `Scenario case '${item.id}' requires at least one condition fact.`,
      );
    }
    if (item.observationFactRefs.length === 0) {
      throw new CausalScenarioError(
        "SCENARIO_OBSERVATION_REQUIRED",
        `Scenario case '${item.id}' requires at least one observation fact.`,
      );
    }

    const conditions = dedupeRefs(item.conditionFactRefs).map((ref) => resolveStatement(ref, projections));
    const observations = dedupeRefs(item.observationFactRefs).map((ref) => resolveStatement(ref, projections));
    const evidenceClaimIds = unique([
      ...conditions.flatMap((statement) => statement.evidenceClaimIds),
      ...observations.flatMap((statement) => statement.evidenceClaimIds),
    ]);

    return {
      id: item.id,
      label: item.label,
      conditions,
      observations,
      evidenceClaimIds,
    };
  });

  return {
    schemaVersion: "causal-scenario-v1",
    id: draft.id,
    subject: draft.subject,
    learningGoal: draft.learningGoal,
    cases,
  };
}
