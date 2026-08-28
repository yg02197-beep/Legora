import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { collectRepositoryInventory } from "../../../src/scan/inventory.ts";

const execFileAsync = promisify(execFile);

async function initGitRepo(dir: string): Promise<void> {
  await execFileAsync("git", ["init"], { cwd: dir });
  await execFileAsync("git", ["config", "user.email", "test@test.com"], { cwd: dir });
  await execFileAsync("git", ["config", "user.name", "Test"], { cwd: dir });
}

test("collectRepositoryInventory returns tracked files sorted alphabetically", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-scan-inventory-"));
  await initGitRepo(repoRoot);

  await fs.mkdir(path.join(repoRoot, "src"));
  await fs.writeFile(path.join(repoRoot, "src", "b.ts"), "b", "utf8");
  await fs.writeFile(path.join(repoRoot, "src", "a.ts"), "a", "utf8");
  await fs.writeFile(path.join(repoRoot, "README.md"), "readme", "utf8");

  await execFileAsync("git", ["add", "."], { cwd: repoRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoRoot });

  const result = await collectRepositoryInventory(repoRoot);

  assert.deepEqual(result, ["README.md", "src/a.ts", "src/b.ts"]);
});

test("collectRepositoryInventory excludes untracked files", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-scan-inventory-untracked-"));
  await initGitRepo(repoRoot);

  await fs.writeFile(path.join(repoRoot, "tracked.ts"), "tracked", "utf8");
  await execFileAsync("git", ["add", "tracked.ts"], { cwd: repoRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoRoot });

  // Add an untracked file after commit
  await fs.writeFile(path.join(repoRoot, "untracked.ts"), "untracked", "utf8");

  const result = await collectRepositoryInventory(repoRoot);

  assert.deepEqual(result, ["tracked.ts"]);
});

test("collectRepositoryInventory returns empty array for empty git repo", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-scan-inventory-empty-"));
  await initGitRepo(repoRoot);

  // Create an empty commit so HEAD exists
  await execFileAsync("git", ["commit", "--allow-empty", "-m", "init"], { cwd: repoRoot });

  const result = await collectRepositoryInventory(repoRoot);

  assert.deepEqual(result, []);
});
