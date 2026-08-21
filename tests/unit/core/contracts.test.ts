import test from "node:test";
import assert from "node:assert/strict";
import type {
  BehaviorFact,
  BehaviorSlice,
  CartographerProjectionResult,
  EvidenceClaim,
} from "../../../src/core/contracts.ts";

function identity<T>(value: T): T { return value; }

test("BehaviorFact keeps provider and evidence traceability", () => {
  const fact = identity<BehaviorFact>({
    id: "fact:flows:test",
    text: "Requests share one in-flight refresh",
    providerRefs: ["slice:lock-on", "transition:shared-refresh"],
    requiredEvidenceClaimIds: ["transition:shared-refresh#ev:1"],
  });
  assert.equal(fact.id, "fact:flows:test");
  assert.deepEqual(fact.providerRefs, ["slice:lock-on", "transition:shared-refresh"]);
  assert.deepEqual(fact.requiredEvidenceClaimIds, ["transition:shared-refresh#ev:1"]);
});

test("BehaviorSlice is Legora-owned and fact-addressable", () => {
  const fact: BehaviorFact = {
    id: "fact:participants:test",
    text: "expired request",
    providerRefs: ["actor:expired request"],
    requiredEvidenceClaimIds: ["actor:expired request#ev:1"],
  };
  const slice = identity<BehaviorSlice>({
    owner: "LEGORA",
    subject: "Lock enabled refresh deduplication",
    participants: [fact], states: [], events: [], flows: [],
    constraints: [], effects: [], failures: [],
  });
  assert.equal(slice.owner, "LEGORA");
  assert.equal(slice.participants[0]?.text, "expired request");
});

test("projection result exposes normalized evidence and diagnostics", () => {
  const claim = identity<EvidenceClaim>({
    id: "actor:expired request#ev:1",
    claim: "Expired requests enter the refresh path",
    confidence: "CONFIRMED",
    sourceConfidence: "proven",
    evidence: [{ filePath: "fixture/refresh.mjs", lineStart: 1 }],
    providerObjectId: "actor:expired request",
    provenance: "deterministic",
  });
  const result = identity<CartographerProjectionResult>({
    provider: {
      kind: "CARTOGRAPHER",
      projectRoot: "D:/Projects/Legora",
      modelId: "model:legora",
      sliceId: "slice:lock-on",
      decoderContract: "cartographer-decoder-v1",
    },
    behaviorSlice: {
      owner: "LEGORA", subject: "Lock enabled refresh deduplication",
      participants: [], states: [], events: [], flows: [],
      constraints: [], effects: [], failures: [],
    },
    evidenceClaims: [claim],
    diagnostics: { warnings: [], ignoredKinds: [], ignoredRelations: [] },
  });
  assert.equal(result.evidenceClaims[0]?.confidence, "CONFIRMED");
});
