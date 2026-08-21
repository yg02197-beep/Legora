import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCliCommand } from "../../../src/cli/index.ts";
import { writeKnowledgeRecord } from "../../../src/repository-knowledge/store.ts";

async function repositoryFixture() {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-"));
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

test("entry command returns the Legora-native entry result as JSON data", async () => {
  const repositoryRoot = await repositoryFixture();

  const result = await runCliCommand(["entry", "How", "does", "request", "routing", "work?"], repositoryRoot);

  assert.equal(result.exitCode, 0);
  assert.equal(result.data.command, "entry");
  assert.equal(result.data.status, "READY");
  assert.equal(result.data.behaviorSlice.owner, "LEGORA");
});

test("knowledge query returns matched records with current freshness", async () => {
  const repositoryRoot = await repositoryFixture();

  const result = await runCliCommand(["knowledge", "query", "request", "routing"], repositoryRoot);

  assert.equal(result.exitCode, 0);
  assert.equal(result.data.command, "knowledge query");
  assert.equal(result.data.status, "CURRENT");
  assert.ok(result.data.records.some((item: any) => item.record.id === "knowledge:flow:routing"));
  assert.ok(result.data.records.every((item: any) => item.freshness.status === "CURRENT"));
});

test("knowledge status returns STALE with a fail-closed exit code when any active evidence changed", async () => {
  const repositoryRoot = await repositoryFixture();
  await fs.writeFile(path.join(repositoryRoot, "src", "route.ts"), "changed();\n", "utf8");

  const result = await runCliCommand(["knowledge", "status"], repositoryRoot);

  assert.equal(result.exitCode, 4);
  assert.equal(result.data.command, "knowledge status");
  assert.equal(result.data.status, "STALE");
  assert.equal(result.data.counts.stale, 2);
});

test("invalid command returns usage data and exit code 2", async () => {
  const repositoryRoot = await repositoryFixture();

  const result = await runCliCommand(["unknown"], repositoryRoot);

  assert.equal(result.exitCode, 2);
  assert.equal(result.data.status, "USAGE_ERROR");
  assert.match(result.data.usage, /legora entry <question>/);
});
