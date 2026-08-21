import test from "node:test";
import assert from "node:assert/strict";
import { createCausalFixture } from "../../helpers/causal-fixtures.ts";
import { validateCausalScenarioDraft } from "../../../src/core/causal-scenario.ts";
import {
  buildMicroworldProjection,
  runMicroworldCase,
  MicroworldError,
} from "../../../src/core/microworld.ts";

function projection() {
  const { projections, draft } = createCausalFixture();
  return buildMicroworldProjection(validateCausalScenarioDraft(draft, projections));
}

test("validated scenario cases become the only supported Microworld cases", () => {
  const result = projection();
  assert.deepEqual(result.supportedCases.map((item) => item.caseId), ["lock-on", "lock-off"]);
  assert.deepEqual(Object.keys(result).sort(), [
    "fidelity",
    "learningGoal",
    "projectionVersion",
    "scenarioSetId",
    "subject",
    "supportedCases",
  ]);
});

test("running a known case reveals only that case observations and evidence", () => {
  const result = runMicroworldCase(projection(), "lock-on");
  assert.equal(result.caseId, "lock-on");
  assert.deepEqual(result.observations.map((item) => item.text), [
    "Requests share one in-flight refresh promise",
  ]);
  assert.ok(!result.observations.some((item) => /directly/.test(item.text)));
  assert.ok(result.evidenceClaimIds.length >= 2);
});

test("unknown case id fails MICROWORLD_CASE_NOT_EVIDENCED", () => {
  assert.throws(
    () => runMicroworldCase(projection(), "unknown"),
    (error: unknown) => error instanceof MicroworldError && error.code === "MICROWORLD_CASE_NOT_EVIDENCED",
  );
});

test("projection exposes no arbitrary input-control execution surface", () => {
  const result = projection() as unknown as Record<string, unknown>;
  assert.equal("controls" in result, false);
  assert.equal("input" in result, false);
  assert.equal("run" in result, false);
});
