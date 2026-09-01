import test from "node:test";
import assert from "node:assert/strict";

import type { KnowledgeRecord } from "../../../src/repository-knowledge/contracts.ts";
import {
  projectKnowledgeBehaviorSlice,
  RepositoryKnowledgeProjectionError,
} from "../../../src/repository-knowledge/projector.ts";

function recordsWithIndexes(evidenceAnchorIndexes: number[]): KnowledgeRecord[] {
  const now = "2026-09-01T00:00:00.000Z";
  return [
    {
      id: "native:flow:invalid-index-flow",
      kind: "behavior-flow:flow",
      subject: "Invalid index flow",
      structure: {
        type: "BEHAVIOR_FLOW",
        flowKind: "flow",
        name: "Invalid index flow",
        steps: [{
          entityId: "native:entity:step",
          label: "Run step",
          evidenceAnchorIndexes,
        }],
      },
      activeEvidence: [{
        filePath: "src/flow.ts",
        lineStart: 1,
        snippet: "runStep();",
        confidence: "INFERRED",
        sourceConfidence: "repository-captured",
      }],
      history: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "native:entity:step",
      kind: "entity:participant",
      subject: "Step",
      structure: { type: "ENTITY", entityKind: "participant", name: "Step" },
      activeEvidence: [{
        filePath: "src/entity.ts",
        lineStart: 1,
        snippet: "stepEntity();",
        confidence: "INFERRED",
        sourceConfidence: "repository-captured",
      }],
      history: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

test("malformed explicit flow step evidence indexes fail closed", () => {
  for (const indexes of [[-1], [0.5], [0, 0], [1]]) {
    assert.throws(
      () => projectKnowledgeBehaviorSlice(recordsWithIndexes(indexes), "native:flow:invalid-index-flow"),
      (error: unknown) => error instanceof RepositoryKnowledgeProjectionError
        && error.code === "KNOWLEDGE_FLOW_EVIDENCE_INDEX_INVALID",
      `indexes ${JSON.stringify(indexes)} should fail closed`,
    );
  }
});
