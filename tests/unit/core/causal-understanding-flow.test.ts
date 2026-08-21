import test from "node:test";
import assert from "node:assert/strict";
import { createCausalFixture } from "../../helpers/causal-fixtures.ts";
import { validateCausalScenarioDraft } from "../../../src/core/causal-scenario.ts";
import {
  buildCausalUnderstandingPlan,
  CausalUnderstandingFlowError,
} from "../../../src/core/causal-understanding-flow.ts";

function validated() {
  const { projections, draft } = createCausalFixture();
  return validateCausalScenarioDraft(draft, projections);
}

test("no validated scenario set falls back to EXPLAIN only", () => {
  const plan = buildCausalUnderstandingPlan(null, null);
  assert.deepEqual(plan.interventions, ["EXPLAIN"]);
  assert.equal(plan.predictionChallenge, null);
  assert.equal(plan.microworld, null);
  assert.equal(plan.transferVerification, null);
});

test("one evidenced case enables finite Microworld without fabricated graded prediction or transfer", () => {
  const scenario = validated();
  scenario.cases = [scenario.cases[0]!];
  const plan = buildCausalUnderstandingPlan(scenario, "lock-on");
  assert.deepEqual(plan.interventions, ["MICROWORLD"]);
  assert.equal(plan.predictionChallenge, null);
  assert.ok(plan.microworld);
  assert.equal(plan.transferVerification, null);
});

test("two distinct evidenced cases prefer PREDICTION then MICROWORLD then TRANSFER_VERIFY", () => {
  const plan = buildCausalUnderstandingPlan(validated(), "lock-on");
  assert.deepEqual(plan.interventions, ["PREDICTION", "MICROWORLD", "TRANSFER_VERIFY"]);
  assert.ok(plan.predictionChallenge);
  assert.ok(plan.microworld);
  assert.ok(plan.transferVerification);
});

test("plan creation does not execute or reveal Microworld observations", () => {
  const plan = buildCausalUnderstandingPlan(validated(), "lock-on");
  assert.ok(plan.predictionChallenge);
  assert.ok(!plan.predictionChallenge.prompt.question.includes("Requests share one in-flight refresh promise"));
  assert.equal("expectedChoiceId" in plan.predictionChallenge.prompt, false);
  assert.equal("runResult" in (plan as unknown as Record<string, unknown>), false);
  assert.equal("observations" in (plan as unknown as Record<string, unknown>), false);
});

test("explicit unknown source case fails CAUSAL_SOURCE_CASE_NOT_FOUND", () => {
  assert.throws(
    () => buildCausalUnderstandingPlan(validated(), "missing"),
    (error: unknown) => error instanceof CausalUnderstandingFlowError && error.code === "CAUSAL_SOURCE_CASE_NOT_FOUND",
  );
});
