import type { BehaviorFact, EvidenceClaim } from "./contracts.ts";

export type ExecutableFactReason =
  | "NO_REQUIRED_EVIDENCE"
  | "EVIDENCE_CLAIM_MISSING"
  | "EVIDENCE_NOT_CONFIRMED"
  | "VALID_SOURCE_ANCHOR_MISSING";

export interface ExecutableFactDecision {
  eligible: boolean;
  reasons: ExecutableFactReason[];
}

function hasValidSourceAnchor(claim: EvidenceClaim): boolean {
  return claim.evidence.some((anchor) =>
    typeof anchor.filePath === "string"
    && anchor.filePath.length > 0
    && Number.isInteger(anchor.lineStart)
    && anchor.lineStart > 0
  );
}

export function evaluateExecutableFact(
  fact: BehaviorFact,
  evidenceClaims: readonly EvidenceClaim[],
): ExecutableFactDecision {
  const reasons: ExecutableFactReason[] = [];
  const addReason = (reason: ExecutableFactReason) => {
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  if (fact.requiredEvidenceClaimIds.length === 0) {
    addReason("NO_REQUIRED_EVIDENCE");
  }

  const claimsById = new Map(evidenceClaims.map((claim) => [claim.id, claim]));
  for (const id of fact.requiredEvidenceClaimIds) {
    const claim = claimsById.get(id);
    if (!claim) {
      addReason("EVIDENCE_CLAIM_MISSING");
      continue;
    }
    if (claim.confidence !== "CONFIRMED") {
      addReason("EVIDENCE_NOT_CONFIRMED");
    }
    if (!hasValidSourceAnchor(claim)) {
      addReason("VALID_SOURCE_ANCHOR_MISSING");
    }
  }

  return { eligible: reasons.length === 0, reasons };
}
