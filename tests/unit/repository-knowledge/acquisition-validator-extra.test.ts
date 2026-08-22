import test from "node:test";
import assert from "node:assert/strict";
import type { KnowledgeAcquisitionProposal } from "../../../src/repository-knowledge/acquisition-contracts.ts";
import { validateAcquisitionProposal } from "../../../src/repository-knowledge/acquisition-validator.ts";

test("validator rejects missing structure and missing evidence locators", () => {
  const proposal: KnowledgeAcquisitionProposal = {
    candidates: [{
      id: "native:entity:x",
      kind: "entity:service",
      subject: "x",
      evidenceLocators: [],
    }],
  };

  const result = validateAcquisitionProposal(proposal, []);

  assert.equal(result.valid, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["STRUCTURE_REQUIRED", "EVIDENCE_REQUIRED"],
  );
});

test("validator allows an existing record id to be proposed for a later evidence update", () => {
  const proposal: KnowledgeAcquisitionProposal = {
    candidates: [{
      id: "native:entity:x",
      kind: "entity:service",
      subject: "updated x",
      structure: { type: "ENTITY", entityKind: "service", name: "x" },
      evidenceLocators: [{ filePath: "src/x.ts", lineStart: 2 }],
    }],
  };
  const existing = [{
    id: "native:entity:x",
    kind: "entity:service",
    subject: "old x",
    structure: { type: "ENTITY" as const, entityKind: "service" },
    activeEvidence: [{ filePath: "src/x.ts", lineStart: 1, snippet: "old();" }],
    history: [],
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
  }];

  const result = validateAcquisitionProposal(proposal, existing);

  assert.equal(result.valid, true);
});

test("validator rejects an incomplete candidate identity", () => {
  const proposal: KnowledgeAcquisitionProposal = {
    candidates: [{
      id: "",
      kind: "entity:service",
      subject: "x",
      structure: { type: "ENTITY", entityKind: "service" },
      evidenceLocators: [{ filePath: "src/x.ts", lineStart: 1 }],
    }],
  };

  const result = validateAcquisitionProposal(proposal, []);

  assert.equal(result.valid, false);
  assert.equal(result.issues[0]?.code, "IDENTITY_REQUIRED");
});

test("validator rejects a behavior flow step whose entity does not exist", () => {
  const proposal: KnowledgeAcquisitionProposal = {
    candidates: [{
      id: "native:flow:broken",
      kind: "behavior-flow:broken",
      subject: "broken flow",
      structure: {
        type: "BEHAVIOR_FLOW",
        flowKind: "broken",
        name: "Broken",
        steps: [{ entityId: "native:entity:missing" }],
      },
      evidenceLocators: [{ filePath: "src/x.ts", lineStart: 1 }],
    }],
  };

  const result = validateAcquisitionProposal(proposal, []);

  assert.equal(result.valid, false);
  assert.equal(result.issues[0]?.code, "REFERENCE_ENTITY_NOT_FOUND");
  assert.equal(result.issues[0]?.referenceId, "native:entity:missing");
});

test("validator rejects an empty acquisition batch", () => {
  const result = validateAcquisitionProposal({ candidates: [] }, []);

  assert.equal(result.valid, false);
  assert.equal(result.issues[0]?.code, "CANDIDATE_REQUIRED");
});

test("validator evaluates references against the effective store after updates", () => {
  const existing = [
    {
      id: "native:entity:x",
      kind: "entity:service",
      subject: "x",
      structure: { type: "ENTITY" as const, entityKind: "service" },
      activeEvidence: [],
      history: [],
      createdAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
    },
    {
      id: "native:relationship:self",
      kind: "relationship:self",
      subject: "x references x",
      structure: {
        type: "RELATIONSHIP" as const,
        relationshipKind: "references",
        sourceId: "native:entity:x",
        targetId: "native:entity:x",
      },
      activeEvidence: [],
      history: [],
      createdAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
    },
  ];
  const proposal: KnowledgeAcquisitionProposal = {
    candidates: [{
      id: "native:entity:x",
      kind: "behavior-flow:x",
      subject: "x is now incorrectly proposed as a flow",
      structure: {
        type: "BEHAVIOR_FLOW",
        flowKind: "replacement",
        name: "replacement",
        steps: [],
      },
      evidenceLocators: [{ filePath: "src/x.ts", lineStart: 1 }],
    }],
  };

  const result = validateAcquisitionProposal(proposal, existing);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) =>
    issue.code === "REFERENCE_ENTITY_NOT_FOUND"
    && issue.candidateId === "native:relationship:self"
    && issue.referenceId === "native:entity:x"));
});

test("validator rejects malformed evidence locator coordinates before capture", () => {
  const invalidLocators = [
    { filePath: "", lineStart: 1 },
    { filePath: "src/x.ts", lineStart: 0 },
    { filePath: "src/x.ts", lineStart: 1.5 },
    { filePath: "src/x.ts", lineStart: 3, lineEnd: 2 },
  ];

  for (const locator of invalidLocators) {
    const result = validateAcquisitionProposal({
      candidates: [{
        id: "native:entity:x",
        kind: "entity:service",
        subject: "x",
        structure: { type: "ENTITY", entityKind: "service" },
        evidenceLocators: [locator],
      }],
    }, []);

    assert.equal(result.valid, false);
    assert.equal(result.issues[0]?.code, "EVIDENCE_LOCATOR_INVALID");
  }
});
