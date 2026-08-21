import type { ValidatedCausalScenarioSet } from "./causal-scenario.ts";
import {
  buildMicroworldProjection,
  type MicroworldProjection,
} from "./microworld.ts";
import {
  buildPredictionChallenge,
  type PredictionChallenge,
} from "./prediction.ts";
import {
  buildTransferVerification,
  TransferVerificationError,
  type TransferVerification,
} from "./transfer-verify.ts";

export type CausalIntervention =
  | "EXPLAIN"
  | "PREDICTION"
  | "MICROWORLD"
  | "TRANSFER_VERIFY";

export interface CausalUnderstandingPlan {
  interventions: CausalIntervention[];
  predictionChallenge: PredictionChallenge | null;
  microworld: MicroworldProjection | null;
  transferVerification: TransferVerification | null;
}

export class CausalUnderstandingFlowError extends Error {
  constructor(
    public readonly code: "CAUSAL_SOURCE_CASE_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "CausalUnderstandingFlowError";
  }
}

export function buildCausalUnderstandingPlan(
  scenarioSet: ValidatedCausalScenarioSet | null,
  sourceCaseId: string | null,
): CausalUnderstandingPlan {
  if (!scenarioSet || scenarioSet.cases.length === 0) {
    return {
      interventions: ["EXPLAIN"],
      predictionChallenge: null,
      microworld: null,
      transferVerification: null,
    };
  }

  const sourceCase = sourceCaseId === null
    ? scenarioSet.cases[0]!
    : scenarioSet.cases.find((item) => item.id === sourceCaseId);

  if (!sourceCase) {
    throw new CausalUnderstandingFlowError(
      "CAUSAL_SOURCE_CASE_NOT_FOUND",
      `Causal source case '${sourceCaseId}' was not found.`,
    );
  }

  const microworld = buildMicroworldProjection(scenarioSet);
  const predictionChallenge = buildPredictionChallenge(scenarioSet, sourceCase.id);

  let transferVerification: TransferVerification | null = null;
  try {
    transferVerification = buildTransferVerification(scenarioSet, sourceCase.id);
  } catch (error) {
    if (!(error instanceof TransferVerificationError) || error.code !== "TRANSFER_CASE_NOT_EVIDENCED") {
      throw error;
    }
  }

  const interventions: CausalIntervention[] = [];
  if (predictionChallenge) interventions.push("PREDICTION");
  interventions.push("MICROWORLD");
  if (transferVerification) interventions.push("TRANSFER_VERIFY");

  return {
    interventions,
    predictionChallenge,
    microworld,
    transferVerification,
  };
}
