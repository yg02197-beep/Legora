import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  acquireSimpleRepositoryKnowledge,
  type SimpleKnowledgeAcquisitionInput,
} from "../../../src/repository-knowledge/simple-acquisition.ts";
import { readKnowledgeRecords, writeKnowledgeRecord } from "../../../src/repository-knowledge/store.ts";

async function repositoryWithSource(name = "service.ts", content = "service();\n"): Promise<string> {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-simple-acquire-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", name), content, "utf8");
  return repositoryRoot;
}

function locator(filePath: string) {
  return [{ filePath, lineStart: 1 }];
}

test("simple entity acquisition generates Legora-owned identity and structure", async () => {
  const repositoryRoot = await repositoryWithSource();
  const input: SimpleKnowledgeAcquisitionInput = {
    type: "entity",
    subject: "service entry point",
    name: "Service",
    entityKind: "service",
    evidenceLocators: locator("src/service.ts"),
  };

  const result = await acquireSimpleRepositoryKnowledge({ repositoryRoot, input });

  assert.equal(result.status, "ACQUIRED");
  assert.deepEqual(result.recordIds, ["native:entity:service"]);
  const [stored] = await readKnowledgeRecords(repositoryRoot);
  assert.equal(stored?.kind, "entity:service");
  assert.deepEqual(stored?.structure, {
    type: "ENTITY",
    entityKind: "service",
    name: "Service",
  });
});

test("simple flow acquisition generates participant entities and a behavior flow", async () => {
  const repositoryRoot = await repositoryWithSource("download.ts", "download();\n");
  const input: SimpleKnowledgeAcquisitionInput = {
    type: "flow",
    subject: "Download fallback chain",
    flowKind: "routing",
    evidenceLocators: locator("src/download.ts"),
    steps: [
      { entity: "Direct attempt", label: "Try direct download" },
      { entity: "General fallback", label: "Try fallback after retryable failure" },
    ],
  };

  const result = await acquireSimpleRepositoryKnowledge({ repositoryRoot, input });

  assert.equal(result.status, "ACQUIRED");
  assert.deepEqual(result.recordIds, [
    "native:entity:direct-attempt",
    "native:entity:general-fallback",
    "native:flow:download-fallback-chain",
  ]);
  const records = await readKnowledgeRecords(repositoryRoot);
  const flow = records.find((record) => record.id === "native:flow:download-fallback-chain");
  assert.deepEqual(flow?.structure, {
    type: "BEHAVIOR_FLOW",
    flowKind: "routing",
    name: "Download fallback chain",
    steps: [
      { entityId: "native:entity:direct-attempt", label: "Try direct download" },
      { entityId: "native:entity:general-fallback", label: "Try fallback after retryable failure" },
    ],
  });
});

test("simple relationship acquisition generates source and target entities", async () => {
  const repositoryRoot = await repositoryWithSource("route.ts", "route();\n");
  const input: SimpleKnowledgeAcquisitionInput = {
    type: "relationship",
    subject: "Direct fallback to General",
    relationshipKind: "fallback",
    source: "Direct attempt",
    target: "General fallback",
    evidenceLocators: locator("src/route.ts"),
  };

  const result = await acquireSimpleRepositoryKnowledge({ repositoryRoot, input });

  assert.equal(result.status, "ACQUIRED");
  const records = await readKnowledgeRecords(repositoryRoot);
  const relationship = records.find((record) => record.id === "native:relationship:direct-fallback-to-general");
  assert.deepEqual(relationship?.structure, {
    type: "RELATIONSHIP",
    relationshipKind: "fallback",
    sourceId: "native:entity:direct-attempt",
    targetId: "native:entity:general-fallback",
  });
});

test("simple flow reuses an existing entity identity by semantic name", async () => {
  const repositoryRoot = await repositoryWithSource("download.ts", "download();\n");
  const now = "2026-08-22T00:00:00.000Z";
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:primary-download-existing",
    kind: "entity:attempt",
    subject: "primary download",
    structure: { type: "ENTITY", entityKind: "attempt", name: "Direct attempt" },
    activeEvidence: [{ filePath: "src/download.ts", lineStart: 1, snippet: "download();" }],
    history: [],
    createdAt: now,
    updatedAt: now,
  });
  const input: SimpleKnowledgeAcquisitionInput = {
    type: "flow",
    subject: "Download fallback chain",
    evidenceLocators: locator("src/download.ts"),
    steps: [
      { entity: "Direct attempt" },
      { entity: "General fallback" },
    ],
  };

  const result = await acquireSimpleRepositoryKnowledge({ repositoryRoot, input });

  assert.equal(result.status, "ACQUIRED");
  const records = await readKnowledgeRecords(repositoryRoot);
  const flow = records.find((record) => record.id === "native:flow:download-fallback-chain");
  assert.equal(flow?.structure?.type, "BEHAVIOR_FLOW");
  if (flow?.structure?.type !== "BEHAVIOR_FLOW") return;
  assert.equal(flow.structure.steps[0]?.entityId, "native:entity:primary-download-existing");
  assert.equal(records.filter((record) => record.structure?.type === "ENTITY").length, 2);
});
