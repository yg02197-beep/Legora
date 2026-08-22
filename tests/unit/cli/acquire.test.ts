import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { runCliCommand } from "../../../src/cli/index.ts";
import { readKnowledgeRecords } from "../../../src/repository-knowledge/store.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function proposalJson(): string {
  return JSON.stringify({
    candidates: [{
      id: "native:entity:service",
      kind: "entity:service",
      subject: "service entry point",
      structure: { type: "ENTITY", entityKind: "service", name: "service" },
      evidenceLocators: [{ filePath: "src/service.ts", lineStart: 1 }],
    }],
  });
}

test("knowledge acquire accepts a proposal from stdin and returns machine-readable acquisition status", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-acquire-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "service.ts"), "service();\n", "utf8");

  const result = await runCliCommand(
    ["knowledge", "acquire"],
    repositoryRoot,
    { stdin: proposalJson() },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.data.command, "knowledge acquire");
  assert.equal(result.data.status, "ACQUIRED");
  const [stored] = await readKnowledgeRecords(repositoryRoot);
  assert.equal(stored?.activeEvidence[0]?.snippet, "service();");
});

test("knowledge acquire accepts simple entity evidence without internal ids or structure", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-acquire-simple-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "service.ts"), "service();\n", "utf8");
  const simple = JSON.stringify({
    type: "entity",
    subject: "service entry point",
    name: "Service",
    entityKind: "service",
    evidenceLocators: [{ filePath: "src/service.ts", lineStart: 1 }],
  });

  const result = await runCliCommand(
    ["knowledge", "acquire"],
    repositoryRoot,
    { stdin: simple },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.data.status, "ACQUIRED");
  assert.deepEqual(result.data.recordIds, ["native:entity:service"]);
});

test("knowledge acquire example exposes the simple agent-facing contract without repository writes", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-acquire-example-"));

  const result = await runCliCommand(
    ["knowledge", "acquire", "--example"],
    repositoryRoot,
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.data.status, "EXAMPLE");
  assert.deepEqual(result.data.examples.map((example: { type: string }) => example.type), [
    "entity",
    "flow",
    "relationship",
  ]);
  assert.deepEqual(await readKnowledgeRecords(repositoryRoot), []);
});

test("knowledge acquire rejects malformed simple acquisition input as a usage error", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-acquire-simple-invalid-"));
  const simple = JSON.stringify({
    type: "flow",
    subject: "download fallback chain",
    evidenceLocators: [],
    steps: [],
  });

  const result = await runCliCommand(
    ["knowledge", "acquire"],
    repositoryRoot,
    { stdin: simple },
  );

  assert.equal(result.exitCode, 2);
  assert.equal(result.data.status, "USAGE_ERROR");
});

test("knowledge acquire rejects malformed stdin JSON as a usage error", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-acquire-json-"));

  const result = await runCliCommand(
    ["knowledge", "acquire"],
    repositoryRoot,
    { stdin: "{not-json" },
  );

  assert.equal(result.exitCode, 2);
  assert.equal(result.data.status, "USAGE_ERROR");
});

test("knowledge acquire maps semantic acquisition rejection to exit code 6", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-acquire-reject-"));
  const proposal = JSON.stringify({
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
  });

  const result = await runCliCommand(
    ["knowledge", "acquire"],
    repositoryRoot,
    { stdin: proposal },
  );

  assert.equal(result.exitCode, 6);
  assert.equal(result.data.status, "REJECTED");
  assert.equal(result.data.code, "STRUCTURE_INVALID");
});

test("knowledge acquire maps existing knowledge candidates to fail-closed exit code 8", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-acquire-duplicate-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "service.ts"), "service();\n", "utf8");

  const first = await runCliCommand(
    ["knowledge", "acquire"],
    repositoryRoot,
    { stdin: proposalJson() },
  );
  assert.equal(first.exitCode, 0);

  const duplicate = JSON.stringify({
    candidates: [{
      id: "native:entity:service-entry",
      kind: "entity:service",
      subject: "service entry point",
      structure: { type: "ENTITY", entityKind: "service", name: "service" },
      evidenceLocators: [{ filePath: "src/service.ts", lineStart: 1 }],
    }],
  });
  const result = await runCliCommand(
    ["knowledge", "acquire"],
    repositoryRoot,
    { stdin: duplicate },
  );

  assert.equal(result.exitCode, 8);
  assert.equal(result.data.status, "EXISTING_KNOWLEDGE");
  assert.equal(result.data.code, "EXISTING_KNOWLEDGE_CANDIDATE");
  assert.deepEqual(result.data.existingRecordIds, ["native:entity:service"]);
});

test("CLI process reads acquisition JSON from stdin without requiring target repository dependencies", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-acquire-process-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "service.ts"), "service();\n", "utf8");
  const binPath = path.join(projectRoot, "src", "cli", "bin.mjs");

  const child = spawnSync(
    process.execPath,
    [binPath, "knowledge", "acquire"],
    { cwd: repositoryRoot, input: proposalJson(), encoding: "utf8" },
  );

  assert.equal(child.status, 0, child.stderr || child.stdout);
  assert.equal(child.stderr, "");
  const output = JSON.parse(child.stdout);
  assert.equal(output.command, "knowledge acquire");
  assert.equal(output.status, "ACQUIRED");
});
