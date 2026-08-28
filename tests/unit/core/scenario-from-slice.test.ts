import test from "node:test";
import assert from "node:assert/strict";
import type { BehaviorFact, BehaviorSlice, EvidenceClaim } from "../../../src/core/contracts.ts";
import { createBehaviorFactId } from "../../../src/core/fact-id.ts";
import type { KnowledgeProjectionResult } from "../../../src/repository-knowledge/projector.ts";
import { buildScenarioDraftFromSlice } from "../../../src/core/scenario-from-slice.ts";

function confirmedClaim(id: string, filePath: string, lineStart: number): EvidenceClaim {
  return {
    id,
    claim: id,
    confidence: "CONFIRMED",
    sourceConfidence: "proven",
    evidence: [{ filePath, lineStart }],
    providerObjectId: id,
    provenance: "test",
  };
}

function makeFact(category: "constraints" | "flows" | "effects" | "failures", text: string, ref: string, claimId: string): BehaviorFact {
  return {
    id: createBehaviorFactId(category, [ref]),
    text,
    providerRefs: [ref],
    requiredEvidenceClaimIds: [claimId],
  };
}

function makeSlice(overrides: Partial<BehaviorSlice> = {}): BehaviorSlice {
  return {
    owner: "LEGORA",
    subject: "Test flow",
    participants: [],
    states: [],
    events: [],
    flows: [],
    constraints: [],
    effects: [],
    failures: [],
    ...overrides,
  };
}

function makeProjection(slice: BehaviorSlice, claims: EvidenceClaim[]): KnowledgeProjectionResult {
  return {
    source: { kind: "REPOSITORY_KNOWLEDGE", flowRecordId: "native:flow:test" },
    behaviorSlice: slice,
    evidenceClaims: claims,
    diagnostics: { warnings: [], ignoredKinds: [], ignoredRelations: [] },
  };
}

test("slice with 2+ executable constraints and 2+ observations produces a valid draft with 2 cases", () => {
  const c1 = makeFact("constraints", "Lock is enabled", "constraint:1", "claim:c1");
  const c2 = makeFact("constraints", "Lock is disabled", "constraint:2", "claim:c2");
  const f1 = makeFact("flows", "Requests share promise", "flow:1", "claim:f1");
  const f2 = makeFact("flows", "Each request refreshes", "flow:2", "claim:f2");

  const claims = [
    confirmedClaim("claim:c1", "src/a.ts", 1),
    confirmedClaim("claim:c2", "src/a.ts", 10),
    confirmedClaim("claim:f1", "src/b.ts", 5),
    confirmedClaim("claim:f2", "src/b.ts", 15),
  ];

  const slice = makeSlice({ constraints: [c1, c2], flows: [f1, f2] });
  const projection = makeProjection(slice, claims);
  const result = buildScenarioDraftFromSlice(projection);

  assert.notEqual(result, null);
  assert.equal(result!.draft.cases.length, 2);
  assert.equal(result!.draft.cases[0]!.id, "case-0");
  assert.equal(result!.draft.cases[1]!.id, "case-1");
  assert.equal(result!.projections.length, 1);
  assert.equal(result!.projections[0]!.sliceRef, "native");
});

test("slice with 1 constraint + 1 failure produces 2 cases", () => {
  const c1 = makeFact("constraints", "Token validation", "constraint:1", "claim:c1");
  const f1 = makeFact("flows", "Normal execution", "flow:1", "claim:f1");
  const fail1 = makeFact("failures", "Token expired error", "failure:1", "claim:fail1");

  const claims = [
    confirmedClaim("claim:c1", "src/a.ts", 1),
    confirmedClaim("claim:f1", "src/b.ts", 5),
    confirmedClaim("claim:fail1", "src/c.ts", 10),
  ];

  const slice = makeSlice({ constraints: [c1], flows: [f1], failures: [fail1] });
  const projection = makeProjection(slice, claims);
  const result = buildScenarioDraftFromSlice(projection);

  assert.notEqual(result, null);
  assert.equal(result!.draft.cases.length, 2);
});

test("slice with no executable facts returns null", () => {
  const slice = makeSlice();
  const projection = makeProjection(slice, []);
  const result = buildScenarioDraftFromSlice(projection);

  assert.equal(result, null);
});

test("slice with only 1 possible observation returns null (cannot make distinct choices)", () => {
  const c1 = makeFact("constraints", "Lock is enabled", "constraint:1", "claim:c1");
  const c2 = makeFact("constraints", "Lock is disabled", "constraint:2", "claim:c2");
  const f1 = makeFact("flows", "Same outcome", "flow:1", "claim:f1");

  const claims = [
    confirmedClaim("claim:c1", "src/a.ts", 1),
    confirmedClaim("claim:c2", "src/a.ts", 10),
    confirmedClaim("claim:f1", "src/b.ts", 5),
  ];

  const slice = makeSlice({ constraints: [c1, c2], flows: [f1] });
  const projection = makeProjection(slice, claims);
  const result = buildScenarioDraftFromSlice(projection);

  assert.equal(result, null);
});

test("non-CONFIRMED evidence facts are excluded", () => {
  const c1 = makeFact("constraints", "Lock is enabled", "constraint:1", "claim:c1");
  const c2 = makeFact("constraints", "Lock is disabled", "constraint:2", "claim:c2");
  const f1 = makeFact("flows", "Requests share promise", "flow:1", "claim:f1");
  const f2 = makeFact("flows", "Each request refreshes", "flow:2", "claim:f2");

  const claims: EvidenceClaim[] = [
    confirmedClaim("claim:c1", "src/a.ts", 1),
    { ...confirmedClaim("claim:c2", "src/a.ts", 10), confidence: "INFERRED" },
    confirmedClaim("claim:f1", "src/b.ts", 5),
    confirmedClaim("claim:f2", "src/b.ts", 15),
  ];

  const slice = makeSlice({ constraints: [c1, c2], flows: [f1, f2] });
  const projection = makeProjection(slice, claims);
  const result = buildScenarioDraftFromSlice(projection);

  // Only 1 executable constraint, but 2 flows + 0 failures => cannot build 2 distinct cases
  // unless the flows themselves have different texts; with 1 constraint it needs a failure
  assert.equal(result, null);
});
