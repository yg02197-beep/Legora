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

test("Legora Entry recovers the existing download fallback flow from the Korean real-world question", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-entry-download-fallback-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "download.ts"), "download();\n", "utf8");
  const now = "2026-08-22T00:00:00.000Z";

  for (const [id, name] of [
    ["native:entity:primary-download", "Primary download attempt"],
    ["native:entity:secondary-download", "Secondary downloader"],
  ] as const) {
    await writeKnowledgeRecord(repositoryRoot, {
      id,
      kind: "entity:attempt",
      subject: name,
      activeEvidence: [{ filePath: "src/download.ts", lineStart: 1, snippet: "download();", confidence: "CONFIRMED" }],
      history: [],
      createdAt: now,
      updatedAt: now,
      structure: { type: "ENTITY", entityKind: "attempt", name },
    });
  }

  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:flow:download-fallback-chain",
    kind: "behavior-flow:routing",
    subject: "Download fallback chain",
    activeEvidence: [{ filePath: "src/download.ts", lineStart: 1, snippet: "download();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: now,
    updatedAt: now,
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "routing",
      name: "DownloadFallbackChain",
      steps: [
        { entityId: "native:entity:primary-download", label: "Direct attempt" },
        { entityId: "native:entity:secondary-download", label: "General fallback after retryable failure" },
      ],
    },
  });

  const result = await runLegoraEntry({ repositoryRoot, question: "Direct 실패하면 언제 바로 끝나?" });

  assert.equal(result.status, "READY");
  assert.equal(result.flowRecordId, "native:flow:download-fallback-chain");
  assert.equal(result.nextAction, null);
});

test("Legora Entry reports related unprojectable knowledge as candidates instead of not found", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-entry-candidates-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "retry.ts"), "retry();\n", "utf8");
  const now = "2026-08-22T00:00:00.000Z";
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:download-retry",
    kind: "entity:capability",
    subject: "download retry coordinator",
    activeEvidence: [{ filePath: "src/retry.ts", lineStart: 1, snippet: "retry();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: now,
    updatedAt: now,
    structure: {
      type: "ENTITY",
      entityKind: "capability",
      name: "Download retry coordinator",
      description: "Chooses whether a failed download should retry or stop",
    },
  });

  const result = await runLegoraEntry({ repositoryRoot, question: "다운로드 실패 후 재시도는 어떻게 결정해?" });

  assert.equal(result.status, "KNOWLEDGE_CANDIDATES");
  assert.deepEqual(result.candidateRecordIds, ["native:entity:download-retry"]);
  assert.deepEqual(result.candidates?.map((candidate) => ({
    recordId: candidate.recordId,
    subject: candidate.subject,
    confidence: candidate.confidence,
  })), [{
    recordId: "native:entity:download-retry",
    subject: "download retry coordinator",
    confidence: "STRONG",
  }]);
  assert.deepEqual(result.nextAction, {
    type: "REVIEW_KNOWLEDGE_CANDIDATES",
    question: "다운로드 실패 후 재시도는 어떻게 결정해?",
    recordIds: ["native:entity:download-retry"],
  });
});

test("Legora Entry requires candidate confirmation for a weak semantic flow match and then projects it", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-entry-weak-candidate-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "retry.ts"), "retry();\n", "utf8");
  const now = "2026-08-22T00:00:00.000Z";
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:retry-runner",
    kind: "entity:capability",
    subject: "download runner",
    activeEvidence: [{ filePath: "src/retry.ts", lineStart: 1, snippet: "retry();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: now,
    updatedAt: now,
    structure: { type: "ENTITY", entityKind: "capability", name: "Download runner" },
  });
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:flow:download-retry",
    kind: "behavior-flow:routing",
    subject: "Download retry policy",
    activeEvidence: [{ filePath: "src/retry.ts", lineStart: 1, snippet: "retry();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: now,
    updatedAt: now,
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "routing",
      name: "Download retry policy",
      steps: [{ entityId: "native:entity:retry-runner", label: "Retry download" }],
    },
  });

  const candidate = await runLegoraEntry({ repositoryRoot, question: "재시도?" });
  assert.equal(candidate.status, "KNOWLEDGE_CANDIDATES");
  assert.ok(candidate.candidateRecordIds?.includes("native:flow:download-retry"));

  const confirmed = await runLegoraEntry({
    repositoryRoot,
    question: "재시도?",
    candidateRecordId: "native:flow:download-retry",
  });
  assert.equal(confirmed.status, "READY");
  assert.equal(confirmed.flowRecordId, "native:flow:download-retry");
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

test("Legora Entry recovers existing flow metadata before declaring zero-overlap knowledge missing", async () => {
  const repositoryRoot = await repositoryWithKnowledge();

  const result = await runLegoraEntry({ repositoryRoot, question: "처리가 막히면 후속 수단을 고르는 기준은?" });

  assert.equal(result.status, "KNOWLEDGE_CANDIDATES");
  assert.deepEqual(result.candidateRecordIds, ["knowledge:flow:routing"]);
  assert.deepEqual(result.candidates?.map((candidate) => candidate.confidence), ["RECOVERY"]);
  assert.equal(result.candidates?.[0]?.subject, "request routing");
});

test("Legora Entry declares knowledge missing only after recovery candidates are explicitly rejected", async () => {
  const repositoryRoot = await repositoryWithKnowledge();

  const initial = await runLegoraEntry({ repositoryRoot, question: "completely unrelated topic" });
  assert.equal(initial.status, "KNOWLEDGE_CANDIDATES");

  const result = await runLegoraEntry({
    repositoryRoot,
    question: "completely unrelated topic",
    candidatesRejected: true,
  });

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

test("Legora Entry does not ignore an invalid explicit candidate in favor of another strong match", async () => {
  const repositoryRoot = await repositoryWithKnowledge();

  const result = await runLegoraEntry({
    repositoryRoot,
    question: "request routing",
    candidateRecordId: "knowledge:flow:not-present",
  });

  assert.equal(result.status, "KNOWLEDGE_CANDIDATES");
  assert.ok(result.candidateRecordIds?.includes("knowledge:flow:routing"));
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
