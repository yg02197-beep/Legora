import test from "node:test";
import assert from "node:assert/strict";
import type { BehaviorFact, EvidenceClaim } from "../../../src/core/contracts.ts";
import { evaluateExecutableFact } from "../../../src/core/executable-evidence-gate.ts";
import { createBehaviorFactId } from "../../../src/core/fact-id.ts";

function fact(ids: string[]): BehaviorFact {
  return {
    id: createBehaviorFactId("flows", ["provider:1"]),
    text: "candidate",
    providerRefs: ["provider:1"],
    requiredEvidenceClaimIds: ids,
  };
}

function claim(id: string, confidence: EvidenceClaim["confidence"], anchored = true): EvidenceClaim {
  return {
    id,
    claim: id,
    confidence,
    sourceConfidence: confidence === "CONFIRMED" ? "proven" : "high",
    evidence: anchored ? [{ filePath: "src/a.ts", lineStart: 1 }] : [],
    providerObjectId: "provider:1",
    provenance: "deterministic",
  };
}

test("fully confirmed fact with valid anchors is eligible", () => {
  const decision = evaluateExecutableFact(fact(["a", "b"]), [
    claim("a", "CONFIRMED"),
    claim("b", "CONFIRMED"),
  ]);
  assert.deepEqual(decision, { eligible: true, reasons: [] });
});

test("fact with no required evidence is ineligible", () => {
  const decision = evaluateExecutableFact(fact([]), []);
  assert.equal(decision.eligible, false);
  assert.deepEqual(decision.reasons, ["NO_REQUIRED_EVIDENCE"]);
});

test("INFERRED required claim is ineligible", () => {
  const decision = evaluateExecutableFact(fact(["a"]), [claim("a", "INFERRED")]);
  assert.equal(decision.eligible, false);
  assert.ok(decision.reasons.includes("EVIDENCE_NOT_CONFIRMED"));
});

test("UNKNOWN required claim is ineligible", () => {
  const decision = evaluateExecutableFact(fact(["a"]), [claim("a", "UNKNOWN")]);
  assert.equal(decision.eligible, false);
  assert.ok(decision.reasons.includes("EVIDENCE_NOT_CONFIRMED"));
});

test("mixed claims with one weaker claim are ineligible", () => {
  const decision = evaluateExecutableFact(fact(["a", "b"]), [
    claim("a", "CONFIRMED"),
    claim("b", "INFERRED"),
  ]);
  assert.equal(decision.eligible, false);
  assert.deepEqual(decision.reasons, ["EVIDENCE_NOT_CONFIRMED"]);
});

test("missing required claim id is ineligible", () => {
  const decision = evaluateExecutableFact(fact(["missing"]), []);
  assert.equal(decision.eligible, false);
  assert.deepEqual(decision.reasons, ["EVIDENCE_CLAIM_MISSING"]);
});

test("CONFIRMED claim without valid source anchor is ineligible", () => {
  const decision = evaluateExecutableFact(fact(["a"]), [claim("a", "CONFIRMED", false)]);
  assert.equal(decision.eligible, false);
  assert.deepEqual(decision.reasons, ["VALID_SOURCE_ANCHOR_MISSING"]);
});
