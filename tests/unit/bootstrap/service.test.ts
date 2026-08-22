import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { bootstrapLegora } from "../../../src/bootstrap/service.ts";
import { loadCanonicalSkillSnapshot } from "../../../src/skills/canonical.ts";
import { publishManagedCopy } from "../../../src/bootstrap/managed-copy.ts";
import type { BootstrapFileOps, HostEnvironment } from "../../../src/bootstrap/contracts.ts";

const SKILL_PREFIX = `---\nname: legora\ndescription: Understand repository behavior from current source evidence. Use for code-flow questions.\nmetadata:\n  legora-managed: "true"\n  legora-skill-schema: "1"\n---\n# Legora\n`;

async function makeCanonical(suffix: string): Promise<{ parent: string; root: string }> {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "legora-service-canonical-"));
  const root = path.join(parent, "legora");
  await fs.mkdir(path.join(root, "references"), { recursive: true });
  await fs.writeFile(path.join(root, "SKILL.md"), `${SKILL_PREFIX}${suffix}\n`);
  await fs.writeFile(path.join(root, "references", "explain.md"), "# Explain\n");
  await fs.writeFile(path.join(root, "references", "explore.md"), "# Explore\n");
  await fs.writeFile(path.join(root, "references", "verify.md"), "# Verify\n");
  return { parent, root };
}

function windowsHost(homeDir: string, binDir?: string): HostEnvironment {
  return {
    homeDir,
    platform: "win32",
    env: {
      Path: binDir ?? "",
      PATHEXT: ".COM;.EXE;.BAT;.CMD",
    },
  };
}

async function makeBin(commands: readonly string[]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "legora-service-bin-"));
  for (const command of commands) await fs.writeFile(path.join(dir, `${command}.cmd`), "@echo off\r\n");
  return dir;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function treeBytes(root: string): Promise<Record<string, string> | null> {
  if (!await exists(root)) return null;
  const output: Record<string, string> = {};
  async function walk(current: string): Promise<void> {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const relative = path.relative(root, full).split(path.sep).join("/");
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) output[relative] = (await fs.readFile(full)).toString("base64");
    }
  }
  await walk(root);
  return Object.fromEntries(Object.entries(output).sort(([a], [b]) => a.localeCompare(b)));
}

function realFileOps(overrides: Partial<BootstrapFileOps> = {}): BootstrapFileOps {
  return {
    lstat: (filePath) => fs.lstat(filePath),
    mkdir: (filePath, options) => fs.mkdir(filePath, options),
    readFile: (filePath) => fs.readFile(filePath),
    writeFile: (filePath, data) => fs.writeFile(filePath, data),
    readdir: (filePath, options) => fs.readdir(filePath, options),
    rename: (from, to) => fs.rename(from, to),
    rm: (filePath, options) => fs.rm(filePath, options),
    ...overrides,
  };
}

test("detected bootstrap targets only agents found on PATH", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-service-detected-"));
  const bin = await makeBin(["codex"]);
  try {
    const result = await bootstrapLegora({
      requested: "detected",
      dryRun: true,
      host: windowsHost(home, bin),
      packageVersion: "0.1.0",
    });
    assert.equal(result.status, "BOOTSTRAP_READY");
    assert.deepEqual(result.agents.map((entry) => entry.agent), ["codex"]);
    assert.equal(result.agents[0].executable, "FOUND");
    assert.equal(result.agents[0].action, "INSTALL");
    assert.equal(result.physicalWrites, 0);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(bin, { recursive: true, force: true });
  }
});

test("detected OpenCode bootstrap uses the shared portable target", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-service-opencode-"));
  const bin = await makeBin(["opencode"]);
  try {
    const result = await bootstrapLegora({
      requested: "detected",
      dryRun: false,
      host: windowsHost(home, bin),
      packageVersion: "0.1.0",
    });
    assert.equal(result.status, "BOOTSTRAP_READY");
    assert.equal(result.physicalWrites, 1);
    assert.deepEqual(result.agents.map((entry) => entry.agent), ["opencode"]);
    assert.equal(result.agents[0]?.targetPath, path.join(home, ".agents", "skills", "legora"));
  } finally {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(bin, { recursive: true, force: true });
  }
});

test("explicit agent can be pre-provisioned even when executable is absent", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-service-explicit-"));
  try {
    const result = await bootstrapLegora({
      requested: ["claude"],
      dryRun: false,
      host: windowsHost(home),
      packageVersion: "0.1.0",
    });
    const target = path.join(home, ".claude", "skills", "legora");
    assert.equal(result.status, "BOOTSTRAP_READY");
    assert.equal(result.physicalWrites, 1);
    assert.deepEqual(result.agents, [{
      agent: "claude",
      executable: "NOT_FOUND",
      targetKind: "claude",
      targetPath: target,
      action: "INSTALL",
    }]);
    assert.equal(await exists(path.join(target, ".legora-install.json")), true);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("all four explicit agents perform at most two physical writes", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-service-all-"));
  try {
    const result = await bootstrapLegora({
      requested: ["gemini", "opencode", "claude", "codex", "gemini"],
      dryRun: false,
      host: windowsHost(home),
      packageVersion: "0.1.0",
    });
    assert.equal(result.status, "BOOTSTRAP_READY");
    assert.equal(result.physicalWrites, 2);
    assert.deepEqual(result.agents.map((entry) => entry.agent), ["codex", "gemini", "opencode", "claude"]);
    assert.equal(await exists(path.join(home, ".agents", "skills", "legora", "SKILL.md")), true);
    assert.equal(await exists(path.join(home, ".claude", "skills", "legora", "SKILL.md")), true);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("dry-run reports actions without writing fake home", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-service-dry-"));
  try {
    const before = await fs.readdir(home);
    const result = await bootstrapLegora({
      requested: ["codex", "claude"],
      dryRun: true,
      host: windowsHost(home),
      packageVersion: "0.1.0",
    });
    assert.equal(result.status, "BOOTSTRAP_READY");
    assert.equal(result.physicalWrites, 0);
    assert.deepEqual(await fs.readdir(home), before);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("conflict in any physical target prevents all writes", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-service-conflict-"));
  const shared = path.join(home, ".agents", "skills", "legora");
  const claude = path.join(home, ".claude", "skills", "legora");
  try {
    await fs.mkdir(shared, { recursive: true });
    await fs.writeFile(path.join(shared, "SKILL.md"), "unowned\n");
    const result = await bootstrapLegora({
      requested: ["codex", "claude", "gemini"],
      dryRun: false,
      host: windowsHost(home),
      packageVersion: "0.1.0",
    });
    assert.equal(result.status, "BOOTSTRAP_CONFLICT");
    assert.equal(result.physicalWrites, 0);
    assert.equal(await exists(claude), false);
    assert.deepEqual(await fs.readFile(path.join(shared, "SKILL.md"), "utf8"), "unowned\n");
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("failure on second physical target rolls back the first target exactly", async () => {
  const oldCanonical = await makeCanonical("old");
  const newCanonical = await makeCanonical("new");
  const oldSnapshot = await loadCanonicalSkillSnapshot(oldCanonical.root);
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-service-rollback-"));
  const shared = path.join(home, ".agents", "skills", "legora");
  const claude = path.join(home, ".claude", "skills", "legora");
  try {
    const sharedSetup = await publishManagedCopy({ target: shared, snapshot: oldSnapshot, packageVersion: "0.1.0" });
    await sharedSetup.finalize();
    const claudeSetup = await publishManagedCopy({ target: claude, snapshot: oldSnapshot, packageVersion: "0.1.0" });
    await claudeSetup.finalize();
    const beforeShared = await treeBytes(shared);
    const beforeClaude = await treeBytes(claude);

    const ops = realFileOps({
      rename: async (from, to) => {
        if (from === claude && to.includes(".legora-backup-")) throw new Error("injected second-target failure");
        await fs.rename(from, to);
      },
    });
    const result = await bootstrapLegora({
      requested: ["codex", "claude", "gemini"],
      dryRun: false,
      host: windowsHost(home),
      packageVersion: "0.2.0",
      canonicalSkillRoot: newCanonical.root,
      fileOps: ops,
    });

    assert.equal(result.status, "BOOTSTRAP_FAILED");
    assert.equal(result.physicalWrites, 0);
    assert.deepEqual(await treeBytes(shared), beforeShared);
    assert.deepEqual(await treeBytes(claude), beforeClaude);
  } finally {
    await fs.rm(oldCanonical.parent, { recursive: true, force: true });
    await fs.rm(newCanonical.parent, { recursive: true, force: true });
    await fs.rm(home, { recursive: true, force: true });
  }
});
