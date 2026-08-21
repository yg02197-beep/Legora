import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateCausalScenarioDraft,
  type CausalScenarioDraft,
  type ScenarioInputProjection,
} from "../../../src/core/causal-scenario.ts";
import { buildCausalUnderstandingPlan } from "../../../src/core/causal-understanding-flow.ts";
import { runMicroworldCase } from "../../../src/core/microworld.ts";
import { evaluatePrediction } from "../../../src/core/prediction.ts";
import { decodeCartographerModel } from "../../../src/providers/cartographer/decoder.ts";
import { readCartographerModelDocument } from "../../../src/providers/cartographer/source.ts";
import { importCartographerModelView } from "../../../src/repository-knowledge/cartographer-import.ts";
import { projectKnowledgeBehaviorSlice } from "../../../src/repository-knowledge/projector.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, "../../..");
const modelPath = path.join(repositoryRoot, ".cartographer", "model.json");

function flowId(sliceId: string): string {
  return `cartographer:flow:${sliceId}`;
}

test("actual imported repository knowledge supports the full production causal learning path", async () => {
  await fs.access(modelPath);
  const document = await readCartographerModelDocument(repositoryRoot);
  const model = decodeCartographerModel(document, repositoryRoot);
  const imported = importCartographerModelView(model, "2026-08-22T00:00:00.000Z");

  const lockOn = projectKnowledgeBehaviorSlice(
    imported.records,
    flowId("slice:Lock enabled refresh deduplication"),
  );
  const lockOff = projectKnowledgeBehaviorSlice(
    imported.records,
    flowId("slice:Lock disabled concurrent refresh"),
  );

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

  const onRef = lockOn.source.flowRecordId;
  const offRef = lockOff.source.flowRecordId;
  const projections: ScenarioInputProjection[] = [
    {
      sliceRef: onRef,
      behaviorSlice: lockOn.behaviorSlice,
      evidenceClaims: lockOn.evidenceClaims,
    },
    {
      sliceRef: offRef,
      behaviorSlice: lockOff.behaviorSlice,
      evidenceClaims: lockOff.evidenceClaims,
    },
  ];

  const draft: CausalScenarioDraft = {
    id: "refresh-lock-causality-repository-knowledge",
    subject: "Refresh lock concurrency behavior",
    learningGoal: "Predict how refresh locking changes concurrent expired-request behavior.",
    cases: [
      {
        id: "lock-on",
        label: "Refresh lock enabled",
        conditionFactRefs: [{ sliceRef: onRef, factId: onCondition.id }],
        observationFactRefs: [{ sliceRef: onRef, factId: onObservation.id }],
      },
      {
        id: "lock-off",
        label: "Refresh lock disabled",
        conditionFactRefs: [{ sliceRef: offRef, factId: offCondition.id }],
        observationFactRefs: [{ sliceRef: offRef, factId: offObservation.id }],
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
