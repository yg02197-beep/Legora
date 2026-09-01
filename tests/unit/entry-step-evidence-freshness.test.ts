import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runLegoraEntry } from "../../src/entry.ts";
import { writeKnowledgeRecord } from "../../src/repository-knowledge/store.ts";

test("Entry freshness ignores semantic Entity evidence when explicit step grounding does not require it", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-entry-step-freshness-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "flow.ts"), "runStep();\n", "utf8");
  const now = "2026-09-01T00:00:00.000Z";

  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:flow:step-grounded",
    kind: "behavior-flow:flow",
    subject: "Step grounded flow",
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "flow",
      name: "Step grounded flow",
      steps: [{
        entityId: "native:entity:step",
        label: "Run step",
        evidenceAnchorIndexes: [0],
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
  });
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:step",
    kind: "entity:participant",
    subject: "Step",
    structure: { type: "ENTITY", entityKind: "participant", name: "Step" },
    activeEvidence: [{
      filePath: "src/missing-entity-evidence.ts",
      lineStart: 1,
      snippet: "stepEntity();",
      confidence: "INFERRED",
      sourceConfidence: "repository-captured",
    }],
    history: [],
    createdAt: now,
    updatedAt: now,
  });

  const result = await runLegoraEntry({
    repositoryRoot,
    question: "Step grounded flow",
    candidateRecordId: "native:flow:step-grounded",
  });

  assert.equal(result.status, "READY");
  assert.deepEqual(result.freshness.map((item) => item.recordId), ["native:flow:step-grounded"]);
  assert.equal(result.freshness[0]?.result.checkedAnchors, 1);
});
