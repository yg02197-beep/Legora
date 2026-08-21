import test from "node:test";
import assert from "node:assert/strict";
import type {
  KnowledgeEvidenceSet,
  KnowledgeRecord,
} from "../../../src/repository-knowledge/contracts.ts";

test("KnowledgeRecord keeps active evidence separate from historical evidence revisions", () => {
  const previousEvidence = [
    {
      filePath: "src/old.ts",
      lineStart: 1,
      lineEnd: 1,
      snippet: "export const value = 'old';",
    },
  ] satisfies KnowledgeEvidenceSet;

  const activeEvidence = [
    {
      filePath: "src/current.ts",
      lineStart: 2,
      lineEnd: 2,
      snippet: "export const value = 'current';",
    },
  ] satisfies KnowledgeEvidenceSet;

  const record = {
    id: "knowledge:fixture",
    kind: "behavior-flow",
    subject: "Fixture behavior",
    activeEvidence,
    history: [previousEvidence],
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:10:00.000Z",
  } satisfies KnowledgeRecord;

  assert.deepEqual(record.activeEvidence, activeEvidence);
  assert.deepEqual(record.history, [previousEvidence]);
  assert.notStrictEqual(record.activeEvidence, record.history[0]);
});
