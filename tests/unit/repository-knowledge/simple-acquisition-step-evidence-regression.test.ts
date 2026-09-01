import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  acquireSimpleRepositoryKnowledge,
  buildSimpleAcquisitionProposal,
  type SimpleKnowledgeAcquisitionInput,
} from "../../../src/repository-knowledge/simple-acquisition.ts";
import { readKnowledgeRecords, writeKnowledgeRecord } from "../../../src/repository-knowledge/store.ts";

test("flow capture deduplicates a locator shared by multiple steps and shares its anchor index", () => {
  const input: SimpleKnowledgeAcquisitionInput = {
    type: "flow",
    subject: "Shared evidence flow",
    evidenceLocators: [{ filePath: "src/flow.ts", lineStart: 1 }],
    steps: [
      {
        entity: "Step A",
        label: "Run A",
        evidenceLocators: [{ filePath: "src/flow.ts", lineStart: 2 }],
      },
      {
        entity: "Step B",
        label: "Run B",
        evidenceLocators: [{ filePath: "src/flow.ts", lineStart: 2 }],
      },
    ],
  };

  const proposal = buildSimpleAcquisitionProposal(input, []);
  const flow = proposal.candidates.find((candidate) => candidate.id === "native:flow:shared-evidence-flow");

  assert.deepEqual(flow?.evidenceCaptureLocators, [
    { filePath: "src/flow.ts", lineStart: 1 },
    { filePath: "src/flow.ts", lineStart: 2 },
  ]);
  assert.equal(flow?.structure?.type, "BEHAVIOR_FLOW");
  if (flow?.structure?.type !== "BEHAVIOR_FLOW") return;
  assert.deepEqual(flow.structure.steps.map((step) => step.evidenceAnchorIndexes), [[1], [1]]);
});

test("step evidence acquisition preserves reused Entity evidence and persists one Flow evidence union", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-step-evidence-regression-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "flow.ts"), "flow();\nexistingStep();\nnewStep();\n", "utf8");
  await fs.writeFile(path.join(repositoryRoot, "src", "entity.ts"), "originalEntityEvidence();\n", "utf8");
  const now = "2026-09-01T00:00:00.000Z";

  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:existing-step-original",
    kind: "entity:participant",
    subject: "Existing step",
    structure: { type: "ENTITY", entityKind: "participant", name: "Existing step" },
    activeEvidence: [{
      filePath: "src/entity.ts",
      lineStart: 1,
      snippet: "originalEntityEvidence();",
      confidence: "CONFIRMED",
      sourceConfidence: "existing",
      provenance: "preexisting",
    }],
    history: [],
    createdAt: now,
    updatedAt: now,
  });

  const result = await acquireSimpleRepositoryKnowledge({
    repositoryRoot,
    input: {
      type: "flow",
      subject: "Step grounded flow",
      evidenceLocators: [{ filePath: "src/flow.ts", lineStart: 1 }],
      steps: [
        {
          entity: "Existing step",
          label: "Run existing step",
          evidenceLocators: [{ filePath: "src/flow.ts", lineStart: 2 }],
        },
        {
          entity: "New step",
          label: "Run new step",
          evidenceLocators: [{ filePath: "src/flow.ts", lineStart: 3 }],
        },
      ],
    },
  });

  assert.equal(result.status, "ACQUIRED");
  const records = await readKnowledgeRecords(repositoryRoot);
  const existing = records.find((record) => record.id === "native:entity:existing-step-original");
  const flow = records.find((record) => record.id === "native:flow:step-grounded-flow");

  assert.deepEqual(existing?.activeEvidence, [{
    filePath: "src/entity.ts",
    lineStart: 1,
    snippet: "originalEntityEvidence();",
    confidence: "CONFIRMED",
    sourceConfidence: "existing",
    provenance: "preexisting",
  }]);
  assert.deepEqual(flow?.activeEvidence.map((anchor) => [anchor.filePath, anchor.lineStart, anchor.snippet]), [
    ["src/flow.ts", 1, "flow();"],
    ["src/flow.ts", 2, "existingStep();"],
    ["src/flow.ts", 3, "newStep();"],
  ]);
  assert.equal(flow?.structure?.type, "BEHAVIOR_FLOW");
  if (flow?.structure?.type !== "BEHAVIOR_FLOW") return;
  assert.deepEqual(flow.structure.steps, [
    {
      entityId: "native:entity:existing-step-original",
      label: "Run existing step",
      evidenceAnchorIndexes: [1],
    },
    {
      entityId: "native:entity:new-step",
      label: "Run new step",
      evidenceAnchorIndexes: [2],
    },
  ]);
});
