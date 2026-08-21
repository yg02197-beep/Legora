import type { BehaviorFact, BehaviorSlice, EvidenceClaim } from "../../src/core/contracts.ts";
import { createBehaviorFactId } from "../../src/core/fact-id.ts";
import type {
  BehaviorFactRef,
  CausalScenarioDraft,
  ScenarioInputProjection,
} from "../../src/core/causal-scenario.ts";

function claim(id: string, providerObjectId: string, lineStart: number): EvidenceClaim {
  return {
    id,
    claim: id,
    confidence: "CONFIRMED",
    sourceConfidence: "proven",
    evidence: [{ filePath: "fixture/refresh.ts", lineStart }],
    providerObjectId,
    provenance: "deterministic",
  };
}

function flowFact(text: string, providerRef: string, claimId: string): BehaviorFact {
  return {
    id: createBehaviorFactId("flows", [providerRef]),
    text,
    providerRefs: [providerRef],
    requiredEvidenceClaimIds: [claimId],
  };
}

function slice(subject: string, flows: BehaviorFact[]): BehaviorSlice {
  return {
    owner: "LEGORA",
    subject,
    participants: [],
    states: [],
    events: [],
    flows,
    constraints: [],
    effects: [],
    failures: [],
  };
}

export function createCausalFixture(): {
  projections: ScenarioInputProjection[];
  draft: CausalScenarioDraft;
  refs: {
    lockOnCondition: BehaviorFactRef;
    lockOnObservation: BehaviorFactRef;
    lockOffCondition: BehaviorFactRef;
    lockOffObservation: BehaviorFactRef;
  };
} {
  const lockOnCondition = flowFact(
    "Concurrent handlers run with lockEnabled true",
    "lock-on:condition",
    "lock-on-condition#ev:1",
  );
  const lockOnObservation = flowFact(
    "Requests share one in-flight refresh promise",
    "lock-on:observation",
    "lock-on-observation#ev:1",
  );
  const lockOffCondition = flowFact(
    "Concurrent handlers run with lockEnabled false",
    "lock-off:condition",
    "lock-off-condition#ev:1",
  );
  const lockOffObservation = flowFact(
    "Each request invokes refreshToken directly",
    "lock-off:observation",
    "lock-off-observation#ev:1",
  );

  const projections: ScenarioInputProjection[] = [
    {
      sliceRef: "lock-on",
      behaviorSlice: slice("Lock enabled", [lockOnCondition, lockOnObservation]),
      evidenceClaims: [
        claim("lock-on-condition#ev:1", "lock-on:condition", 10),
        claim("lock-on-observation#ev:1", "lock-on:observation", 20),
      ],
    },
    {
      sliceRef: "lock-off",
      behaviorSlice: slice("Lock disabled", [lockOffCondition, lockOffObservation]),
      evidenceClaims: [
        claim("lock-off-condition#ev:1", "lock-off:condition", 30),
        claim("lock-off-observation#ev:1", "lock-off:observation", 40),
      ],
    },
  ];

  const refs = {
    lockOnCondition: { sliceRef: "lock-on", factId: lockOnCondition.id },
    lockOnObservation: { sliceRef: "lock-on", factId: lockOnObservation.id },
    lockOffCondition: { sliceRef: "lock-off", factId: lockOffCondition.id },
    lockOffObservation: { sliceRef: "lock-off", factId: lockOffObservation.id },
  };

  return {
    projections,
    refs,
    draft: {
      id: "refresh-lock-causality",
      subject: "Refresh lock behavior",
      learningGoal: "Predict how locking changes concurrent refresh behavior.",
      cases: [
        {
          id: "lock-on",
          label: "Lock enabled",
          conditionFactRefs: [refs.lockOnCondition],
          observationFactRefs: [refs.lockOnObservation],
        },
        {
          id: "lock-off",
          label: "Lock disabled",
          conditionFactRefs: [refs.lockOffCondition],
          observationFactRefs: [refs.lockOffObservation],
        },
      ],
    },
  };
}
