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
