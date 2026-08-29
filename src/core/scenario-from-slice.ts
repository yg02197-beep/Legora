import type { BehaviorFact, EvidenceClaim } from "./contracts.ts";
import type {
  CausalScenarioCaseDraft,
  CausalScenarioDraft,
  ScenarioInputProjection,
} from "./causal-scenario.ts";
import { evaluateExecutableFact } from "./executable-evidence-gate.ts";
import type { KnowledgeProjectionResult } from "../repository-knowledge/projector.ts";

export interface ScenarioDraftFromSliceResult {
  draft: CausalScenarioDraft;
  projections: ScenarioInputProjection[];
}

function executableFacts(
  facts: readonly BehaviorFact[],
  evidenceClaims: readonly EvidenceClaim[],
): BehaviorFact[] {
  return facts.filter((fact) => evaluateExecutableFact(fact, evidenceClaims).eligible);
}

export function buildScenarioDraftFromSlice(
  projection: KnowledgeProjectionResult,
): ScenarioDraftFromSliceResult | null {
  const { behaviorSlice, evidenceClaims } = projection;
  const sliceRef = "native";

  const executableConstraints = executableFacts(behaviorSlice.constraints, evidenceClaims);
  const executableFlows = executableFacts(behaviorSlice.flows, evidenceClaims);
  const executableEffects = executableFacts(behaviorSlice.effects, evidenceClaims);
  const executableFailures = executableFacts(behaviorSlice.failures, evidenceClaims);

  const observations = [...executableFlows, ...executableEffects];
  const cases: CausalScenarioCaseDraft[] = [];

  if (executableConstraints.length >= 2 && observations.length >= 2) {
    for (let i = 0; i < executableConstraints.length && cases.length < observations.length; i++) {
      const constraint = executableConstraints[i]!;
      const observation = observations[i % observations.length]!;
      cases.push({
        id: `case-${i}`,
        label: constraint.text,
        conditionFactRefs: [{ sliceRef, factId: constraint.id }],
        observationFactRefs: [{ sliceRef, factId: observation.id }],
      });
    }
  } else if (executableConstraints.length >= 2 && observations.length === 1 && executableFailures.length >= 1) {
    const constraint0 = executableConstraints[0]!;
    const constraint1 = executableConstraints[1]!;
    const observation = observations[0]!;
    const failure = executableFailures[0]!;
    cases.push({
      id: "case-0",
      label: constraint0.text,
      conditionFactRefs: [{ sliceRef, factId: constraint0.id }],
      observationFactRefs: [{ sliceRef, factId: observation.id }],
    });
    cases.push({
      id: "case-1",
      label: constraint1.text,
      conditionFactRefs: [{ sliceRef, factId: constraint1.id }],
      observationFactRefs: [{ sliceRef, factId: failure.id }],
    });
  } else if (executableConstraints.length === 1 && executableFailures.length >= 1 && observations.length >= 1) {
    const constraint = executableConstraints[0]!;
    const observation = observations[0]!;
    const failure = executableFailures[0]!;
    cases.push({
      id: "case-0",
      label: `${constraint.text} (normal)`,
      conditionFactRefs: [{ sliceRef, factId: constraint.id }],
      observationFactRefs: [{ sliceRef, factId: observation.id }],
    });
    cases.push({
      id: "case-1",
      label: `${constraint.text} (failure)`,
      conditionFactRefs: [{ sliceRef, factId: constraint.id }],
      observationFactRefs: [{ sliceRef, factId: failure.id }],
    });
  } else if (executableConstraints.length === 0 && observations.length >= 1 && executableFailures.length >= 1) {
    const failure = executableFailures[0]!;
    const conditionFact = executableFlows[0] ?? executableEffects[0];
    if (!conditionFact) return null;
    // Pick an observation that is different from the condition fact to avoid tautological questions
    const normalObservation = observations.find((o) => o.id !== conditionFact.id) ?? failure;
    cases.push({
      id: "case-0",
      label: "Normal path",
      conditionFactRefs: [{ sliceRef, factId: conditionFact.id }],
      observationFactRefs: [{ sliceRef, factId: normalObservation.id }],
    });
    cases.push({
      id: "case-1",
      label: "Failure path",
      conditionFactRefs: [{ sliceRef, factId: conditionFact.id }],
      observationFactRefs: [{ sliceRef, factId: failure.id }],
    });
  }

  if (cases.length < 2) return null;

  const observationTexts = new Set(cases.map((c) => {
    const factId = c.observationFactRefs[0]!.factId;
    const allFacts = [
      ...behaviorSlice.flows,
      ...behaviorSlice.effects,
      ...behaviorSlice.failures,
    ];
    return allFacts.find((f) => f.id === factId)?.text ?? "";
  }));
  if (observationTexts.size < 2) return null;

  const draft: CausalScenarioDraft = {
    id: `scenario:${projection.source.flowRecordId}`,
    subject: behaviorSlice.subject,
    learningGoal: `Predict behavior outcomes for: ${behaviorSlice.subject}`,
    cases,
  };

  const projections: ScenarioInputProjection[] = [{
    sliceRef,
    behaviorSlice,
    evidenceClaims: [...evidenceClaims],
  }];

  return { draft, projections };
}
