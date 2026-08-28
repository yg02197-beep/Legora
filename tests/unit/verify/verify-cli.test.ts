import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCliCommand } from "../../../src/cli/index.ts";
import { writeKnowledgeRecord } from "../../../src/repository-knowledge/store.ts";
import type { KnowledgeRecord } from "../../../src/repository-knowledge/contracts.ts";

const NOW = "2026-08-22T00:00:00.000Z";

async function createVerifyCliFixture(): Promise<string> {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-verify-cli-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "auth.ts"), [
    "function refreshToken() {}",
    "const lockEnabled = true;",
    "function handleConcurrent() { return shared; }",
    "function handleDirect() { return individual; }",
    "invariant: token must be valid",
    "failure: token expired throws error",
  ].join("\n"), "utf8");

  const records: KnowledgeRecord[] = [
    {
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
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
      id: "native:rel:state-guards-lock",
      kind: "relationship:guards",
      subject: "state guards lock invariant",
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
    },
    {
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
    },
    {
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
    },
  ];

  for (const record of records) {
    await writeKnowledgeRecord(repositoryRoot, record);
  }

  return repositoryRoot;
}

test("verify command with valid flow record returns exit 0 and human-readable stdout", async () => {
  const repositoryRoot = await createVerifyCliFixture();
  const result = await runCliCommand(["verify", "native:flow:auth-enforcement"], repositoryRoot);

  assert.equal(result.exitCode, 0);
  assert.equal(result.data.command, "verify");
  assert.equal(result.data.status, "CHALLENGE_READY");
  assert.ok(result.stdout);
  assert.match(result.stdout, /Verify:/);
  assert.match(result.stdout, /조건:/);
  assert.match(result.stdout, /질문:/);
});

test("verify --json returns structured data with no stdout", async () => {
  const repositoryRoot = await createVerifyCliFixture();
  const result = await runCliCommand(["verify", "--json", "native:flow:auth-enforcement"], repositoryRoot);

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, undefined);
  assert.equal(result.data.command, "verify");
  assert.equal(result.data.status, "CHALLENGE_READY");
  assert.ok(result.data.challenge);
});

test("verify --answer with correct choice returns exit 0", async () => {
  const repositoryRoot = await createVerifyCliFixture();
  const challengeResult = await runCliCommand(["verify", "--json", "native:flow:auth-enforcement"], repositoryRoot);
  const correctId = challengeResult.data.challenge.expectedChoiceId;

  const result = await runCliCommand(["verify", "--answer", correctId, "native:flow:auth-enforcement"], repositoryRoot);

  assert.equal(result.exitCode, 0);
  assert.equal(result.data.status, "CORRECT");
  assert.ok(result.stdout);
  assert.match(result.stdout, /CORRECT/);
});

test("verify --answer with wrong choice returns exit 1", async () => {
  const repositoryRoot = await createVerifyCliFixture();
  const challengeResult = await runCliCommand(["verify", "--json", "native:flow:auth-enforcement"], repositoryRoot);
  const wrongChoice = challengeResult.data.challenge.prompt.choices.find(
    (c: any) => c.id !== challengeResult.data.challenge.expectedChoiceId,
  );

  const result = await runCliCommand(["verify", "--answer", wrongChoice.id, "native:flow:auth-enforcement"], repositoryRoot);

  assert.equal(result.exitCode, 1);
  assert.equal(result.data.status, "INCORRECT");
  assert.ok(result.stdout);
  assert.match(result.stdout, /INCORRECT/);
});

test("verify with non-existent record returns exit 3", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-verify-cli-miss-"));
  const result = await runCliCommand(["verify", "native:flow:missing"], repositoryRoot);

  assert.equal(result.exitCode, 3);
  assert.equal(result.data.status, "NOT_FOUND");
});

test("verify with stale knowledge returns exit 4", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-verify-cli-stale-"));
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
    id: "native:flow:stale",
    kind: "behavior-flow:flow",
    subject: "stale",
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "flow",
      name: "Stale",
      steps: [{ entityId: "native:entity:actor", label: "step" }],
    },
    activeEvidence: [{ filePath: "src/old.ts", lineStart: 1, snippet: "original();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
  });

  const result = await runCliCommand(["verify", "native:flow:stale"], repositoryRoot);
  assert.equal(result.exitCode, 4);
  assert.equal(result.data.status, "STALE");
});

test("verify with insufficient evidence returns exit 6", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-verify-cli-noev-"));
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
    id: "native:flow:simple",
    kind: "behavior-flow:flow",
    subject: "simple",
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "flow",
      name: "Simple",
      steps: [{ entityId: "native:entity:simple-actor", label: "do" }],
    },
    activeEvidence: [{ filePath: "src/simple.ts", lineStart: 1, snippet: "simple();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
  });

  const result = await runCliCommand(["verify", "native:flow:simple"], repositoryRoot);
  assert.equal(result.exitCode, 6);
  assert.equal(result.data.status, "INSUFFICIENT_EVIDENCE");
});

test("invalid verify usage returns exit 2", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-verify-cli-usage-"));
  const result = await runCliCommand(["verify"], repositoryRoot);

  assert.equal(result.exitCode, 2);
  assert.equal(result.data.status, "USAGE_ERROR");
});
