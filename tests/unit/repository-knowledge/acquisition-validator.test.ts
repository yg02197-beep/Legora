import test from "node:test";
import assert from "node:assert/strict";
import type { KnowledgeRecord } from "../../../src/repository-knowledge/contracts.ts";
import type { KnowledgeAcquisitionProposal } from "../../../src/repository-knowledge/acquisition-contracts.ts";
import { validateAcquisitionProposal } from "../../../src/repository-knowledge/acquisition-validator.ts";

const now = "2026-08-22T00:00:00.000Z";

function existingEntity(id: string): KnowledgeRecord {
  return {
    id,
    kind: "entity:service",
    subject: id,
    structure: { type: "ENTITY", entityKind: "service", name: id },
    activeEvidence: [{ filePath: "src/existing.ts", lineStart: 1, snippet: "existing();" }],
    history: [],
    createdAt: now,
    updatedAt: now,
  };
}

test("validator accepts references to existing entities and entities declared in the same batch", () => {
  const proposal: KnowledgeAcquisitionProposal = {
    candidates: [
      {
        id: "native:entity:worker",
        kind: "entity:service",
        subject: "worker service",
        structure: { type: "ENTITY", entityKind: "service", name: "worker" },
        evidenceLocators: [{ filePath: "src/worker.ts", lineStart: 1 }],
      },
      {
        id: "native:relationship:dispatches",
        kind: "relationship:dispatches",
        subject: "router dispatches worker",
        structure: {
          type: "RELATIONSHIP",
          relationshipKind: "dispatches",
          sourceId: "native:entity:router",
          targetId: "native:entity:worker",
        },
        evidenceLocators: [{ filePath: "src/router.ts", lineStart: 5 }],
      },
      {
        id: "native:flow:routing",
        kind: "behavior-flow:routing",
        subject: "request routing",
        structure: {
          type: "BEHAVIOR_FLOW",
          flowKind: "routing",
          name: "Request routing",
          steps: [
            { entityId: "native:entity:router", label: "Receive" },
            { entityId: "native:entity:worker", label: "Dispatch" },
          ],
        },
        evidenceLocators: [{ filePath: "src/router.ts", lineStart: 5 }],
      },
    ],
  };

  const result = validateAcquisitionProposal(proposal, [existingEntity("native:entity:router")]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.issues, []);
});

test("validator rejects duplicate candidate ids before any candidate can be promoted", () => {
  const proposal: KnowledgeAcquisitionProposal = {
    candidates: [
      {
        id: "native:entity:worker",
        kind: "entity:service",
        subject: "worker one",
        structure: { type: "ENTITY", entityKind: "service" },
        evidenceLocators: [{ filePath: "src/a.ts", lineStart: 1 }],
      },
      {
        id: "native:entity:worker",
        kind: "entity:service",
        subject: "worker two",
        structure: { type: "ENTITY", entityKind: "service" },
        evidenceLocators: [{ filePath: "src/b.ts", lineStart: 1 }],
      },
    ],
  };

  const result = validateAcquisitionProposal(proposal, []);

  assert.equal(result.valid, false);
  assert.equal(result.issues[0]?.code, "DUPLICATE_CANDIDATE_ID");
  assert.equal(result.issues[0]?.candidateId, "native:entity:worker");
});

test("validator rejects relationship and flow references that do not resolve to entities", () => {
  const proposal: KnowledgeAcquisitionProposal = {
    candidates: [
      {
        id: "native:relationship:bad",
        kind: "relationship:calls",
        subject: "bad relationship",
        structure: {
          type: "RELATIONSHIP",
          relationshipKind: "calls",
          sourceId: "native:entity:missing",
          targetId: "native:flow:not-an-entity",
        },
        evidenceLocators: [{ filePath: "src/a.ts", lineStart: 1 }],
      },
      {
        id: "native:flow:not-an-entity",
        kind: "behavior-flow:fixture",
        subject: "fixture flow",
        structure: {
          type: "BEHAVIOR_FLOW",
          flowKind: "fixture",
          name: "Fixture",
          steps: [],
        },
        evidenceLocators: [{ filePath: "src/a.ts", lineStart: 1 }],
      },
    ],
  };

  const result = validateAcquisitionProposal(proposal, []);

  assert.equal(result.valid, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["REFERENCE_ENTITY_NOT_FOUND", "REFERENCE_ENTITY_NOT_FOUND"],
  );
});
