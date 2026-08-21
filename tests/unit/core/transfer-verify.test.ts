import test from "node:test";
import assert from "node:assert/strict";
import { createCausalFixture } from "../../helpers/causal-fixtures.ts";
import { validateCausalScenarioDraft } from "../../../src/core/causal-scenario.ts";
import { evaluatePrediction } from "../../../src/core/prediction.ts";
import {
  buildTransferVerification,
  TransferVerificationError,
} from "../../../src/core/transfer-verify.ts";

function validated() {
  const { projections, draft } = createCausalFixture();
  return validateCausalScenarioDraft(draft, projections);
}

test("transfer chooses a different evidenced case in scenario order", () => {
  const transfer = buildTransferVerification(validated(), "lock-on");
  assert.equal(transfer.sourceCaseId, "lock-on");
  assert.equal(transfer.transferCaseId, "lock-off");
});

test("transfer begins PENDING_USER_RESPONSE", () => {
  const transfer = buildTransferVerification(validated(), "lock-on");
  assert.equal(transfer.status, "PENDING_USER_RESPONSE");
  assert.equal(transfer.mode, "PREDICTION");
});

test("transfer challenge is grounded in the transfer case conditions and observations", () => {
  const transfer = buildTransferVerification(validated(), "lock-on");
  assert.equal(transfer.challenge.prompt.caseId, "lock-off");
  assert.match(transfer.challenge.prompt.question, /lockEnabled false/);
  const expected = transfer.challenge.prompt.choices.find(
    (choice) => choice.id === transfer.challenge.expectedChoiceId,
  );
  assert.equal(expected?.label, "Each request invokes refreshToken directly");
});

test("single-case scenario fails TRANSFER_CASE_NOT_EVIDENCED", () => {
  const scenario = validated();
  scenario.cases = [scenario.cases[0]!];
  assert.throws(
    () => buildTransferVerification(scenario, "lock-on"),
    (error: unknown) => error instanceof TransferVerificationError && error.code === "TRANSFER_CASE_NOT_EVIDENCED",
  );
});

test("second case without a distinct grounded choice also fails TRANSFER_CASE_NOT_EVIDENCED", () => {
  const scenario = validated();
  scenario.cases[1]!.observations = scenario.cases[0]!.observations.map((item) => ({
    ...item,
    factRef: { ...item.factRef },
    evidenceClaimIds: [...item.evidenceClaimIds],
  }));
  assert.throws(
    () => buildTransferVerification(scenario, "lock-on"),
    (error: unknown) => error instanceof TransferVerificationError && error.code === "TRANSFER_CASE_NOT_EVIDENCED",
  );
});

test("prediction evaluation of transfer answer returns only correctness, never mastery", () => {
  const transfer = buildTransferVerification(validated(), "lock-on");
  const graded = evaluatePrediction(transfer.challenge, transfer.challenge.expectedChoiceId);
  assert.equal(graded.result, "CORRECT");
  assert.equal("mastery" in graded, false);
});
