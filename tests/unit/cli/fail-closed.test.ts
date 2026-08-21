import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCliCommand } from "../../../src/cli/index.ts";
import { writeKnowledgeRecord } from "../../../src/repository-knowledge/store.ts";

test("knowledge query returns exit code 3 when no knowledge matches", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-missing-"));

  const result = await runCliCommand(["knowledge", "query", "missing", "topic"], repositoryRoot);

  assert.equal(result.exitCode, 3);
  assert.equal(result.data.status, "KNOWLEDGE_NOT_FOUND");
  assert.deepEqual(result.data.records, []);
});

test("knowledge status returns UNKNOWN with exit code 5 when active evidence cannot be checked", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-unknown-"));
  const now = "2026-08-22T00:00:00.000Z";
  await writeKnowledgeRecord(repositoryRoot, {
    id: "knowledge:unknown",
    kind: "entity:capability",
    subject: "unknown evidence",
    activeEvidence: [{ filePath: "src/unknown.ts", lineStart: 1 }],
    history: [],
    createdAt: now,
    updatedAt: now,
  });

  const result = await runCliCommand(["knowledge", "status"], repositoryRoot);

  assert.equal(result.exitCode, 5);
  assert.equal(result.data.status, "UNKNOWN");
  assert.equal(result.data.counts.unknown, 1);
});

test("entry maps missing repository knowledge to exit code 3 without provider fallback", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-entry-missing-"));

  const result = await runCliCommand(["entry", "where", "is", "routing"], repositoryRoot);

  assert.equal(result.exitCode, 3);
  assert.equal(result.data.status, "KNOWLEDGE_NOT_FOUND");
});
