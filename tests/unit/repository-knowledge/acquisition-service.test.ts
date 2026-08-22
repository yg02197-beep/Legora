import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { KnowledgeAcquisitionProposal } from "../../../src/repository-knowledge/acquisition-contracts.ts";
import { acquireRepositoryKnowledge } from "../../../src/repository-knowledge/acquisition-service.ts";
import { readKnowledgeRecords, writeKnowledgeRecord } from "../../../src/repository-knowledge/store.ts";

function entityProposal(filePath = "src/service.ts"): KnowledgeAcquisitionProposal {
  return {
    candidates: [{
      id: "native:entity:service",
      kind: "entity:service",
      subject: "service entry point",
      structure: { type: "ENTITY", entityKind: "service", name: "service" },
      evidenceLocators: [{ filePath, lineStart: 2, lineEnd: 3 }],
    }],
  };
}

test("native acquisition captures repository evidence and persists inferred knowledge", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-acquisition-service-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "service.ts"), "zero\none\ntwo\nthree\n", "utf8");

  const result = await acquireRepositoryKnowledge({ repositoryRoot, proposal: entityProposal() });

  assert.equal(result.status, "ACQUIRED");
  assert.deepEqual(result.recordIds, ["native:entity:service"]);
  const [stored] = await readKnowledgeRecords(repositoryRoot);
  assert.equal(stored?.activeEvidence[0]?.snippet, "one\ntwo");
  assert.equal(stored?.activeEvidence[0]?.confidence, "INFERRED");
  assert.equal(stored?.activeEvidence[0]?.sourceConfidence, "repository-captured");
  assert.equal(stored?.activeEvidence[0]?.provenance, "legora-native-acquisition");
  assert.equal(stored?.createdAt, stored?.updatedAt);
});

test("one invalid evidence locator rejects the whole batch without partial persistence", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-acquisition-service-batch-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "service.ts"), "service();\n", "utf8");
  const proposal: KnowledgeAcquisitionProposal = {
    candidates: [
      {
        id: "native:entity:good",
        kind: "entity:service",
        subject: "good",
        structure: { type: "ENTITY", entityKind: "service" },
        evidenceLocators: [{ filePath: "src/service.ts", lineStart: 1 }],
      },
      {
        id: "native:entity:bad",
        kind: "entity:service",
        subject: "bad",
        structure: { type: "ENTITY", entityKind: "service" },
        evidenceLocators: [{ filePath: "../outside.ts", lineStart: 1 }],
      },
    ],
  };

  const result = await acquireRepositoryKnowledge({ repositoryRoot, proposal });

  assert.equal(result.status, "REJECTED");
  assert.equal(result.code, "EVIDENCE_CAPTURE_FAILED");
  assert.deepEqual(await readKnowledgeRecords(repositoryRoot), []);
});

test("incremental acquisition preserves createdAt and promotes changed ACTIVE evidence into HISTORY", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-acquisition-service-update-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "service.ts"), "zero\none\ntwo\n", "utf8");
  const existing = {
    id: "native:entity:service",
    kind: "entity:service",
    subject: "old service",
    structure: { type: "ENTITY" as const, entityKind: "service" },
    activeEvidence: [{ filePath: "src/service.ts", lineStart: 1, snippet: "zero" }],
    history: [],
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
  };
  await writeKnowledgeRecord(repositoryRoot, existing);

  const result = await acquireRepositoryKnowledge({ repositoryRoot, proposal: entityProposal() });

  assert.equal(result.status, "ACQUIRED");
  const [updated] = await readKnowledgeRecords(repositoryRoot);
  assert.equal(updated?.createdAt, existing.createdAt);
  assert.notEqual(updated?.updatedAt, existing.updatedAt);
  assert.deepEqual(updated?.history, [existing.activeEvidence]);
  assert.equal(updated?.activeEvidence[0]?.snippet, "one\ntwo");
  assert.equal(updated?.subject, "service entry point");
});

test("incremental acquisition does not duplicate HISTORY when ACTIVE evidence is unchanged", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-acquisition-service-same-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "service.ts"), "zero\none\ntwo\n", "utf8");
  const initialResult = await acquireRepositoryKnowledge({ repositoryRoot, proposal: entityProposal() });
  assert.equal(initialResult.status, "ACQUIRED");
  const [initial] = await readKnowledgeRecords(repositoryRoot);

  const secondResult = await acquireRepositoryKnowledge({ repositoryRoot, proposal: entityProposal() });

  assert.equal(secondResult.status, "ACQUIRED");
  const [updated] = await readKnowledgeRecords(repositoryRoot);
  assert.deepEqual(updated?.history, []);
  assert.equal(updated?.createdAt, initial?.createdAt);
});

test("acquisition returns existing knowledge instead of creating a semantic duplicate under a new id", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-acquisition-duplicate-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "retry.ts"), "retry();\n", "utf8");
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:download-retry",
    kind: "entity:capability",
    subject: "download retry coordinator",
    structure: {
      type: "ENTITY",
      entityKind: "capability",
      name: "Download retry coordinator",
      description: "Chooses whether a failed download retries or stops",
    },
    activeEvidence: [{ filePath: "src/retry.ts", lineStart: 1, snippet: "retry();" }],
    history: [],
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
  });
  const proposal: KnowledgeAcquisitionProposal = {
    candidates: [{
      id: "native:entity:retry-decision",
      kind: "entity:capability",
      subject: "download retries coordinator",
      structure: {
        type: "ENTITY",
        entityKind: "capability",
        name: "Download retry coordinator",
      },
      evidenceLocators: [{ filePath: "src/retry.ts", lineStart: 1 }],
    }],
  };

  const result = await acquireRepositoryKnowledge({ repositoryRoot, proposal });

  assert.equal(result.status, "EXISTING_KNOWLEDGE");
  assert.equal(result.code, "EXISTING_KNOWLEDGE_CANDIDATE");
  assert.deepEqual(result.existingRecordIds, ["native:entity:download-retry"]);
  assert.deepEqual((await readKnowledgeRecords(repositoryRoot)).map((record) => record.id), [
    "native:entity:download-retry",
  ]);
});

test("evidence overlap alone does not block distinct knowledge acquisition", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-acquisition-distinct-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "service.ts"), "service();\n", "utf8");
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:service",
    kind: "entity:service",
    subject: "service entry point",
    structure: { type: "ENTITY", entityKind: "service", name: "service" },
    activeEvidence: [{ filePath: "src/service.ts", lineStart: 1, snippet: "service();" }],
    history: [],
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
  });
  const proposal: KnowledgeAcquisitionProposal = {
    candidates: [{
      id: "native:entity:logger",
      kind: "entity:logger",
      subject: "audit logger",
      structure: { type: "ENTITY", entityKind: "logger", name: "audit logger" },
      evidenceLocators: [{ filePath: "src/service.ts", lineStart: 1 }],
    }],
  };

  const result = await acquireRepositoryKnowledge({ repositoryRoot, proposal });

  assert.equal(result.status, "ACQUIRED");
  assert.equal((await readKnowledgeRecords(repositoryRoot)).length, 2);
});

test("concurrent different-id duplicates are rechecked inside the atomic transaction", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-acquisition-concurrent-duplicate-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "service.ts"), "service();\n", "utf8");
  const proposal = (id: string): KnowledgeAcquisitionProposal => ({
    candidates: [{
      id,
      kind: "entity:service",
      subject: "service entry point",
      structure: { type: "ENTITY", entityKind: "service", name: "service" },
      evidenceLocators: [{ filePath: "src/service.ts", lineStart: 1 }],
    }],
  });

  const results = await Promise.all([
    acquireRepositoryKnowledge({ repositoryRoot, proposal: proposal("native:entity:service-a") }),
    acquireRepositoryKnowledge({ repositoryRoot, proposal: proposal("native:entity:service-b") }),
  ]);

  assert.equal(results.filter((result) => result.status === "ACQUIRED").length, 1);
  assert.equal(results.filter((result) => result.status === "EXISTING_KNOWLEDGE").length, 1);
  assert.equal((await readKnowledgeRecords(repositoryRoot)).length, 1);
});

test("structurally invalid proposals fail before repository publication", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-acquisition-service-invalid-"));
  const proposal: KnowledgeAcquisitionProposal = {
    candidates: [{
      id: "native:flow:bad",
      kind: "behavior-flow:bad",
      subject: "bad flow",
      structure: {
        type: "BEHAVIOR_FLOW",
        flowKind: "bad",
        name: "Bad",
        steps: [{ entityId: "native:entity:missing" }],
      },
      evidenceLocators: [{ filePath: "src/missing.ts", lineStart: 1 }],
    }],
  };

  const result = await acquireRepositoryKnowledge({ repositoryRoot, proposal });

  assert.equal(result.status, "REJECTED");
  assert.equal(result.code, "STRUCTURE_INVALID");
  assert.equal(result.validation.issues[0]?.code, "REFERENCE_ENTITY_NOT_FOUND");
  assert.deepEqual(await readKnowledgeRecords(repositoryRoot), []);
});

test("concurrent refreshes of the same record preserve every accepted ACTIVE revision in HISTORY", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-acquisition-service-concurrent-same-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  const lines = Array.from({ length: 12 }, (_, index) => `line-${index + 1}`);
  await fs.writeFile(path.join(repositoryRoot, "src", "service.ts"), `${lines.join("\n")}\n`, "utf8");

  const results = await Promise.all(lines.map((_, index) => acquireRepositoryKnowledge({
    repositoryRoot,
    proposal: {
      candidates: [{
        id: "native:entity:service",
        kind: "entity:service",
        subject: "service entry point",
        structure: { type: "ENTITY", entityKind: "service", name: "service" },
        evidenceLocators: [{ filePath: "src/service.ts", lineStart: index + 1 }],
      }],
    },
  })));

  assert.equal(results.every((result) => result.status === "ACQUIRED"), true);
  const [stored] = await readKnowledgeRecords(repositoryRoot);
  assert.equal(stored?.history.length, lines.length - 1);
  const observed = [
    ...(stored?.history.map((evidence) => evidence[0]?.snippet) ?? []),
    stored?.activeEvidence[0]?.snippet,
  ].filter((value): value is string => value !== undefined).sort();
  assert.deepEqual(observed, [...lines].sort());
});
