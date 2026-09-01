import test from "node:test";
import assert from "node:assert/strict";

import type { KnowledgeRecord } from "../../../src/repository-knowledge/contracts.ts";
import {
  projectKnowledgeBehaviorSlice,
  RepositoryKnowledgeProjectionError,
} from "../../../src/repository-knowledge/projector.ts";

test("malformed explicit step evidence indexes fail closed even when the step has no label", () => {
  const now = "2026-09-01T00:00:00.000Z";
  const records: KnowledgeRecord[] = [
    {
      id: "native:flow:unlabeled-invalid",
      kind: "behavior-flow:flow",
      subject: "Unlabeled invalid flow",
      structure: {
        type: "BEHAVIOR_FLOW",
        flowKind: "flow",
        name: "Unlabeled invalid flow",
        steps: [{ entityId: "native:entity:step", evidenceAnchorIndexes: [1] }],
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

  assert.throws(
    () => projectKnowledgeBehaviorSlice(records, "native:flow:unlabeled-invalid"),
    (error: unknown) => error instanceof RepositoryKnowledgeProjectionError
      && error.code === "KNOWLEDGE_FLOW_EVIDENCE_INDEX_INVALID",
  );
});
