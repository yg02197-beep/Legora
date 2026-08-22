import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { KnowledgeRecord } from "../../../src/repository-knowledge/contracts.ts";
import {
  readKnowledgeRecords,
  upsertKnowledgeRecordsAtomic,
  writeKnowledgeRecord,
} from "../../../src/repository-knowledge/store.ts";

const now = "2026-08-22T00:00:00.000Z";

function record(id: string, subject = id): KnowledgeRecord {
  return {
    id,
    kind: "entity:fixture",
    subject,
    structure: { type: "ENTITY", entityKind: "fixture", name: subject },
    activeEvidence: [{ filePath: `src/${id}.ts`, lineStart: 1, snippet: `${id}();` }],
    history: [],
    createdAt: now,
    updatedAt: now,
  };
}

test("atomic batch upsert publishes all records together without dropping unrelated knowledge", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-atomic-store-"));
  const existing = record("existing", "old");
  await writeKnowledgeRecord(repositoryRoot, existing);

  const updated = record("existing", "updated");
  const added = record("added");
  await upsertKnowledgeRecordsAtomic(repositoryRoot, [updated, added]);

  assert.deepEqual(await readKnowledgeRecords(repositoryRoot), [updated, added]);
});

test("duplicate ids in one atomic batch fail before publication and preserve the old store", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-atomic-store-duplicate-"));
  const existing = record("existing", "old");
  await writeKnowledgeRecord(repositoryRoot, existing);

  await assert.rejects(
    () => upsertKnowledgeRecordsAtomic(repositoryRoot, [record("duplicate", "a"), record("duplicate", "b")]),
    /Duplicate knowledge record id in atomic batch: duplicate/,
  );

  assert.deepEqual(await readKnowledgeRecords(repositoryRoot), [existing]);
});

test("atomic publication leaves no temporary store file after success", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-atomic-store-temp-"));

  await upsertKnowledgeRecordsAtomic(repositoryRoot, [record("one"), record("two")]);

  const entries = await fs.readdir(path.join(repositoryRoot, ".legora"));
  assert.deepEqual(entries, ["repository-knowledge.json"]);
});

test("transient Windows EPERM while acquiring a vanished lock is retried", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-atomic-store-eperm-"));
  const originalOpen = fs.open;
  let injected = false;

  (fs as any).open = async (...args: Parameters<typeof fs.open>) => {
    const [filePath, flags] = args;
    if (!injected
      && flags === "wx"
      && String(filePath).endsWith(".repository-knowledge.lock")) {
      injected = true;
      const error = new Error("injected transient lock contention") as NodeJS.ErrnoException;
      error.code = "EPERM";
      throw error;
    }
    return originalOpen(...args);
  };

  try {
    await upsertKnowledgeRecordsAtomic(repositoryRoot, [record("after-eperm")]);
  } finally {
    (fs as any).open = originalOpen;
  }

  assert.equal(injected, true);
  assert.deepEqual((await readKnowledgeRecords(repositoryRoot)).map((item) => item.id), ["after-eperm"]);
});

test("concurrent atomic upserts preserve records from every writer", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-atomic-store-concurrent-"));
  const records = Array.from({ length: 12 }, (_, index) => record(`writer-${index}`));

  await Promise.all(records.map((item) => upsertKnowledgeRecordsAtomic(repositoryRoot, [item])));

  const storedIds = (await readKnowledgeRecords(repositoryRoot))
    .map((item) => item.id)
    .sort();
  assert.deepEqual(storedIds, records.map((item) => item.id).sort());
});
