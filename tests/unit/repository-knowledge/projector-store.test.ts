import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import { writeKnowledgeRecord } from "../../../src/repository-knowledge/store.ts";
import { projectRepositoryKnowledgeBehaviorSlice } from "../../../src/repository-knowledge/projector.ts";
import type { KnowledgeRecord } from "../../../src/repository-knowledge/contracts.ts";

function record(id: string, value: Partial<KnowledgeRecord>): KnowledgeRecord {
  return {
    id,
    kind: value.kind ?? "entity:capability",
    subject: value.subject ?? id,
    structure: value.structure,
    activeEvidence: value.activeEvidence ?? [],
    history: value.history ?? [],
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
  };
}

test("repository-level projector reads persisted knowledge without a provider model", async () => {
  const repositoryRoot = await fs.mkdtemp(`${os.tmpdir()}\\legora-projector-store-`);
  const entity = record("entity:route", {
    subject: "routeRequest",
    structure: { type: "ENTITY", entityKind: "capability", name: "routeRequest" },
    activeEvidence: [{
      filePath: "src/route.ts",
      lineStart: 1,
      snippet: "route();",
      confidence: "CONFIRMED",
      sourceConfidence: "legora",
      provenance: "native",
    }],
  });
  const flow = record("flow:request", {
    kind: "behavior-flow:flow",
    subject: "Request flow",
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "flow",
      name: "Request flow",
      steps: [{ entityId: entity.id, label: "Route request" }],
    },
  });
  await writeKnowledgeRecord(repositoryRoot, entity);
  await writeKnowledgeRecord(repositoryRoot, flow);

  const result = await projectRepositoryKnowledgeBehaviorSlice(repositoryRoot, flow.id);

  assert.equal(result.source.kind, "REPOSITORY_KNOWLEDGE");
  assert.equal(result.behaviorSlice.owner, "LEGORA");
  assert.deepEqual(result.behaviorSlice.flows.map((fact) => fact.text), ["Route request"]);
});
