import test from "node:test";
import assert from "node:assert/strict";
import { createCausalFixture } from "../../helpers/causal-fixtures.ts";
import { validateCausalScenarioDraft } from "../../../src/core/causal-scenario.ts";
import {
  buildPredictionChallenge,
  evaluatePrediction,
  PredictionError,
} from "../../../src/core/prediction.ts";

function validated() {
  const { projections, draft } = createCausalFixture();
  return validateCausalScenarioDraft(draft, projections);
}

test("prompt contains conditions but does not reveal target observations or answer key", () => {
  const challenge = buildPredictionChallenge(validated(), "lock-on")!;
  assert.match(challenge.prompt.question, /lockEnabled true/);
  assert.ok(!challenge.prompt.question.includes("Requests share one in-flight refresh promise"));
  assert.equal("expectedChoiceId" in challenge.prompt, false);
  assert.ok(challenge.expectedChoiceId.length > 0);
});

test("expected choice label comes from the target evidenced observation", () => {
  const challenge = buildPredictionChallenge(validated(), "lock-on")!;
  const expected = challenge.prompt.choices.find((choice) => choice.id === challenge.expectedChoiceId);
  assert.equal(expected?.label, "Requests share one in-flight refresh promise");
});

test("distractor labels come only from other validated case observations", () => {
  const challenge = buildPredictionChallenge(validated(), "lock-on")!;
  assert.deepEqual(
    new Set(challenge.prompt.choices.map((choice) => choice.label)),
    new Set([
      "Requests share one in-flight refresh promise",
      "Each request invokes refreshToken directly",
    ]),
  );
});

test("user-facing prompt has no expectedChoiceId property", () => {
  const challenge = buildPredictionChallenge(validated(), "lock-on")!;
  assert.equal(Object.prototype.hasOwnProperty.call(challenge.prompt, "expectedChoiceId"), false);
});

test("correct and incorrect answers are graded by choice id", () => {
  const challenge = buildPredictionChallenge(validated(), "lock-on")!;
  assert.equal(evaluatePrediction(challenge, challenge.expectedChoiceId).result, "CORRECT");
  const wrong = challenge.prompt.choices.find((choice) => choice.id !== challenge.expectedChoiceId)!;
  assert.equal(evaluatePrediction(challenge, wrong.id).result, "INCORRECT");
});

test("unknown choice id fails PREDICTION_CHOICE_NOT_FOUND", () => {
  const challenge = buildPredictionChallenge(validated(), "lock-on")!;
  assert.throws(
    () => evaluatePrediction(challenge, "choice:missing"),
    (error: unknown) => error instanceof PredictionError && error.code === "PREDICTION_CHOICE_NOT_FOUND",
  );
});

test("unknown target case fails PREDICTION_CASE_NOT_FOUND", () => {
  assert.throws(
    () => buildPredictionChallenge(validated(), "missing"),
    (error: unknown) => error instanceof PredictionError && error.code === "PREDICTION_CASE_NOT_FOUND",
  );
});

test("one distinct evidenced observation returns null instead of fabricating a distractor", () => {
  const scenario = validated();
  scenario.cases[1]!.observations = scenario.cases[0]!.observations.map((item) => ({
    ...item,
    factRef: { ...item.factRef },
    evidenceClaimIds: [...item.evidenceClaimIds],
  }));
  assert.equal(buildPredictionChallenge(scenario, "lock-on"), null);
});
