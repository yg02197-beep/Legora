import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { computeScanCoverage } from "../../../src/scan/coverage.ts";
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

test("computeScanCoverage marks file as covered when knowledge is CURRENT", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-scan-coverage-current-"));
  await initGitRepo(repoRoot);

  await fs.mkdir(path.join(repoRoot, "src"));
  await fs.writeFile(path.join(repoRoot, "src", "app.ts"), "hello\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: repoRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoRoot });

  // Write a knowledge record that references src/app.ts with matching snippet
  await writeKnowledgeRecord(repoRoot, makeRecord("rec-1", "src/app.ts", "hello"));

  const result = await computeScanCoverage(repoRoot);

  const appEntry = result.files.find((f) => f.filePath === "src/app.ts");
  assert.equal(appEntry?.coverageStatus, "covered");
  assert.equal(result.coveredFiles, 1);
});

test("computeScanCoverage marks file as stale when knowledge is STALE", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-scan-coverage-stale-"));
  await initGitRepo(repoRoot);

  await fs.mkdir(path.join(repoRoot, "src"));
  await fs.writeFile(path.join(repoRoot, "src", "app.ts"), "changed\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: repoRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoRoot });

  // Write a knowledge record with a non-matching snippet (content changed)
  await writeKnowledgeRecord(repoRoot, makeRecord("rec-1", "src/app.ts", "original"));

  const result = await computeScanCoverage(repoRoot);

  const appEntry = result.files.find((f) => f.filePath === "src/app.ts");
  assert.equal(appEntry?.coverageStatus, "stale");
  assert.equal(result.staleFiles, 1);
});

test("computeScanCoverage marks file as uncovered when no knowledge references it", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-scan-coverage-uncovered-"));
  await initGitRepo(repoRoot);

  await fs.mkdir(path.join(repoRoot, "src"));
  await fs.writeFile(path.join(repoRoot, "src", "app.ts"), "hello\n", "utf8");
  await fs.writeFile(path.join(repoRoot, "src", "util.ts"), "util\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: repoRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoRoot });

  // Only record for app.ts, util.ts has no coverage
  await writeKnowledgeRecord(repoRoot, makeRecord("rec-1", "src/app.ts", "hello"));

  const result = await computeScanCoverage(repoRoot);

  const utilEntry = result.files.find((f) => f.filePath === "src/util.ts");
  assert.equal(utilEntry?.coverageStatus, "uncovered");
  assert.equal(result.uncoveredFiles, 1);
});

test("computeScanCoverage with UNKNOWN freshness (no snippet) marks as stale (fail-closed)", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-scan-coverage-unknown-"));
  await initGitRepo(repoRoot);

  await fs.mkdir(path.join(repoRoot, "src"));
  await fs.writeFile(path.join(repoRoot, "src", "app.ts"), "hello\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: repoRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoRoot });

  // Write a knowledge record with no snippet (UNKNOWN freshness)
  const record: KnowledgeRecord = {
    id: "rec-no-snippet",
    kind: "entity",
    subject: "No snippet record",
    activeEvidence: [{ filePath: "src/app.ts", lineStart: 1 }],
    history: [],
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
  };
  await writeKnowledgeRecord(repoRoot, record);

  const result = await computeScanCoverage(repoRoot);

  const appEntry = result.files.find((f) => f.filePath === "src/app.ts");
  assert.equal(appEntry?.coverageStatus, "stale");
});

test("computeScanCoverage module grouping aggregates correctly", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-scan-coverage-modules-"));
  await initGitRepo(repoRoot);

  await fs.mkdir(path.join(repoRoot, "src"));
  await fs.mkdir(path.join(repoRoot, "lib"));
  await fs.writeFile(path.join(repoRoot, "src", "a.ts"), "a\n", "utf8");
  await fs.writeFile(path.join(repoRoot, "src", "b.ts"), "b\n", "utf8");
  await fs.writeFile(path.join(repoRoot, "lib", "c.ts"), "c\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: repoRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoRoot });

  // Only cover src/a.ts
  await writeKnowledgeRecord(repoRoot, makeRecord("rec-1", "src/a.ts", "a"));

  const result = await computeScanCoverage(repoRoot, { depth: "module" });

  assert.equal(result.modules.length, 2);
  const srcModule = result.modules.find((m) => m.module === "src");
  const libModule = result.modules.find((m) => m.module === "lib");
  assert.ok(srcModule);
  assert.equal(srcModule.total, 2);
  assert.equal(srcModule.covered, 1);
  assert.equal(srcModule.uncovered, 1);
  assert.ok(libModule);
  assert.equal(libModule.total, 1);
  assert.equal(libModule.uncovered, 1);
});

test("computeScanCoverage with empty repo (no knowledge) marks all as uncovered", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-scan-coverage-empty-"));
  await initGitRepo(repoRoot);

  await fs.mkdir(path.join(repoRoot, "src"));
  await fs.writeFile(path.join(repoRoot, "src", "app.ts"), "hello\n", "utf8");
  await fs.writeFile(path.join(repoRoot, "src", "util.ts"), "util\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: repoRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoRoot });

  const result = await computeScanCoverage(repoRoot);

  assert.equal(result.totalFiles, 2);
  assert.equal(result.coveredFiles, 0);
  assert.equal(result.staleFiles, 0);
  assert.equal(result.uncoveredFiles, 2);
  for (const file of result.files) {
    assert.equal(file.coverageStatus, "uncovered");
  }
});

test("computeScanCoverage depth file is reported in result", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-scan-coverage-depth-"));
  await initGitRepo(repoRoot);

  await fs.writeFile(path.join(repoRoot, "file.ts"), "content\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: repoRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoRoot });

  const result = await computeScanCoverage(repoRoot, { depth: "file" });

  assert.equal(result.depth, "file");
});
