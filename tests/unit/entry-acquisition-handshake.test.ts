import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runLegoraEntry } from "../../src/entry.ts";
import { writeKnowledgeRecord } from "../../src/repository-knowledge/store.ts";

const now = "2026-08-22T00:00:00.000Z";

async function seedRoutingKnowledge(repositoryRoot: string): Promise<void> {
  await fs.mkdir(path.join(repositoryRoot, "src"), { recursive: true });
  await fs.writeFile(path.join(repositoryRoot, "src", "route.ts"), "route();\n", "utf8");
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:route",
    kind: "entity:capability",
    subject: "route request",
    structure: { type: "ENTITY", entityKind: "capability", name: "route" },
    activeEvidence: [{ filePath: "src/route.ts", lineStart: 1, snippet: "route();", confidence: "INFERRED" }],
    history: [],
    createdAt: now,
    updatedAt: now,
  });
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:flow:routing",
    kind: "behavior-flow:routing",
    subject: "request routing",
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "routing",
      name: "Request routing",
      steps: [{ entityId: "native:entity:route", label: "Route" }],
    },
    activeEvidence: [{ filePath: "src/route.ts", lineStart: 1, snippet: "route();", confidence: "INFERRED" }],
    history: [],
    createdAt: now,
    updatedAt: now,
  });
}

test("missing knowledge returns an explicit acquire handshake without auto-analyzing the repository", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-entry-acquire-handshake-"));

  const result = await runLegoraEntry({ repositoryRoot, question: "request routing" });

  assert.equal(result.status, "KNOWLEDGE_NOT_FOUND");
  assert.deepEqual(result.nextAction, {
    type: "ACQUIRE_KNOWLEDGE",
    question: "request routing",
  });
});

test("stale selected knowledge returns only the affected record ids for refresh", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-entry-refresh-handshake-"));
  await seedRoutingKnowledge(repositoryRoot);
  await fs.writeFile(path.join(repositoryRoot, "src", "route.ts"), "changed();\n", "utf8");

  const result = await runLegoraEntry({ repositoryRoot, question: "request routing" });

  assert.equal(result.status, "KNOWLEDGE_STALE");
  assert.deepEqual(result.nextAction, {
    type: "REFRESH_KNOWLEDGE",
    question: "request routing",
    recordIds: ["native:entity:route", "native:flow:routing"],
  });
});

test("ready knowledge has no acquisition handshake", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-entry-ready-handshake-"));
  await seedRoutingKnowledge(repositoryRoot);

  const result = await runLegoraEntry({ repositoryRoot, question: "request routing" });

  assert.equal(result.status, "READY");
  assert.equal(result.nextAction, null);
});
