import type {
  ValidatedCausalScenarioSet,
  ValidatedScenarioStatement,
} from "./causal-scenario.ts";

export interface MicroworldProjection {
  projectionVersion: "finite-evidenced-microworld-v1";
  scenarioSetId: string;
  subject: string;
  learningGoal: string;
  fidelity: "F2_CAUSAL";
  supportedCases: Array<{
    caseId: string;
    label: string;
    conditions: ValidatedScenarioStatement[];
    observations: ValidatedScenarioStatement[];
    evidenceClaimIds: string[];
  }>;
}

export interface MicroworldRunResult {
  caseId: string;
  observations: ValidatedScenarioStatement[];
  evidenceClaimIds: string[];
}

export class MicroworldError extends Error {
  constructor(
    public readonly code: "MICROWORLD_CASE_NOT_EVIDENCED",
    message: string,
  ) {
    super(message);
    this.name = "MicroworldError";
  }
}

function cloneStatement(statement: ValidatedScenarioStatement): ValidatedScenarioStatement {
  return {
    ...statement,
    factRef: { ...statement.factRef },
    evidenceClaimIds: [...statement.evidenceClaimIds],
  };
}

export function buildMicroworldProjection(
  scenarioSet: ValidatedCausalScenarioSet,
): MicroworldProjection {
  return {
    projectionVersion: "finite-evidenced-microworld-v1",
    scenarioSetId: scenarioSet.id,
    subject: scenarioSet.subject,
    learningGoal: scenarioSet.learningGoal,
    fidelity: "F2_CAUSAL",
    supportedCases: scenarioSet.cases.map((item) => ({
      caseId: item.id,
      label: item.label,
      conditions: item.conditions.map(cloneStatement),
      observations: item.observations.map(cloneStatement),
      evidenceClaimIds: [...item.evidenceClaimIds],
    })),
  };
}

export function runMicroworldCase(
  projection: MicroworldProjection,
  caseId: string,
): MicroworldRunResult {
  const item = projection.supportedCases.find((candidate) => candidate.caseId === caseId);
  if (!item) {
    throw new MicroworldError(
      "MICROWORLD_CASE_NOT_EVIDENCED",
      `Microworld case '${caseId}' is not evidenced by this projection.`,
    );
  }

  return {
    caseId: item.caseId,
    observations: item.observations.map(cloneStatement),
    evidenceClaimIds: [...item.evidenceClaimIds],
  };
}
