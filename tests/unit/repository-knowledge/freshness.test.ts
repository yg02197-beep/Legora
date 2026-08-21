import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkKnowledgeRecordFreshness } from "../../../src/repository-knowledge/freshness.ts";
import type { KnowledgeRecord } from "../../../src/repository-knowledge/contracts.ts";

function recordWithEvidence(
  activeEvidence: KnowledgeRecord["activeEvidence"],
  history: KnowledgeRecord["history"] = [],
): KnowledgeRecord {
  return {
    id: "knowledge:fixture",
    kind: "behavior-flow",
    subject: "Fixture behavior",
    activeEvidence,
    history,
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:10:00.000Z",
  };
}

test("freshness checks only active evidence and ignores stale history", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-knowledge-freshness-active-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "fixture.ts"), "zero\ncurrent\n", "utf8");
  const record = recordWithEvidence(
    [{ filePath: "src/fixture.ts", lineStart: 2, snippet: "current" }],
    [[{ filePath: "src/fixture.ts", lineStart: 2, snippet: "old" }]],
  );

  const result = await checkKnowledgeRecordFreshness(repositoryRoot, record);

  assert.equal(result.status, "CURRENT");
  assert.equal(result.checkedAnchors, 1);
  assert.deepEqual(result.issues, []);
});

test("freshness marks a record STALE when an active evidence file was removed", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-knowledge-freshness-missing-"));
  const record = recordWithEvidence([
    { filePath: "src/missing.ts", lineStart: 1, snippet: "missing" },
  ]);

  const result = await checkKnowledgeRecordFreshness(repositoryRoot, record);

  assert.equal(result.status, "STALE");
  assert.equal(result.checkedAnchors, 0);
  assert.equal(result.issues[0]?.code, "EVIDENCE_FILE_MISSING");
});

test("freshness never reads active evidence paths outside the repository root", async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "legora-knowledge-freshness-boundary-"));
  const repositoryRoot = path.join(parent, "repo");
  await fs.mkdir(repositoryRoot);
  await fs.writeFile(path.join(parent, "outside.ts"), "outside\n", "utf8");
  const record = recordWithEvidence([
    { filePath: "../outside.ts", lineStart: 1, snippet: "outside" },
  ]);

  const result = await checkKnowledgeRecordFreshness(repositoryRoot, record);

  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.checkedAnchors, 0);
  assert.equal(result.issues[0]?.code, "EVIDENCE_PATH_OUTSIDE_REPOSITORY");
});

test("freshness is UNKNOWN when active evidence has no snapshot snippet", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-knowledge-freshness-no-snippet-"));
  const record = recordWithEvidence([
    { filePath: "src/fixture.ts", lineStart: 1 },
  ]);

  const result = await checkKnowledgeRecordFreshness(repositoryRoot, record);

  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.checkedAnchors, 0);
  assert.equal(result.issues[0]?.code, "EVIDENCE_SNAPSHOT_UNAVAILABLE");
});

test("freshness marks a record STALE when active evidence content changed", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-knowledge-freshness-changed-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "fixture.ts"), "zero\nchanged\n", "utf8");
  const record = recordWithEvidence([
    { filePath: "src/fixture.ts", lineStart: 2, snippet: "current" },
  ]);

  const result = await checkKnowledgeRecordFreshness(repositoryRoot, record);

  assert.equal(result.status, "STALE");
  assert.equal(result.checkedAnchors, 1);
  assert.equal(result.issues[0]?.code, "EVIDENCE_CONTENT_CHANGED");
});

test("freshness normalizes CRLF and LF before comparing active evidence", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-knowledge-freshness-newlines-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "fixture.ts"), "zero\r\none\r\ntwo\r\n", "utf8");
  const record = recordWithEvidence([
    { filePath: "src/fixture.ts", lineStart: 2, lineEnd: 3, snippet: "one\ntwo" },
  ]);

  const result = await checkKnowledgeRecordFreshness(repositoryRoot, record);

  assert.equal(result.status, "CURRENT");
  assert.equal(result.checkedAnchors, 1);
});

test("freshness is UNKNOWN when active evidence is empty", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-knowledge-freshness-empty-"));

  const result = await checkKnowledgeRecordFreshness(repositoryRoot, recordWithEvidence([]));

  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.checkedAnchors, 0);
  assert.equal(result.issues[0]?.code, "EVIDENCE_SURFACE_UNCHECKABLE");
});
