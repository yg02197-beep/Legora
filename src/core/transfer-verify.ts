import type { ValidatedCausalScenarioSet } from "./causal-scenario.ts";
import {
  buildPredictionChallenge,
  type PredictionChallenge,
} from "./prediction.ts";

export interface TransferVerification {
  mode: "PREDICTION";
  status: "PENDING_USER_RESPONSE";
  sourceCaseId: string;
  transferCaseId: string;
  challenge: PredictionChallenge;
}

export class TransferVerificationError extends Error {
  constructor(
    public readonly code: "TRANSFER_CASE_NOT_EVIDENCED",
    message: string,
  ) {
    super(message);
    this.name = "TransferVerificationError";
  }
}

export function buildTransferVerification(
  scenarioSet: ValidatedCausalScenarioSet,
  sourceCaseId: string,
): TransferVerification {
  if (!scenarioSet.cases.some((item) => item.id === sourceCaseId)) {
    throw new TransferVerificationError(
      "TRANSFER_CASE_NOT_EVIDENCED",
      `Transfer source case '${sourceCaseId}' is not evidenced.`,
    );
  }

  for (const item of scenarioSet.cases) {
    if (item.id === sourceCaseId) continue;
    const challenge = buildPredictionChallenge(scenarioSet, item.id);
    if (!challenge) continue;
    return {
      mode: "PREDICTION",
      status: "PENDING_USER_RESPONSE",
      sourceCaseId,
      transferCaseId: item.id,
      challenge,
    };
  }

  throw new TransferVerificationError(
    "TRANSFER_CASE_NOT_EVIDENCED",
    `No distinct evidenced transfer case is available for '${sourceCaseId}'.`,
  );
}
