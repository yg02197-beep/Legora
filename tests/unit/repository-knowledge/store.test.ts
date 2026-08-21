import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  promoteKnowledgeEvidence,
  readKnowledgeRecords,
  writeKnowledgeRecord,
} from "../../../src/repository-knowledge/store.ts";

test("repository knowledge store is empty when no persistent store exists yet", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-knowledge-store-empty-"));

  const records = await readKnowledgeRecords(repositoryRoot);

  assert.deepEqual(records, []);
});

test("repository knowledge store persists a record under the repository root", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-knowledge-store-write-"));
  const record = {
    id: "knowledge:fixture",
    kind: "behavior-flow",
    subject: "Fixture behavior",
    activeEvidence: [{ filePath: "src/fixture.ts", lineStart: 1, snippet: "fixture" }],
    history: [],
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
  };

  await writeKnowledgeRecord(repositoryRoot, record);

  assert.deepEqual(await readKnowledgeRecords(repositoryRoot), [record]);
});

test("promoting evidence moves the previous active evidence into history", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-knowledge-store-promote-"));
  const record = {
    id: "knowledge:fixture",
    kind: "behavior-flow",
    subject: "Fixture behavior",
    activeEvidence: [{ filePath: "src/old.ts", lineStart: 1, snippet: "old" }],
    history: [],
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
  };
  const nextEvidence = [{ filePath: "src/current.ts", lineStart: 2, snippet: "current" }];
  await writeKnowledgeRecord(repositoryRoot, record);

  const promoted = await promoteKnowledgeEvidence(
    repositoryRoot,
    record.id,
    nextEvidence,
    "2026-08-22T00:10:00.000Z",
  );

  assert.deepEqual(promoted.activeEvidence, nextEvidence);
  assert.deepEqual(promoted.history, [record.activeEvidence]);
  assert.equal(promoted.createdAt, record.createdAt);
  assert.equal(promoted.updatedAt, "2026-08-22T00:10:00.000Z");
  assert.deepEqual(await readKnowledgeRecords(repositoryRoot), [promoted]);
});

test("repository knowledge store rejects a non-array persistent document", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-knowledge-store-invalid-"));
  const storeDirectory = path.join(repositoryRoot, ".legora");
  await fs.mkdir(storeDirectory);
  await fs.writeFile(path.join(storeDirectory, "repository-knowledge.json"), "{}\n", "utf8");

  await assert.rejects(
    () => readKnowledgeRecords(repositoryRoot),
    /Repository knowledge store must contain a record array/,
  );
});
