import type {
  ValidatedCausalScenarioCase,
  ValidatedCausalScenarioSet,
} from "./causal-scenario.ts";

export interface PredictionChoice {
  id: string;
  label: string;
}

export interface PredictionPrompt {
  id: string;
  scenarioSetId: string;
  caseId: string;
  status: "PENDING_USER_RESPONSE";
  question: string;
  choices: PredictionChoice[];
  evidenceClaimIds: string[];
}

export interface PredictionChallenge {
  prompt: PredictionPrompt;
  expectedChoiceId: string;
}

export interface PredictionResult {
  result: "CORRECT" | "INCORRECT";
  expectedChoiceId: string;
  receivedChoiceId: string;
}

export class PredictionError extends Error {
  constructor(
    public readonly code: "PREDICTION_CASE_NOT_FOUND" | "PREDICTION_CHOICE_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "PredictionError";
  }
}

function observationLabel(item: ValidatedCausalScenarioCase): string {
  return item.observations.map((statement) => statement.text).join(" + ");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function buildPredictionChallenge(
  scenarioSet: ValidatedCausalScenarioSet,
  caseId: string,
): PredictionChallenge | null {
  const target = scenarioSet.cases.find((candidate) => candidate.id === caseId);
  if (!target) {
    throw new PredictionError(
      "PREDICTION_CASE_NOT_FOUND",
      `Prediction case '${caseId}' was not found.`,
    );
  }

  const ordered = [target, ...scenarioSet.cases.filter((candidate) => candidate.id !== target.id)];
  const choices: PredictionChoice[] = [];
  const seenLabels = new Set<string>();
  for (const item of ordered) {
    const label = observationLabel(item);
    if (seenLabels.has(label)) continue;
    seenLabels.add(label);
    choices.push({ id: `choice:${item.id}`, label });
  }

  if (choices.length < 2) return null;

  const expectedChoiceId = `choice:${target.id}`;
  const conditionTexts = target.conditions.map((statement) => statement.text);
  const evidenceClaimIds = unique(target.conditions.flatMap((statement) => statement.evidenceClaimIds));

  return {
    prompt: {
      id: `prediction:${scenarioSet.id}:${target.id}`,
      scenarioSetId: scenarioSet.id,
      caseId: target.id,
      status: "PENDING_USER_RESPONSE",
      question: `Predict the outcome when: ${conditionTexts.join("; ")}`,
      choices,
      evidenceClaimIds,
    },
    expectedChoiceId,
  };
}

export function evaluatePrediction(
  challenge: PredictionChallenge,
  receivedChoiceId: string,
): PredictionResult {
  if (!challenge.prompt.choices.some((choice) => choice.id === receivedChoiceId)) {
    throw new PredictionError(
      "PREDICTION_CHOICE_NOT_FOUND",
      `Prediction choice '${receivedChoiceId}' was not found.`,
    );
  }

  return {
    result: receivedChoiceId === challenge.expectedChoiceId ? "CORRECT" : "INCORRECT",
    expectedChoiceId: challenge.expectedChoiceId,
    receivedChoiceId,
  };
}
