import test from "node:test";
import assert from "node:assert/strict";
import type {
  KnowledgeAcquisitionProposal,
  NativeKnowledgeCandidate,
} from "../../../src/repository-knowledge/acquisition-contracts.ts";
import type { KnowledgeRecord, KnowledgeStructure } from "../../../src/repository-knowledge/contracts.ts";
import { findKnowledgeDuplicates } from "../../../src/repository-knowledge/duplicate-detector.ts";

function candidate(overrides: Partial<NativeKnowledgeCandidate> = {}): NativeKnowledgeCandidate {
  return {
    id: "native:candidate:1",
    kind: "entity",
    subject: "Alpha subject",
    evidenceLocators: [],
    ...overrides,
  };
}

function record(overrides: Partial<KnowledgeRecord> = {}): KnowledgeRecord {
  return {
    id: "native:record:1",
    kind: "entity",
    subject: "Beta subject",
    activeEvidence: [],
    history: [],
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
    ...overrides,
  };
}

function proposal(...candidates: NativeKnowledgeCandidate[]): KnowledgeAcquisitionProposal {
  return { candidates };
}

const entityStructure = (name: string, entityKind = "class"): KnowledgeStructure => ({
  type: "ENTITY",
  entityKind,
  name,
});

test("flags a duplicate when the entity structure identity is identical", () => {
  const cand = candidate({
    id: "c-1",
    subject: "widgetsubject qqqalpha",
    structure: entityStructure("PaymentService"),
  });
  const existing = record({
    id: "r-1",
    subject: "gadgetsubject zzzbeta",
    structure: entityStructure("PaymentService"),
  });

  const matches = findKnowledgeDuplicates(proposal(cand), [existing]);

  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0], {
    candidateId: "c-1",
    existingRecordId: "r-1",
    reasons: ["STRUCTURE_IDENTITY"],
  });
});

test("structure identity alone is enough even without other reasons", () => {
  const cand = candidate({
    id: "c-1",
    subject: "unrelatable wording zzz",
    structure: {
      type: "RELATIONSHIP",
      relationshipKind: "calls",
      sourceId: "entity:a",
      targetId: "entity:b",
    },
  });
  const existing = record({
    id: "r-1",
    subject: "totally different phrasing qqq",
    structure: {
      type: "RELATIONSHIP",
      relationshipKind: "calls",
      sourceId: "entity:a",
      targetId: "entity:b",
    },
  });

  const matches = findKnowledgeDuplicates(proposal(cand), [existing]);

  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].reasons, ["STRUCTURE_IDENTITY"]);
});

test("matches identical behavior-flow step sequences", () => {
  const cand = candidate({
    id: "candqqq",
    subject: "uniquecandalpha wooble",
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "routing",
      name: "One",
      steps: [{ entityId: "e1" }, { entityId: "e2" }],
    },
  });
  const existing = record({
    id: "reczzz",
    kind: "flowkind",
    subject: "bbb uniquerec",
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "routing",
      name: "Two",
      steps: [{ entityId: "e1" }, { entityId: "e2" }],
    },
  });

  const matches = findKnowledgeDuplicates(proposal(cand), [existing]);

  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].reasons, ["STRUCTURE_IDENTITY"]);
});

test("differing behavior-flow step sequences are not a structure identity", () => {
  const cand = candidate({
    id: "c-1",
    subject: "qqq unrelated phrasing",
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "routing",
      name: "One",
      steps: [{ entityId: "e1" }, { entityId: "e2" }],
    },
  });
  const existing = record({
    id: "r-1",
    subject: "zzz different phrasing",
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "routing",
      name: "Two",
      steps: [{ entityId: "e1" }, { entityId: "e3" }],
    },
  });

  const matches = findKnowledgeDuplicates(proposal(cand), [existing]);

  assert.deepEqual(matches, []);
});

test("returns no match when structure types differ (early exit)", () => {
  const cand = candidate({
    id: "c-1",
    subject: "Payment service retry fallback",
    structure: entityStructure("PaymentService"),
    evidenceLocators: [{ filePath: "src/pay.ts", lineStart: 10, lineEnd: 20 }],
  });
  const existing = record({
    id: "r-1",
    subject: "Payment service retry fallback",
    structure: {
      type: "RELATIONSHIP",
      relationshipKind: "calls",
      sourceId: "a",
      targetId: "b",
    },
    activeEvidence: [{ filePath: "src/pay.ts", lineStart: 15, lineEnd: 25 }],
  });

  const matches = findKnowledgeDuplicates(proposal(cand), [existing]);

  assert.deepEqual(matches, []);
});

test("evidence overlap alone is not a duplicate (needs a second reason)", () => {
  const cand = candidate({
    id: "c-1",
    subject: "qqq unrelated phrasing zzz",
    evidenceLocators: [{ filePath: "src/foo.ts", lineStart: 10, lineEnd: 20 }],
  });
  const existing = record({
    id: "r-1",
    subject: "wholly distinct wording mmm",
    activeEvidence: [{ filePath: "src/foo.ts", lineStart: 15, lineEnd: 25 }],
  });

  const matches = findKnowledgeDuplicates(proposal(cand), [existing]);

  assert.deepEqual(matches, []);
});

test("meaning overlap plus evidence overlap together form a duplicate", () => {
  const cand = candidate({
    id: "c-1",
    subject: "Request routing flow",
    evidenceLocators: [{ filePath: "src/route.ts", lineStart: 5, lineEnd: 12 }],
  });
  const existing = record({
    id: "r-1",
    kind: "behavior-flow",
    subject: "Request routing flow",
    activeEvidence: [{ filePath: "src/route.ts", lineStart: 8, lineEnd: 20 }],
  });

  const matches = findKnowledgeDuplicates(proposal(cand), [existing]);

  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].reasons.sort(), ["EVIDENCE_LOCATOR_OVERLAP", "MEANING_OVERLAP"]);
});

test("evidence overlap requires the same file path", () => {
  const cand = candidate({
    id: "c-1",
    subject: "Request routing flow",
    evidenceLocators: [{ filePath: "src/route.ts", lineStart: 5, lineEnd: 12 }],
  });
  const existing = record({
    id: "r-1",
    kind: "behavior-flow",
    subject: "Request routing flow",
    activeEvidence: [{ filePath: "src/other.ts", lineStart: 8, lineEnd: 20 }],
  });

  const matches = findKnowledgeDuplicates(proposal(cand), [existing]);

  // Only meaning overlap remains -> one reason -> not a duplicate.
  assert.deepEqual(matches, []);
});

test("evidence overlap requires overlapping line ranges", () => {
  const cand = candidate({
    id: "c-1",
    subject: "Request routing flow",
    evidenceLocators: [{ filePath: "src/route.ts", lineStart: 5, lineEnd: 10 }],
  });
  const existing = record({
    id: "r-1",
    kind: "behavior-flow",
    subject: "Request routing flow",
    activeEvidence: [{ filePath: "src/route.ts", lineStart: 50, lineEnd: 60 }],
  });

  const matches = findKnowledgeDuplicates(proposal(cand), [existing]);

  // Ranges do not overlap so only meaning overlap remains -> not a duplicate.
  assert.deepEqual(matches, []);
});

test("skips comparison when candidate and existing share the same id", () => {
  const cand = candidate({
    id: "shared",
    subject: "Payment service",
    structure: entityStructure("PaymentService"),
  });
  const existing = record({
    id: "shared",
    subject: "Payment service",
    structure: entityStructure("PaymentService"),
  });

  const matches = findKnowledgeDuplicates(proposal(cand), [existing]);

  assert.deepEqual(matches, []);
});

test("entity identity requires both names to be present", () => {
  const cand = candidate({
    id: "c-1",
    subject: "qqq phrasing",
    structure: { type: "ENTITY", entityKind: "class" },
  });
  const existing = record({
    id: "r-1",
    subject: "zzz phrasing",
    structure: { type: "ENTITY", entityKind: "class" },
  });

  const matches = findKnowledgeDuplicates(proposal(cand), [existing]);

  assert.deepEqual(matches, []);
});

test("results are sorted by candidate id then existing record id", () => {
  const candA = candidate({ id: "c-2", subject: "x", structure: entityStructure("Shared") });
  const candB = candidate({ id: "c-1", subject: "y", structure: entityStructure("Shared") });
  const recA = record({ id: "r-2", subject: "p", structure: entityStructure("Shared") });
  const recB = record({ id: "r-1", subject: "q", structure: entityStructure("Shared") });

  const matches = findKnowledgeDuplicates(proposal(candA, candB), [recA, recB]);

  assert.deepEqual(
    matches.map((m) => [m.candidateId, m.existingRecordId]),
    [
      ["c-1", "r-1"],
      ["c-1", "r-2"],
      ["c-2", "r-1"],
      ["c-2", "r-2"],
    ],
  );
});
