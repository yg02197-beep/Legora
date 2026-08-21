import test from "node:test";
import assert from "node:assert/strict";
import type { KnowledgeRecord } from "../../../src/repository-knowledge/contracts.ts";
import { queryKnowledgeRecords } from "../../../src/repository-knowledge/query.ts";

function record(id: string, kind: string, subject: string): KnowledgeRecord {
  return {
    id,
    kind,
    subject,
    activeEvidence: [],
    history: [],
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
  };
}

test("query tolerates simple Korean particles and suffixes without a language-specific analyzer", () => {
  const records = [
    record("request-routing", "behavior-flow", "요청 라우팅 흐름"),
    record("database-retry", "failure", "데이터베이스 재시도 실패"),
  ];

  const result = queryKnowledgeRecords(records, "요청은 어떻게 라우팅됩니까?");

  assert.deepEqual(result.map((item) => item.id), ["request-routing"]);
});
