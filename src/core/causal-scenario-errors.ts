export type CausalScenarioErrorCode =
  | "SCENARIO_SLICE_NOT_FOUND"
  | "SCENARIO_FACT_NOT_FOUND"
  | "SCENARIO_FACT_AMBIGUOUS"
  | "SCENARIO_FACT_NOT_EXECUTABLE"
  | "SCENARIO_CONDITION_REQUIRED"
  | "SCENARIO_OBSERVATION_REQUIRED"
  | "SCENARIO_DUPLICATE_CASE_ID"
  | "SCENARIO_NO_VALID_CASES";

export class CausalScenarioError extends Error {
  constructor(public readonly code: CausalScenarioErrorCode, message: string) {
    super(message);
    this.name = "CausalScenarioError";
  }
}
