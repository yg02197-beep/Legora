import test from "node:test";
import assert from "node:assert/strict";
import { createCausalFixture } from "../../helpers/causal-fixtures.ts";
import {
  validateCausalScenarioDraft,
  type CausalScenarioDraft,
} from "../../../src/core/causal-scenario.ts";
import { CausalScenarioError } from "../../../src/core/causal-scenario-errors.ts";

function assertCode(fn: () => unknown, code: string): void {
  assert.throws(
    fn,
    (error: unknown) => error instanceof CausalScenarioError && error.code === code,
  );
}

test("valid referenced executable facts produce a finite validated scenario set", () => {
  const { projections, draft } = createCausalFixture();
  const validated = validateCausalScenarioDraft(draft, projections);
  assert.equal(validated.schemaVersion, "causal-scenario-v1");
  assert.equal(validated.cases.length, 2);
  assert.deepEqual(validated.cases[0]!.conditions.map((item) => item.text), [
    "Concurrent handlers run with lockEnabled true",
  ]);
  assert.deepEqual(validated.cases[0]!.observations.map((item) => item.text), [
    "Requests share one in-flight refresh promise",
  ]);
  assert.ok(validated.cases[0]!.evidenceClaimIds.length >= 2);
});

test("validated statement text is copied from BehaviorFact, not draft prose", () => {
  const { projections, draft } = createCausalFixture();
  draft.cases[0]!.label = "Invented presentation wording";
  const validated = validateCausalScenarioDraft(draft, projections);
  assert.equal(validated.cases[0]!.label, "Invented presentation wording");
  assert.equal(validated.cases[0]!.observations[0]!.text, "Requests share one in-flight refresh promise");
});

test("missing slice fails SCENARIO_SLICE_NOT_FOUND", () => {
  const { projections, draft } = createCausalFixture();
  draft.cases[0]!.conditionFactRefs[0]!.sliceRef = "missing";
  assertCode(() => validateCausalScenarioDraft(draft, projections), "SCENARIO_SLICE_NOT_FOUND");
});

test("missing fact fails SCENARIO_FACT_NOT_FOUND", () => {
  const { projections, draft } = createCausalFixture();
  draft.cases[0]!.conditionFactRefs[0]!.factId = "fact:missing";
  assertCode(() => validateCausalScenarioDraft(draft, projections), "SCENARIO_FACT_NOT_FOUND");
});

test("duplicate matching fact id inside one slice fails SCENARIO_FACT_AMBIGUOUS", () => {
  const { projections, draft } = createCausalFixture();
  const original = projections[0]!.behaviorSlice.flows[0]!;
  projections[0]!.behaviorSlice.flows.push({ ...original });
  assertCode(() => validateCausalScenarioDraft(draft, projections), "SCENARIO_FACT_AMBIGUOUS");
});

test("INFERRED referenced fact fails SCENARIO_FACT_NOT_EXECUTABLE", () => {
  const { projections, draft } = createCausalFixture();
  projections[0]!.evidenceClaims[0]!.confidence = "INFERRED";
  assertCode(() => validateCausalScenarioDraft(draft, projections), "SCENARIO_FACT_NOT_EXECUTABLE");
});

test("UNKNOWN referenced fact fails SCENARIO_FACT_NOT_EXECUTABLE", () => {
  const { projections, draft } = createCausalFixture();
  projections[0]!.evidenceClaims[0]!.confidence = "UNKNOWN";
  assertCode(() => validateCausalScenarioDraft(draft, projections), "SCENARIO_FACT_NOT_EXECUTABLE");
});

test("CONFIRMED claim without a valid source anchor fails SCENARIO_FACT_NOT_EXECUTABLE", () => {
  const { projections, draft } = createCausalFixture();
  projections[0]!.evidenceClaims[0]!.evidence = [];
  assertCode(() => validateCausalScenarioDraft(draft, projections), "SCENARIO_FACT_NOT_EXECUTABLE");
});

test("empty conditions fail SCENARIO_CONDITION_REQUIRED", () => {
  const { projections, draft } = createCausalFixture();
  draft.cases[0]!.conditionFactRefs = [];
  assertCode(() => validateCausalScenarioDraft(draft, projections), "SCENARIO_CONDITION_REQUIRED");
});

test("empty observations fail SCENARIO_OBSERVATION_REQUIRED", () => {
  const { projections, draft } = createCausalFixture();
  draft.cases[0]!.observationFactRefs = [];
  assertCode(() => validateCausalScenarioDraft(draft, projections), "SCENARIO_OBSERVATION_REQUIRED");
});

test("duplicate case ids fail SCENARIO_DUPLICATE_CASE_ID", () => {
  const { projections, draft } = createCausalFixture();
  draft.cases[1]!.id = draft.cases[0]!.id;
  assertCode(() => validateCausalScenarioDraft(draft, projections), "SCENARIO_DUPLICATE_CASE_ID");
});

test("empty case list fails SCENARIO_NO_VALID_CASES", () => {
  const { projections, draft } = createCausalFixture();
  const empty: CausalScenarioDraft = { ...draft, cases: [] };
  assertCode(() => validateCausalScenarioDraft(empty, projections), "SCENARIO_NO_VALID_CASES");
});

test("duplicate fact refs inside one case are deterministically deduplicated", () => {
  const { projections, draft, refs } = createCausalFixture();
  draft.cases[0]!.conditionFactRefs.push({ ...refs.lockOnCondition });
  draft.cases[0]!.observationFactRefs.push({ ...refs.lockOnObservation });
  const validated = validateCausalScenarioDraft(draft, projections);
  assert.equal(validated.cases[0]!.conditions.length, 1);
  assert.equal(validated.cases[0]!.observations.length, 1);
});
