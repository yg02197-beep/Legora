import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeKnowledgeRecord } from "../../../src/repository-knowledge/store.ts";
import { runLegoraVerify } from "../../../src/verify/service.ts";
import type { KnowledgeRecord } from "../../../src/repository-knowledge/contracts.ts";

const NOW = "2026-08-22T00:00:00.000Z";

async function createVerifyFixture(): Promise<string> {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-verify-svc-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "auth.ts"), [
    "function refreshToken() {}",
    "const lockEnabled = true;",
    "function handleConcurrent() { return shared; }",
    "function handleDirect() { return individual; }",
    "invariant: token must be valid",
    "failure: token expired throws error",
  ].join("\n"), "utf8");

  const entityLock: KnowledgeRecord = {
    id: "native:entity:lock-guard",
    kind: "entity:invariant",
    subject: "Lock must be enabled",
    structure: { type: "ENTITY", entityKind: "invariant", name: "Lock must be enabled" },
    activeEvidence: [{
      filePath: "src/auth.ts", lineStart: 5, snippet: "invariant: token must be valid",
      confidence: "CONFIRMED", sourceConfidence: "proven",
    }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
  };

  const entityFailure: KnowledgeRecord = {
    id: "native:entity:token-expired",
    kind: "entity:failure-point",
    subject: "Token expired error",
    structure: { type: "ENTITY", entityKind: "failure-point", name: "Token expired error" },
    activeEvidence: [{
      filePath: "src/auth.ts", lineStart: 6, snippet: "failure: token expired throws error",
      confidence: "CONFIRMED", sourceConfidence: "proven",
    }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
  };

  const entityActor: KnowledgeRecord = {
    id: "native:entity:handler",
    kind: "entity:actor",
    subject: "Concurrent request handler",
    structure: { type: "ENTITY", entityKind: "actor", name: "Request handler" },
    activeEvidence: [{
      filePath: "src/auth.ts", lineStart: 1, snippet: "function refreshToken() {}",
      confidence: "CONFIRMED", sourceConfidence: "proven",
    }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
  };

  const entityState: KnowledgeRecord = {
    id: "native:entity:lock-state",
    kind: "entity:state",
    subject: "Lock enabled state",
    structure: { type: "ENTITY", entityKind: "state", name: "lockEnabled true" },
    activeEvidence: [{
      filePath: "src/auth.ts", lineStart: 2, snippet: "const lockEnabled = true;",
      confidence: "CONFIRMED", sourceConfidence: "proven",
    }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
  };

  const relGuards: KnowledgeRecord = {
    id: "native:rel:handler-guards-lock",
    kind: "relationship:guards",
    subject: "handler guards lock invariant",
    structure: {
      type: "RELATIONSHIP",
      relationshipKind: "guards",
      sourceId: "native:entity:handler",
      targetId: "native:entity:lock-guard",
    },
    activeEvidence: [{
      filePath: "src/auth.ts", lineStart: 3, snippet: "function handleConcurrent() { return shared; }",
      confidence: "CONFIRMED", sourceConfidence: "proven",
    }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
  };

  const relGuards2: KnowledgeRecord = {
    id: "native:rel:state-guards-lock",
    kind: "relationship:guards",
    subject: "state guards another invariant",
    structure: {
      type: "RELATIONSHIP",
      relationshipKind: "guards",
      sourceId: "native:entity:lock-state",
      targetId: "native:entity:lock-guard",
    },
    activeEvidence: [{
      filePath: "src/auth.ts", lineStart: 2, snippet: "const lockEnabled = true;",
      confidence: "CONFIRMED", sourceConfidence: "proven",
    }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
  };

  const relTriggers: KnowledgeRecord = {
    id: "native:rel:handler-triggers-failure",
    kind: "relationship:triggers",
    subject: "handler triggers token expired",
    structure: {
      type: "RELATIONSHIP",
      relationshipKind: "triggers",
      sourceId: "native:entity:handler",
      targetId: "native:entity:token-expired",
    },
    activeEvidence: [{
      filePath: "src/auth.ts", lineStart: 4, snippet: "function handleDirect() { return individual; }",
      confidence: "CONFIRMED", sourceConfidence: "proven",
    }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
  };

  const flowRecord: KnowledgeRecord = {
    id: "native:flow:auth-enforcement",
    kind: "behavior-flow:flow",
    subject: "Authentication enforcement",
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "flow",
      name: "Authentication enforcement",
      steps: [
        { entityId: "native:entity:handler", label: "Handle concurrent requests" },
        { entityId: "native:entity:lock-state", label: "Check lock state" },
      ],
    },
    activeEvidence: [{
      filePath: "src/auth.ts", lineStart: 1, snippet: "function refreshToken() {}",
      confidence: "CONFIRMED", sourceConfidence: "proven",
    }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
  };

  for (const record of [entityLock, entityFailure, entityActor, entityState, relGuards, relGuards2, relTriggers, flowRecord]) {
    await writeKnowledgeRecord(repositoryRoot, record);
  }

  return repositoryRoot;
}

test("valid flow record with constraints and failures produces CHALLENGE_READY", async () => {
  const repositoryRoot = await createVerifyFixture();
  const result = await runLegoraVerify({ repositoryRoot, flowRecordId: "native:flow:auth-enforcement" });

  assert.equal(result.status, "CHALLENGE_READY");
  assert.ok(result.challenge);
  assert.ok(result.challenge.prompt.choices.length >= 2);
  assert.ok(result.evidenceClaims);
  assert.ok(result.evidenceClaims.length > 0);
});

test("answering correctly returns CORRECT", async () => {
  const repositoryRoot = await createVerifyFixture();
  const challengeResult = await runLegoraVerify({ repositoryRoot, flowRecordId: "native:flow:auth-enforcement" });
  assert.equal(challengeResult.status, "CHALLENGE_READY");

  const correctId = challengeResult.challenge!.expectedChoiceId;
  const result = await runLegoraVerify({ repositoryRoot, flowRecordId: "native:flow:auth-enforcement", answerId: correctId });

  assert.equal(result.status, "CORRECT");
  assert.equal(result.predictionResult!.result, "CORRECT");
});

test("answering incorrectly returns INCORRECT", async () => {
  const repositoryRoot = await createVerifyFixture();
  const challengeResult = await runLegoraVerify({ repositoryRoot, flowRecordId: "native:flow:auth-enforcement" });
  assert.equal(challengeResult.status, "CHALLENGE_READY");

  const wrongChoice = challengeResult.challenge!.prompt.choices.find(
    (c) => c.id !== challengeResult.challenge!.expectedChoiceId,
  )!;
  const result = await runLegoraVerify({ repositoryRoot, flowRecordId: "native:flow:auth-enforcement", answerId: wrongChoice.id });

  assert.equal(result.status, "INCORRECT");
  assert.equal(result.predictionResult!.result, "INCORRECT");
});

test("non-existent record returns NOT_FOUND", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-verify-notfound-"));
  const result = await runLegoraVerify({ repositoryRoot, flowRecordId: "native:flow:missing" });

  assert.equal(result.status, "NOT_FOUND");
});

test("non-flow record returns NOT_FLOW", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-verify-notflow-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "x.ts"), "x();\n", "utf8");
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:something",
    kind: "entity:capability",
    subject: "something",
    structure: { type: "ENTITY", entityKind: "capability", name: "something" },
    activeEvidence: [{ filePath: "src/x.ts", lineStart: 1, snippet: "x();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
  });

  const result = await runLegoraVerify({ repositoryRoot, flowRecordId: "native:entity:something" });
  assert.equal(result.status, "NOT_FLOW");
});

test("stale freshness returns STALE", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-verify-stale-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "old.ts"), "changed();\n", "utf8");
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:actor",
    kind: "entity:actor",
    subject: "actor",
    structure: { type: "ENTITY", entityKind: "actor", name: "actor" },
    activeEvidence: [{ filePath: "src/old.ts", lineStart: 1, snippet: "original();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
  });
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:flow:stale-flow",
    kind: "behavior-flow:flow",
    subject: "stale flow",
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "flow",
      name: "Stale flow",
      steps: [{ entityId: "native:entity:actor", label: "Do something" }],
    },
    activeEvidence: [{ filePath: "src/old.ts", lineStart: 1, snippet: "original();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
  });

  const result = await runLegoraVerify({ repositoryRoot, flowRecordId: "native:flow:stale-flow" });
  assert.equal(result.status, "STALE");
});

test("insufficient evidence (no constraints or failures) returns INSUFFICIENT_EVIDENCE", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-verify-noev-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "simple.ts"), "simple();\n", "utf8");
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:simple-actor",
    kind: "entity:actor",
    subject: "simple actor",
    structure: { type: "ENTITY", entityKind: "actor", name: "simple actor" },
    activeEvidence: [{ filePath: "src/simple.ts", lineStart: 1, snippet: "simple();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
  });
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:flow:simple-flow",
    kind: "behavior-flow:flow",
    subject: "simple flow",
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "flow",
      name: "Simple flow",
      steps: [{ entityId: "native:entity:simple-actor", label: "Do something" }],
    },
    activeEvidence: [{ filePath: "src/simple.ts", lineStart: 1, snippet: "simple();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
  });

  const result = await runLegoraVerify({ repositoryRoot, flowRecordId: "native:flow:simple-flow" });
  assert.equal(result.status, "INSUFFICIENT_EVIDENCE");
});

test("invalid choice ID returns INVALID_CHOICE", async () => {
  const repositoryRoot = await createVerifyFixture();
  const result = await runLegoraVerify({
    repositoryRoot,
    flowRecordId: "native:flow:auth-enforcement",
    answerId: "choice:nonexistent",
  });

  assert.equal(result.status, "INVALID_CHOICE");
  assert.ok(result.reason);
  assert.match(result.reason!, /nonexistent/);
});
