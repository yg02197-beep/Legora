import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runLegoraEntry } from "../../src/entry.ts";
import { readKnowledgeRecords, writeKnowledgeRecord } from "../../src/repository-knowledge/store.ts";

async function repositoryWithKnowledge() {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-entry-knowledge-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "route.ts"), "route();\n", "utf8");
  const now = "2026-08-22T00:00:00.000Z";
  await writeKnowledgeRecord(repositoryRoot, {
    id: "knowledge:entity:route",
    kind: "entity:capability",
    subject: "route request",
    activeEvidence: [{ filePath: "src/route.ts", lineStart: 1, snippet: "route();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: now,
    updatedAt: now,
    structure: { type: "ENTITY", entityKind: "capability", name: "route request" },
  });
  await writeKnowledgeRecord(repositoryRoot, {
    id: "knowledge:flow:routing",
    kind: "behavior-flow:flow",
    subject: "request routing",
    activeEvidence: [{ filePath: "src/route.ts", lineStart: 1, snippet: "route();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: now,
    updatedAt: now,
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "flow",
      name: "Request routing",
      steps: [{ entityId: "knowledge:entity:route", label: "Route request" }],
    },
  });
  return repositoryRoot;
}

test("Legora Entry selects fresh repository knowledge from a question and projects a Legora-owned slice", async () => {
  const repositoryRoot = await repositoryWithKnowledge();

  const result = await runLegoraEntry({ repositoryRoot, question: "How does request routing work?" });

  assert.equal(result.status, "READY");
  if (result.status !== "READY") return;
  assert.ok(result.behaviorSlice);
  assert.equal(result.behaviorSlice.owner, "LEGORA");
  assert.equal(result.behaviorSlice.subject, "Request routing");
  assert.deepEqual(result.behaviorSlice.flows.map((fact) => fact.text), ["Route request"]);
  assert.equal(result.flowRecordId, "knowledge:flow:routing");
});

test("Legora Entry blocks a selected slice when referenced active evidence is stale", async () => {
  const repositoryRoot = await repositoryWithKnowledge();
  await fs.writeFile(path.join(repositoryRoot, "src", "route.ts"), "changed();\n", "utf8");

  const result = await runLegoraEntry({ repositoryRoot, question: "request routing" });

  assert.equal(result.status, "KNOWLEDGE_STALE");
  assert.equal(result.behaviorSlice, null);
  assert.ok(result.freshness.some((item) => item.result.status === "STALE"));
});

test("Legora Entry blocks a selected slice when referenced active evidence is uncheckable", async () => {
  const repositoryRoot = await repositoryWithKnowledge();
  const records = await readKnowledgeRecords(repositoryRoot);
  const entity = records.find((record) => record.id === "knowledge:entity:route");
  assert.ok(entity);
  entity.activeEvidence = [{ filePath: "src/route.ts", lineStart: 1, confidence: "CONFIRMED" }];
  await writeKnowledgeRecord(repositoryRoot, entity);

  const result = await runLegoraEntry({ repositoryRoot, question: "request routing" });

  assert.equal(result.status, "KNOWLEDGE_UNKNOWN");
  assert.equal(result.behaviorSlice, null);
  assert.ok(result.freshness.some((item) => item.result.status === "UNKNOWN"));
});

test("Legora Entry expands an entity-only question to a flow containing that entity", async () => {
  const repositoryRoot = await repositoryWithKnowledge();
  const records = await readKnowledgeRecords(repositoryRoot);
  const entity = records.find((record) => record.id === "knowledge:entity:route");
  assert.ok(entity?.structure?.type === "ENTITY");
  entity.subject = "dispatch handler";
  entity.structure.name = "dispatch handler";
  await writeKnowledgeRecord(repositoryRoot, entity);

  const result = await runLegoraEntry({ repositoryRoot, question: "dispatch handler" });

  assert.equal(result.status, "READY");
  assert.equal(result.flowRecordId, "knowledge:flow:routing");
});

test("unrelated stale knowledge does not block a fresh selected behavior slice", async () => {
  const repositoryRoot = await repositoryWithKnowledge();
  const now = "2026-08-22T00:00:00.000Z";
  await writeKnowledgeRecord(repositoryRoot, {
    id: "knowledge:entity:unrelated",
    kind: "entity:capability",
    subject: "unrelated maintenance task",
    activeEvidence: [{ filePath: "src/missing.ts", lineStart: 1, snippet: "missing", confidence: "CONFIRMED" }],
    history: [],
    createdAt: now,
    updatedAt: now,
    structure: { type: "ENTITY", entityKind: "capability", name: "unrelated maintenance task" },
  });

  const result = await runLegoraEntry({ repositoryRoot, question: "request routing" });

  assert.equal(result.status, "READY");
  assert.ok(!result.freshness.some((item) => item.recordId === "knowledge:entity:unrelated"));
});

test("Legora Entry reports missing knowledge instead of invoking a provider refresh path", async () => {
  const repositoryRoot = await repositoryWithKnowledge();

  const result = await runLegoraEntry({ repositoryRoot, question: "completely unrelated topic" });

  assert.deepEqual(result, {
    status: "KNOWLEDGE_NOT_FOUND",
    question: "completely unrelated topic",
    flowRecordId: null,
    behaviorSlice: null,
    evidenceClaims: [],
    diagnostics: null,
    freshness: [],
    nextAction: {
      type: "ACQUIRE_KNOWLEDGE",
      question: "completely unrelated topic",
    },
  });
});

test("Legora Entry follows query ranking before falling back to a weaker direct flow match", async () => {
  const repositoryRoot = await repositoryWithKnowledge();
  const records = await readKnowledgeRecords(repositoryRoot);
  const entity = records.find((record) => record.id === "knowledge:entity:route");
  assert.ok(entity?.structure?.type === "ENTITY");
  entity.subject = "dispatch handler priority";
  entity.structure.name = "dispatch handler priority";
  await writeKnowledgeRecord(repositoryRoot, entity);

  const now = "2026-08-22T00:00:00.000Z";
  await writeKnowledgeRecord(repositoryRoot, {
    id: "knowledge:entity:generic",
    kind: "entity:capability",
    subject: "generic priority",
    activeEvidence: [{ filePath: "src/route.ts", lineStart: 1, snippet: "route();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: now,
    updatedAt: now,
    structure: { type: "ENTITY", entityKind: "capability", name: "generic priority" },
  });
  await writeKnowledgeRecord(repositoryRoot, {
    id: "knowledge:flow:generic",
    kind: "behavior-flow:flow",
    subject: "priority overview",
    activeEvidence: [{ filePath: "src/route.ts", lineStart: 1, snippet: "route();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: now,
    updatedAt: now,
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "flow",
      name: "Generic priority overview",
      steps: [{ entityId: "knowledge:entity:generic", label: "Generic" }],
    },
  });

  const result = await runLegoraEntry({ repositoryRoot, question: "dispatch handler priority" });

  assert.equal(result.status, "READY");
  assert.equal(result.flowRecordId, "knowledge:flow:routing");
});
