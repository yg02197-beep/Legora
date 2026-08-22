import test from "node:test";
import assert from "node:assert/strict";
import type { KnowledgeRecord } from "../../../src/repository-knowledge/contracts.ts";
import {
  queryKnowledgeRecordMatches,
  queryKnowledgeRecords,
} from "../../../src/repository-knowledge/query.ts";

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

test("query bridges common Korean and English control-flow terminology", () => {
  const records = [
    record("native:flow:download-fallback-chain", "behavior-flow:routing", "Download fallback retry policy"),
    record("native:flow:upload-cache", "behavior-flow:routing", "Upload cache policy"),
  ];

  const result = queryKnowledgeRecords(records, "실패하면 재시도 대신 다음 방식으로 넘어가?");

  assert.deepEqual(result.map((item) => item.id), ["native:flow:download-fallback-chain"]);
});

test("query marks a single cross-language concept hit as a candidate rather than a strong match", () => {
  const matches = queryKnowledgeRecordMatches(
    [record("native:flow:download-retry", "behavior-flow:routing", "Download retry policy")],
    "재시도?",
  );

  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.confidence, "CANDIDATE");
  assert.deepEqual(matches[0]?.conceptMatches, ["concept:retry"]);
});
