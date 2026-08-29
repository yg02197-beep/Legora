import type { EvidenceClaim } from "../core/contracts.ts";
import type { PredictionChallenge, PredictionResult } from "../core/prediction.ts";
import { buildPredictionChallenge, evaluatePrediction } from "../core/prediction.ts";
import { validateCausalScenarioDraft } from "../core/causal-scenario.ts";
import { buildScenarioDraftFromSlice } from "../core/scenario-from-slice.ts";
import { readKnowledgeRecords } from "../repository-knowledge/store.ts";
import { projectKnowledgeBehaviorSlice } from "../repository-knowledge/projector.ts";
import { checkKnowledgeRecordFreshness } from "../repository-knowledge/freshness.ts";

export type VerifyStatus =
  | "CHALLENGE_READY"
  | "CORRECT"
  | "INCORRECT"
  | "NOT_FOUND"
  | "NOT_FLOW"
  | "STALE"
  | "UNKNOWN"
  | "INSUFFICIENT_EVIDENCE"
  | "INVALID_CHOICE";

export interface VerifyResult {
  status: VerifyStatus;
  challenge?: PredictionChallenge;
  predictionResult?: PredictionResult;
  evidenceClaims?: EvidenceClaim[];
  reason?: string;
}

export interface RunLegoraVerifyOptions {
  repositoryRoot: string;
  flowRecordId: string;
  answerId?: string;
}

export async function runLegoraVerify(options: RunLegoraVerifyOptions): Promise<VerifyResult> {
  const { repositoryRoot, flowRecordId, answerId } = options;

  const records = await readKnowledgeRecords(repositoryRoot);
  const record = records.find((r) => r.id === flowRecordId);

  if (!record) {
    return { status: "NOT_FOUND", reason: `Knowledge record '${flowRecordId}' was not found.` };
  }

  if (record.structure?.type !== "BEHAVIOR_FLOW") {
    return { status: "NOT_FLOW", reason: `Knowledge record '${flowRecordId}' is not a behavior flow.` };
  }

  const freshness = await checkKnowledgeRecordFreshness(repositoryRoot, record);
  if (freshness.status === "STALE") {
    const issueMessages = freshness.issues.map((issue) => issue.message);
    return { status: "STALE", reason: issueMessages.join("; ") || "Knowledge is stale." };
  }
  if (freshness.status === "UNKNOWN") {
    const issueMessages = freshness.issues.map((issue) => issue.message);
    return { status: "UNKNOWN", reason: issueMessages.join("; ") || "Knowledge freshness is unknown." };
  }

  const projection = projectKnowledgeBehaviorSlice(records, flowRecordId);
  const scenarioResult = buildScenarioDraftFromSlice(projection);

  if (!scenarioResult) {
    return { status: "INSUFFICIENT_EVIDENCE", reason: "Cannot build a prediction challenge from available evidence." };
  }

  const { draft, projections } = scenarioResult;
  const validated = validateCausalScenarioDraft(draft, projections);
  const firstCaseId = validated.cases[0]!.id;
  const challenge = buildPredictionChallenge(validated, firstCaseId);

  if (!challenge) {
    return { status: "INSUFFICIENT_EVIDENCE", reason: "Cannot build a prediction challenge with distinct choices." };
  }

  if (!answerId) {
    return {
      status: "CHALLENGE_READY",
      challenge,
      evidenceClaims: projection.evidenceClaims,
    };
  }

  const validChoice = challenge.prompt.choices.some((c) => c.id === answerId);
  if (!validChoice) {
    return { status: "INVALID_CHOICE", reason: `Choice '${answerId}' is not a valid option.` };
  }

  const predictionResult = evaluatePrediction(challenge, answerId);
  return {
    status: predictionResult.result === "CORRECT" ? "CORRECT" : "INCORRECT",
    challenge,
    predictionResult,
    evidenceClaims: projection.evidenceClaims,
  };
}
