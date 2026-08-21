import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { KnowledgeRecord } from "../../../src/repository-knowledge/contracts.ts";
import { queryKnowledgeRecords } from "../../../src/repository-knowledge/query.ts";
import { writeKnowledgeRecord } from "../../../src/repository-knowledge/store.ts";

function record(id: string, kind: string, subject: string): KnowledgeRecord {
  return {
    id,
    kind,
    subject,
    activeEvidence: [{ filePath: `src/${id}.ts`, lineStart: 1, snippet: subject }],
    history: [],
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
  };
}

test("query returns only records whose subject matches the question tokens", () => {
  const records = [
    record("request-routing", "behavior-flow", "Request routing flow"),
    record("database-retry", "failure", "Database retry failure"),
  ];

  const result = queryKnowledgeRecords(records, "How does request routing work?");

  assert.deepEqual(result.map((item) => item.id), ["request-routing"]);
});

test("query ranks records with more matching question tokens first", () => {
  const records = [
    record("request-flow", "behavior-flow", "Request flow"),
    record("request-routing", "behavior-flow", "Request routing flow"),
  ];

  const result = queryKnowledgeRecords(records, "request routing flow");

  assert.deepEqual(result.map((item) => item.id), ["request-routing", "request-flow"]);
});

test("query does not use evidence snapshots or history as search text", () => {
  const evidenceOnly = record("unrelated", "entity", "Unrelated subject");
  evidenceOnly.activeEvidence = [{
    filePath: "src/request-routing.ts",
    lineStart: 1,
    snippet: "Request routing flow",
  }];
  evidenceOnly.history = [[{
    filePath: "src/old-request-routing.ts",
    lineStart: 1,
    snippet: "Request routing old flow",
  }]];

  const result = queryKnowledgeRecords([evidenceOnly], "request routing");

  assert.deepEqual(result, []);
});

test("repository query reads persisted knowledge before selecting records", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-knowledge-query-store-"));
  await writeKnowledgeRecord(repositoryRoot, record("request-routing", "behavior-flow", "Request routing flow"));
  await writeKnowledgeRecord(repositoryRoot, record("database-retry", "failure", "Database retry failure"));
  const queryModule = await import("../../../src/repository-knowledge/query.ts");

  assert.equal(typeof queryModule.queryRepositoryKnowledge, "function");
  const result = await queryModule.queryRepositoryKnowledge(repositoryRoot, "How does request routing work?");

  assert.deepEqual(result.map((item: KnowledgeRecord) => item.id), ["request-routing"]);
});
