import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CartographerProjectionResult } from "../../../src/core/contracts.ts";
import {
  validateCausalScenarioDraft,
  type CausalScenarioDraft,
  type ScenarioInputProjection,
} from "../../../src/core/causal-scenario.ts";
import { buildCausalUnderstandingPlan } from "../../../src/core/causal-understanding-flow.ts";
import { runMicroworldCase } from "../../../src/core/microworld.ts";
import { evaluatePrediction } from "../../../src/core/prediction.ts";
import * as cartographerAdapter from "../../../src/providers/cartographer/adapter.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, "../../..");
const modelPath = path.join(repositoryRoot, ".cartographer", "model.json");

type ProjectCartographerSlice = (input: {
  repositoryRoot: string;
  sliceId: string;
}) => Promise<CartographerProjectionResult>;

function adapterFacade(): ProjectCartographerSlice {
  const functions = Object.values(cartographerAdapter).filter(
    (value): value is ProjectCartographerSlice => typeof value === "function",
  );
  assert.equal(functions.length, 1, "Cartographer adapter must expose one runtime facade function");
  return functions[0]!;
}

test("actual Cartographer model supports the full production causal learning path", async () => {
  await fs.access(modelPath);
  const projectSlice = adapterFacade();

  const lockOn = await projectSlice({
    repositoryRoot,
    sliceId: "slice:Lock enabled refresh deduplication",
  });
  const lockOff = await projectSlice({
    repositoryRoot,
    sliceId: "slice:Lock disabled concurrent refresh",
  });

  const onCondition = lockOn.behaviorSlice.flows.find(
    (fact) => fact.text === "Concurrent handlers run with lockEnabled true",
  );
  const onObservation = lockOn.behaviorSlice.flows.find(
    (fact) => fact.text === "Requests share one in-flight refresh promise",
  );
  const offCondition = lockOff.behaviorSlice.flows.find(
    (fact) => fact.text === "Concurrent handlers run with lockEnabled false",
  );
  const offObservation = lockOff.behaviorSlice.flows.find(
    (fact) => fact.text === "Each request invokes refreshToken directly",
  );

  assert.ok(onCondition);
  assert.ok(onObservation);
  assert.ok(offCondition);
  assert.ok(offObservation);

  const projections: ScenarioInputProjection[] = [
    {
      sliceRef: lockOn.provider.sliceId,
      behaviorSlice: lockOn.behaviorSlice,
      evidenceClaims: lockOn.evidenceClaims,
    },
    {
      sliceRef: lockOff.provider.sliceId,
      behaviorSlice: lockOff.behaviorSlice,
      evidenceClaims: lockOff.evidenceClaims,
    },
  ];

  const draft: CausalScenarioDraft = {
    id: "refresh-lock-causality",
    subject: "Refresh lock concurrency behavior",
    learningGoal: "Predict how refresh locking changes concurrent expired-request behavior.",
    cases: [
      {
        id: "lock-on",
        label: "Refresh lock enabled",
        conditionFactRefs: [{ sliceRef: lockOn.provider.sliceId, factId: onCondition.id }],
        observationFactRefs: [{ sliceRef: lockOn.provider.sliceId, factId: onObservation.id }],
      },
      {
        id: "lock-off",
        label: "Refresh lock disabled",
        conditionFactRefs: [{ sliceRef: lockOff.provider.sliceId, factId: offCondition.id }],
        observationFactRefs: [{ sliceRef: lockOff.provider.sliceId, factId: offObservation.id }],
      },
    ],
  };

  const validated = validateCausalScenarioDraft(draft, projections);
  const plan = buildCausalUnderstandingPlan(validated, "lock-on");

  assert.deepEqual(plan.interventions, ["PREDICTION", "MICROWORLD", "TRANSFER_VERIFY"]);
  assert.ok(plan.predictionChallenge);
  assert.ok(plan.microworld);
  assert.ok(plan.transferVerification);

  const prompt = plan.predictionChallenge.prompt;
  assert.equal("expectedChoiceId" in prompt, false);
  assert.ok(prompt.question.includes("lockEnabled true"));

  const observed = runMicroworldCase(plan.microworld, "lock-on");
  assert.deepEqual(observed.observations.map((item) => item.text), [
    "Requests share one in-flight refresh promise",
  ]);

  const initialGrade = evaluatePrediction(
    plan.predictionChallenge,
    plan.predictionChallenge.expectedChoiceId,
  );
  assert.equal(initialGrade.result, "CORRECT");

  assert.equal(plan.transferVerification.transferCaseId, "lock-off");
  const transferGrade = evaluatePrediction(
    plan.transferVerification.challenge,
    plan.transferVerification.challenge.expectedChoiceId,
  );
  assert.equal(transferGrade.result, "CORRECT");
  assert.equal("mastery" in transferGrade, false);
});
