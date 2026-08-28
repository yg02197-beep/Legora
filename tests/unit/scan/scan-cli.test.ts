import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runCliCommand } from "../../../src/cli/index.ts";
import { writeKnowledgeRecord } from "../../../src/repository-knowledge/store.ts";
import type { KnowledgeRecord } from "../../../src/repository-knowledge/contracts.ts";

const execFileAsync = promisify(execFile);

async function initGitRepo(dir: string): Promise<void> {
  await execFileAsync("git", ["init"], { cwd: dir });
  await execFileAsync("git", ["config", "user.email", "test@test.com"], { cwd: dir });
  await execFileAsync("git", ["config", "user.name", "Test"], { cwd: dir });
}

function makeRecord(id: string, filePath: string, snippet: string): KnowledgeRecord {
  return {
    id,
    kind: "entity",
    subject: `Knowledge about ${filePath}`,
    activeEvidence: [{ filePath, lineStart: 1, snippet }],
    history: [],
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
  };
}

test("scan command returns exit code 0 and human-readable stdout by default", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-scan-cli-default-"));
  await initGitRepo(repoRoot);

  await fs.writeFile(path.join(repoRoot, "file.ts"), "content\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: repoRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoRoot });

  const result = await runCliCommand(["scan"], repoRoot);

  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("Legora scan:"));
  assert.ok(result.stdout.includes("1 files"));
  assert.equal(result.data.command, "scan");
});

test("scan command with --json returns no stdout and structured data", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-scan-cli-json-"));
  await initGitRepo(repoRoot);

  await fs.writeFile(path.join(repoRoot, "file.ts"), "content\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: repoRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoRoot });

  const result = await runCliCommand(["scan", "--json"], repoRoot);

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, undefined);
  assert.equal(result.data.totalFiles, 1);
  assert.equal(result.data.uncoveredFiles, 1);
  assert.ok(Array.isArray(result.data.files));
  assert.ok(Array.isArray(result.data.modules));
});

test("scan command with --depth file shows per-file detail", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-scan-cli-depth-file-"));
  await initGitRepo(repoRoot);

  await fs.mkdir(path.join(repoRoot, "src"));
  await fs.writeFile(path.join(repoRoot, "src", "a.ts"), "a\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: repoRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoRoot });

  await writeKnowledgeRecord(repoRoot, makeRecord("rec-1", "src/a.ts", "a"));

  const result = await runCliCommand(["scan", "--depth", "file"], repoRoot);

  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("src/a.ts"));
  assert.ok(result.stdout.includes("covered"));
  assert.equal(result.data.depth, "file");
});

test("scan command with --depth module shows module grouping", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-scan-cli-depth-module-"));
  await initGitRepo(repoRoot);

  await fs.mkdir(path.join(repoRoot, "src"));
  await fs.writeFile(path.join(repoRoot, "src", "a.ts"), "a\n", "utf8");
  await fs.writeFile(path.join(repoRoot, "src", "b.ts"), "b\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: repoRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoRoot });

  const result = await runCliCommand(["scan", "--depth", "module"], repoRoot);

  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout);
  assert.ok(result.stdout.includes("src"));
  assert.ok(result.stdout.includes("total=2"));
});

test("scan command returns usage error for invalid --depth value", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-scan-cli-bad-depth-"));
  await initGitRepo(repoRoot);
  await execFileAsync("git", ["commit", "--allow-empty", "-m", "init"], { cwd: repoRoot });

  const result = await runCliCommand(["scan", "--depth", "invalid"], repoRoot);

  assert.equal(result.exitCode, 2);
  assert.equal(result.data.status, "USAGE_ERROR");
});
