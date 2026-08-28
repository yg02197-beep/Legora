import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCliCommand } from "../../../src/cli/index.ts";
import { writeKnowledgeRecord } from "../../../src/repository-knowledge/store.ts";
import type { KnowledgeRecord } from "../../../src/repository-knowledge/contracts.ts";

const NOW = "2026-08-22T00:00:00.000Z";

async function makeReadyFixture(): Promise<string> {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-entry-render-ready-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "auth.ts"), "authMiddleware();\n", "utf8");
  await fs.writeFile(path.join(repositoryRoot, "src", "validator.ts"), "tokenValidator();\n", "utf8");

  // Entity: actor
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:auth-middleware",
    kind: "entity:actor",
    subject: "AuthMiddleware",
    activeEvidence: [{ filePath: "src/auth.ts", lineStart: 1, snippet: "authMiddleware();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: { type: "ENTITY", entityKind: "actor", name: "AuthMiddleware" },
  });

  // Entity: actor
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:token-validator",
    kind: "entity:actor",
    subject: "TokenValidator",
    activeEvidence: [{ filePath: "src/validator.ts", lineStart: 1, snippet: "tokenValidator();", confidence: "INFERRED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: { type: "ENTITY", entityKind: "actor", name: "TokenValidator" },
  });

  // Entity: invariant (for constraint relationship)
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:auth-required",
    kind: "entity:invariant",
    subject: "All /api/* routes require auth",
    activeEvidence: [{ filePath: "src/auth.ts", lineStart: 1, snippet: "authMiddleware();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: { type: "ENTITY", entityKind: "invariant", name: "All /api/* routes require auth" },
  });

  // Entity: failure-point
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:missing-header",
    kind: "entity:failure-point",
    subject: "Missing header returns 401",
    activeEvidence: [{ filePath: "src/auth.ts", lineStart: 1, snippet: "authMiddleware();", confidence: "UNKNOWN" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: { type: "ENTITY", entityKind: "failure-point", name: "Missing header returns 401" },
  });

  // Relationship: guards (constraint)
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:relationship:auth-guards",
    kind: "relationship:guards",
    subject: "AuthMiddleware guards auth-required",
    activeEvidence: [{ filePath: "src/auth.ts", lineStart: 1, snippet: "authMiddleware();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: {
      type: "RELATIONSHIP",
      relationshipKind: "guards",
      sourceId: "native:entity:auth-middleware",
      targetId: "native:entity:auth-required",
    },
  });

  // Relationship: triggers (failure)
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:relationship:auth-failure",
    kind: "relationship:triggers",
    subject: "AuthMiddleware triggers missing-header failure",
    activeEvidence: [{ filePath: "src/auth.ts", lineStart: 1, snippet: "authMiddleware();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: {
      type: "RELATIONSHIP",
      relationshipKind: "triggers",
      sourceId: "native:entity:auth-middleware",
      targetId: "native:entity:missing-header",
    },
  });

  // Flow record
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:flow:auth-enforcement",
    kind: "behavior-flow:flow",
    subject: "Authentication enforcement",
    activeEvidence: [{ filePath: "src/auth.ts", lineStart: 1, snippet: "authMiddleware();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "flow",
      name: "Authentication enforcement",
      steps: [
        { entityId: "native:entity:auth-middleware", label: "Request intercepted by AuthMiddleware" },
        { entityId: "native:entity:token-validator", label: "Token validated" },
      ],
    },
  });

  return repositoryRoot;
}

async function makeCandidatesFixture(): Promise<string> {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-entry-render-candidates-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "retry.ts"), "retry();\n", "utf8");

  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:retry-coordinator",
    kind: "entity:capability",
    subject: "Download retry coordinator",
    activeEvidence: [{ filePath: "src/retry.ts", lineStart: 1, snippet: "retry();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: { type: "ENTITY", entityKind: "capability", name: "Download retry coordinator" },
  });

  return repositoryRoot;
}

// --- READY status tests ---

test("entry render: READY status shows checkmark, question, and behavior slice subject", async () => {
  const repositoryRoot = await makeReadyFixture();

  const result = await runCliCommand(
    ["entry", "--candidate", "native:flow:auth-enforcement", "\uC778\uC99D\uC740 \uC5B4\uB514\uC11C \uCC98\uB9AC\uB3FC?"],
    repositoryRoot,
  );

  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("\u2713 READY"), "should contain checkmark READY");
  assert.ok(result.stdout.includes("\uC778\uC99D\uC740 \uC5B4\uB514\uC11C \uCC98\uB9AC\uB3FC?"), "should contain the question");
  assert.ok(result.stdout.includes("Authentication enforcement"), "should contain behavior slice subject");
});

test("entry render: READY status shows participants with file paths and confidence badges", async () => {
  const repositoryRoot = await makeReadyFixture();

  const result = await runCliCommand(
    ["entry", "--candidate", "native:flow:auth-enforcement", "\uC778\uC99D\uC740 \uC5B4\uB514\uC11C \uCC98\uB9AC\uB3FC?"],
    repositoryRoot,
  );

  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("Participants"), "should show Participants category");
  assert.ok(result.stdout.includes("AuthMiddleware"), "should show participant name");
  assert.ok(result.stdout.includes("src/auth.ts:1"), "should show file path with line number");
  assert.ok(result.stdout.includes("[CONFIRMED]"), "should show CONFIRMED badge");
  assert.ok(result.stdout.includes("TokenValidator"), "should show second participant");
  assert.ok(result.stdout.includes("[INFERRED]"), "should show INFERRED badge for inferred evidence");
});

test("entry render: READY status shows flows section", async () => {
  const repositoryRoot = await makeReadyFixture();

  const result = await runCliCommand(
    ["entry", "--candidate", "native:flow:auth-enforcement", "\uC778\uC99D\uC740 \uC5B4\uB514\uC11C \uCC98\uB9AC\uB3FC?"],
    repositoryRoot,
  );

  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("Flows"), "should show Flows category");
  assert.ok(result.stdout.includes("Request intercepted by AuthMiddleware"), "should show flow step label");
  assert.ok(result.stdout.includes("Token validated"), "should show second flow step");
});

test("entry render: READY status shows constraints with CONFIRMED badge", async () => {
  const repositoryRoot = await makeReadyFixture();

  const result = await runCliCommand(
    ["entry", "--candidate", "native:flow:auth-enforcement", "\uC778\uC99D\uC740 \uC5B4\uB514\uC11C \uCC98\uB9AC\uB3FC?"],
    repositoryRoot,
  );

  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("Constraints"), "should show Constraints category");
  assert.ok(result.stdout.includes("All /api/* routes require auth"), "should show constraint fact text");
});

test("entry render: READY status shows failures with UNKNOWN badge", async () => {
  const repositoryRoot = await makeReadyFixture();

  const result = await runCliCommand(
    ["entry", "--candidate", "native:flow:auth-enforcement", "\uC778\uC99D\uC740 \uC5B4\uB514\uC11C \uCC98\uB9AC\uB3FC?"],
    repositoryRoot,
  );

  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("Failures"), "should show Failures category");
  assert.ok(result.stdout.includes("Missing header returns 401"), "should show failure text");
  assert.ok(result.stdout.includes("[UNKNOWN]"), "should show UNKNOWN badge");
});

test("entry render: READY status omits empty categories", async () => {
  const repositoryRoot = await makeReadyFixture();

  const result = await runCliCommand(
    ["entry", "--candidate", "native:flow:auth-enforcement", "\uC778\uC99D\uC740 \uC5B4\uB514\uC11C \uCC98\uB9AC\uB3FC?"],
    repositoryRoot,
  );

  assert.ok(result.stdout);
  assert.ok(!result.stdout.includes("States"), "should omit empty States");
  assert.ok(!result.stdout.includes("Events"), "should omit empty Events");
  assert.ok(!result.stdout.includes("Effects"), "should omit empty Effects");
});

test("entry render: READY status shows evidence summary", async () => {
  const repositoryRoot = await makeReadyFixture();

  const result = await runCliCommand(
    ["entry", "--candidate", "native:flow:auth-enforcement", "\uC778\uC99D\uC740 \uC5B4\uB514\uC11C \uCC98\uB9AC\uB3FC?"],
    repositoryRoot,
  );

  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("Evidence"), "should show Evidence section");
  assert.ok(result.stdout.includes("anchors checked"), "should show anchors checked count");
  assert.ok(result.stdout.includes("all CURRENT"), "should show all CURRENT");
});

// --- KNOWLEDGE_CANDIDATES status tests ---

test("entry render: CANDIDATES status shows question mark and Korean header", async () => {
  const repositoryRoot = await makeCandidatesFixture();

  const result = await runCliCommand(
    ["entry", "\uB2E4\uC6B4\uB85C\uB4DC \uC7AC\uC2DC\uB3C4"],
    repositoryRoot,
  );

  assert.equal(result.exitCode, 8);
  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("? CANDIDATES"), "should show ? CANDIDATES");
  assert.ok(result.stdout.includes("\uAE30\uC874 Knowledge\uC5D0 \uD6C4\uBCF4\uAC00 \uC788\uC2B5\uB2C8\uB2E4"), "should show Korean header");
  assert.ok(result.stdout.includes("\uB2E4\uC6B4\uB85C\uB4DC \uC7AC\uC2DC\uB3C4"), "should show the question");
});

test("entry render: CANDIDATES status shows candidate details", async () => {
  const repositoryRoot = await makeCandidatesFixture();

  const result = await runCliCommand(
    ["entry", "\uB2E4\uC6B4\uB85C\uB4DC \uC7AC\uC2DC\uB3C4"],
    repositoryRoot,
  );

  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("#1"), "should show candidate number");
  assert.ok(result.stdout.includes("native:entity:retry-coordinator"), "should show record id");
  assert.ok(result.stdout.includes("Download retry coordinator"), "should show subject");
  assert.ok(result.stdout.includes("confidence:"), "should show confidence label");
});

test("entry render: CANDIDATES status shows next action commands", async () => {
  const repositoryRoot = await makeCandidatesFixture();

  const result = await runCliCommand(
    ["entry", "\uB2E4\uC6B4\uB85C\uB4DC \uC7AC\uC2DC\uB3C4"],
    repositoryRoot,
  );

  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("Next"), "should show Next section");
  assert.ok(result.stdout.includes("--candidate"), "should show --candidate command");
  assert.ok(result.stdout.includes("--reject-candidates"), "should show --reject-candidates command");
  assert.ok(result.stdout.includes("\uD6C4\uBCF4\uAC00 \uB9DE\uC73C\uBA74"), "should show Korean guidance for accepting");
  assert.ok(result.stdout.includes("\uD6C4\uBCF4\uAC00 \uC5C6\uC73C\uBA74"), "should show Korean guidance for rejecting");
});

// --- KNOWLEDGE_NOT_FOUND status tests ---

test("entry render: NOT_FOUND status shows X mark and Korean header", async () => {
  const repositoryRoot = await makeCandidatesFixture();

  const result = await runCliCommand(
    ["entry", "--reject-candidates", "\uB2E4\uC6B4\uB85C\uB4DC \uC7AC\uC2DC\uB3C4"],
    repositoryRoot,
  );

  assert.equal(result.exitCode, 3);
  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("\u2717 NOT FOUND"), "should show X mark NOT FOUND");
  assert.ok(result.stdout.includes("\uC774 \uC9C8\uBB38\uC744 \uB2F5\uD560 Knowledge\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4"), "should show Korean header");
  assert.ok(result.stdout.includes("\uB2E4\uC6B4\uB85C\uB4DC \uC7AC\uC2DC\uB3C4"), "should show the question");
});

test("entry render: NOT_FOUND status shows acquisition guidance commands", async () => {
  const repositoryRoot = await makeCandidatesFixture();

  const result = await runCliCommand(
    ["entry", "--reject-candidates", "\uB2E4\uC6B4\uB85C\uB4DC \uC7AC\uC2DC\uB3C4"],
    repositoryRoot,
  );

  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("Next"), "should show Next section");
  assert.ok(result.stdout.includes("legora knowledge acquire --example"), "should show acquire example command");
  assert.ok(result.stdout.includes("legora entry"), "should show re-entry command");
  assert.ok(result.stdout.includes("\uCF54\uB4DC\uB97C \uD655\uC778\uD558\uACE0 Knowledge\uB97C \uC218\uC9D1\uD558\uC138\uC694"), "should show Korean guidance");
});

// --- KNOWLEDGE_STALE status tests ---

test("entry render: STALE status shows warning symbol and Korean header", async () => {
  const repositoryRoot = await makeReadyFixture();
  // Modify source to make evidence stale
  await fs.writeFile(path.join(repositoryRoot, "src", "auth.ts"), "changedContent();\n", "utf8");

  const result = await runCliCommand(
    ["entry", "--candidate", "native:flow:auth-enforcement", "\uC778\uC99D\uC740 \uC5B4\uB514\uC11C \uCC98\uB9AC\uB3FC?"],
    repositoryRoot,
  );

  assert.equal(result.exitCode, 4);
  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("\u26A0 STALE"), "should show warning STALE");
  assert.ok(result.stdout.includes("Knowledge\uAC00 \uC788\uC9C0\uB9CC \uC99D\uAC70\uAC00 \uC624\uB798\uB418\uC5C8\uC2B5\uB2C8\uB2E4"), "should show Korean header");
  assert.ok(result.stdout.includes("\uC778\uC99D\uC740 \uC5B4\uB514\uC11C \uCC98\uB9AC\uB3FC?"), "should show the question");
});

test("entry render: STALE status shows flow record id and stale records", async () => {
  const repositoryRoot = await makeReadyFixture();
  await fs.writeFile(path.join(repositoryRoot, "src", "auth.ts"), "changedContent();\n", "utf8");

  const result = await runCliCommand(
    ["entry", "--candidate", "native:flow:auth-enforcement", "\uC778\uC99D\uC740 \uC5B4\uB514\uC11C \uCC98\uB9AC\uB3FC?"],
    repositoryRoot,
  );

  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("Flow: native:flow:auth-enforcement"), "should show flow record id");
  assert.ok(result.stdout.includes("Stale records:"), "should show Stale records label");
});

test("entry render: STALE status shows next action guidance", async () => {
  const repositoryRoot = await makeReadyFixture();
  await fs.writeFile(path.join(repositoryRoot, "src", "auth.ts"), "changedContent();\n", "utf8");

  const result = await runCliCommand(
    ["entry", "--candidate", "native:flow:auth-enforcement", "\uC778\uC99D\uC740 \uC5B4\uB514\uC11C \uCC98\uB9AC\uB3FC?"],
    repositoryRoot,
  );

  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("Next"), "should show Next section");
  assert.ok(result.stdout.includes("legora knowledge acquire < refresh.json"), "should show refresh command");
  assert.ok(result.stdout.includes("\uD574\uB2F9 \uC601\uC5ED\uC744 \uD655\uC778\uD558\uACE0 \uAC31\uC2E0\uD558\uC138\uC694"), "should show Korean guidance");
});

// --- KNOWLEDGE_UNKNOWN status tests ---

test("entry render: UNKNOWN status shows warning symbol and Korean header", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-entry-render-unknown-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "main.ts"), "main();\n", "utf8");

  // Entity with path that resolves outside repo (using ../)
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:outside-path",
    kind: "entity:actor",
    subject: "OutsideEntity",
    activeEvidence: [{ filePath: "../../../outside/file.ts", lineStart: 1, snippet: "outside();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: { type: "ENTITY", entityKind: "actor", name: "OutsideEntity" },
  });

  // Flow record referencing the entity with outside path
  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:flow:unknown-evidence",
    kind: "behavior-flow:flow",
    subject: "Unknown evidence flow",
    activeEvidence: [{ filePath: "src/main.ts", lineStart: 1, snippet: "main();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "flow",
      name: "Unknown evidence flow",
      steps: [{ entityId: "native:entity:outside-path", label: "Step outside" }],
    },
  });

  const result = await runCliCommand(
    ["entry", "--candidate", "native:flow:unknown-evidence", "\uC99D\uAC70 \uD655\uC778 \uBD88\uAC00"],
    repositoryRoot,
  );

  assert.equal(result.exitCode, 5);
  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("\u26A0 UNKNOWN"), "should show warning UNKNOWN");
  assert.ok(result.stdout.includes("Knowledge \uC99D\uAC70\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4"), "should show Korean header");
  assert.ok(result.stdout.includes("\uC99D\uAC70 \uD655\uC778 \uBD88\uAC00"), "should show the question");
});

test("entry render: UNKNOWN status shows flow record and uncheckable records", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-entry-render-unknown2-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "main.ts"), "main();\n", "utf8");

  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:outside-path",
    kind: "entity:actor",
    subject: "OutsideEntity",
    activeEvidence: [{ filePath: "../../../outside/file.ts", lineStart: 1, snippet: "outside();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: { type: "ENTITY", entityKind: "actor", name: "OutsideEntity" },
  });

  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:flow:unknown-evidence",
    kind: "behavior-flow:flow",
    subject: "Unknown evidence flow",
    activeEvidence: [{ filePath: "src/main.ts", lineStart: 1, snippet: "main();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "flow",
      name: "Unknown evidence flow",
      steps: [{ entityId: "native:entity:outside-path", label: "Step outside" }],
    },
  });

  const result = await runCliCommand(
    ["entry", "--candidate", "native:flow:unknown-evidence", "\uC99D\uAC70 \uD655\uC778"],
    repositoryRoot,
  );

  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("Flow: native:flow:unknown-evidence"), "should show flow record id");
  assert.ok(result.stdout.includes("Uncheckable records:"), "should show Uncheckable records label");
  assert.ok(result.stdout.includes("Next"), "should show Next section");
  assert.ok(result.stdout.includes("\uC99D\uAC70 \uACBD\uB85C\uB97C \uD655\uC778\uD558\uACE0 \uAC31\uC2E0\uD558\uC138\uC694"), "should show Korean guidance");
});

// --- --json flag tests ---

test("entry render: --json flag returns undefined stdout (JSON mode preserved)", async () => {
  const repositoryRoot = await makeReadyFixture();

  const result = await runCliCommand(
    ["entry", "--json", "--candidate", "native:flow:auth-enforcement", "\uC778\uC99D\uC740 \uC5B4\uB514\uC11C \uCC98\uB9AC\uB3FC?"],
    repositoryRoot,
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, undefined, "JSON mode should not set stdout");
  assert.equal(result.data.status, "READY");
  assert.equal(result.data.command, "entry");
});

test("entry render: --json with candidates status also returns undefined stdout", async () => {
  const repositoryRoot = await makeCandidatesFixture();

  const result = await runCliCommand(
    ["entry", "--json", "\uB2E4\uC6B4\uB85C\uB4DC \uC7AC\uC2DC\uB3C4"],
    repositoryRoot,
  );

  assert.equal(result.exitCode, 8);
  assert.equal(result.stdout, undefined, "JSON mode should not set stdout");
  assert.equal(result.data.status, "KNOWLEDGE_CANDIDATES");
});

// --- Confidence badge logic tests ---

test("entry render: confidence badge logic - all CONFIRMED claims show [CONFIRMED]", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-entry-render-conf-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "service.ts"), "service();\n", "utf8");

  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:confirmed-service",
    kind: "entity:actor",
    subject: "ConfirmedService",
    activeEvidence: [
      { filePath: "src/service.ts", lineStart: 1, snippet: "service();", confidence: "CONFIRMED" },
    ],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: { type: "ENTITY", entityKind: "actor", name: "ConfirmedService" },
  });

  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:flow:confirmed-flow",
    kind: "behavior-flow:flow",
    subject: "Confirmed flow",
    activeEvidence: [{ filePath: "src/service.ts", lineStart: 1, snippet: "service();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "flow",
      name: "Confirmed flow",
      steps: [{ entityId: "native:entity:confirmed-service", label: "Confirmed step" }],
    },
  });

  const result = await runCliCommand(
    ["entry", "--candidate", "native:flow:confirmed-flow", "confirmed service"],
    repositoryRoot,
  );

  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("[CONFIRMED]"), "should show CONFIRMED badge when all claims are CONFIRMED");
});

test("entry render: confidence badge logic - INFERRED claim shows [INFERRED]", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-entry-render-infer-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "service.ts"), "service();\n", "utf8");

  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:inferred-service",
    kind: "entity:actor",
    subject: "InferredService",
    activeEvidence: [
      { filePath: "src/service.ts", lineStart: 1, snippet: "service();", confidence: "INFERRED" },
    ],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: { type: "ENTITY", entityKind: "actor", name: "InferredService" },
  });

  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:flow:inferred-flow",
    kind: "behavior-flow:flow",
    subject: "Inferred flow",
    activeEvidence: [{ filePath: "src/service.ts", lineStart: 1, snippet: "service();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "flow",
      name: "Inferred flow",
      steps: [{ entityId: "native:entity:inferred-service", label: "Inferred step" }],
    },
  });

  const result = await runCliCommand(
    ["entry", "--candidate", "native:flow:inferred-flow", "inferred service"],
    repositoryRoot,
  );

  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("[INFERRED]"), "should show INFERRED badge when a claim is INFERRED");
});

test("entry render: confidence badge logic - UNKNOWN claim shows [UNKNOWN]", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-entry-render-unk-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "service.ts"), "service();\n", "utf8");

  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:entity:unknown-service",
    kind: "entity:actor",
    subject: "UnknownService",
    activeEvidence: [
      { filePath: "src/service.ts", lineStart: 1, snippet: "service();", confidence: "UNKNOWN" },
    ],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: { type: "ENTITY", entityKind: "actor", name: "UnknownService" },
  });

  await writeKnowledgeRecord(repositoryRoot, {
    id: "native:flow:unknown-flow",
    kind: "behavior-flow:flow",
    subject: "Unknown flow",
    activeEvidence: [{ filePath: "src/service.ts", lineStart: 1, snippet: "service();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "flow",
      name: "Unknown flow",
      steps: [{ entityId: "native:entity:unknown-service", label: "Unknown step" }],
    },
  });

  const result = await runCliCommand(
    ["entry", "--candidate", "native:flow:unknown-flow", "unknown service"],
    repositoryRoot,
  );

  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("[UNKNOWN]"), "should show UNKNOWN badge when a claim is UNKNOWN");
});
