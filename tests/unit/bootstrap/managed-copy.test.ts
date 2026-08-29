import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadCanonicalSkillSnapshot } from "../../../src/skills/canonical.ts";
import {
  inspectManagedCopy,
  publishManagedCopy,
} from "../../../src/bootstrap/managed-copy.ts";
import type {
  BootstrapFileOps,
  LegoraInstallManifest,
} from "../../../src/bootstrap/contracts.ts";
import type { CanonicalSkillSnapshot } from "../../../src/skills/canonical.ts";

const SKILL_PREFIX = `---\nname: legora\ndescription: Understand repository behavior from current source evidence. Use for code-flow questions.\nmetadata:\n  legora-managed: "true"\n  legora-skill-schema: "1"\n---\n# Legora\n`;

function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function makeCanonical(suffix = "v1\n"): Promise<{ parent: string; root: string; snapshot: CanonicalSkillSnapshot }> {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "legora-managed-canonical-"));
  const root = path.join(parent, "legora");
  await fs.mkdir(path.join(root, "references"), { recursive: true });
  await fs.writeFile(path.join(root, "SKILL.md"), `${SKILL_PREFIX}${suffix}`);
  await fs.writeFile(path.join(root, "references", "explain.md"), "# Explain\n");
  await fs.writeFile(path.join(root, "references", "explore.md"), "# Explore\n");
  await fs.writeFile(path.join(root, "references", "verify.md"), "# Verify\n");
  return { parent, root, snapshot: await loadCanonicalSkillSnapshot(root) };
}

function manifestFor(snapshot: CanonicalSkillSnapshot, packageVersion = "0.1.0"): LegoraInstallManifest {
  return {
    schemaVersion: 1,
    packageVersion,
    payloadDigest: snapshot.payloadDigest,
    files: snapshot.files.map(({ relativePath, sha256 }) => ({ relativePath, sha256 })),
  };
}

async function writeManagedTarget(target: string, snapshot: CanonicalSkillSnapshot, packageVersion = "0.1.0"): Promise<void> {
  await fs.mkdir(target, { recursive: true });
  for (const file of snapshot.files) {
    const filePath = path.join(target, ...file.relativePath.split("/"));
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, file.bytes);
  }
  await fs.writeFile(path.join(target, ".legora-install.json"), `${JSON.stringify(manifestFor(snapshot, packageVersion), null, 2)}\n`);
}

async function treeBytes(root: string): Promise<Record<string, string> | null> {
  try {
    const stat = await fs.lstat(root);
    if (!stat.isDirectory()) return { ".": `NON_DIRECTORY:${stat.mode}` };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  const output: Record<string, string> = {};
  async function walk(current: string): Promise<void> {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const relative = path.relative(root, full).split(path.sep).join("/");
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) output[relative] = (await fs.readFile(full)).toString("base64");
      else output[relative] = `SPECIAL:${entry.name}`;
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

async function cleanup(...paths: string[]): Promise<void> {
  await Promise.all(paths.map((item) => fs.rm(item, { recursive: true, force: true })));
}

test("managed-copy inspection distinguishes absent, current, and packaged update states", async () => {
  const current = await makeCanonical("v1\n");
  const next = await makeCanonical("v2\n");
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-managed-state-"));
  const target = path.join(home, ".agents", "skills", "legora");
  try {
    assert.deepEqual(await inspectManagedCopy(target, current.snapshot), { state: "ABSENT", reason: "TARGET_ABSENT" });
    await writeManagedTarget(target, current.snapshot);
    assert.deepEqual(await inspectManagedCopy(target, current.snapshot), { state: "NO_CHANGE", reason: "CURRENT_MANAGED_COPY", installedPackageVersion: "0.1.0" });
    assert.deepEqual(await inspectManagedCopy(target, next.snapshot), { state: "MANAGED_UPDATE", reason: "PACKAGED_PAYLOAD_CHANGED", installedPackageVersion: "0.1.0" });
  } finally {
    await cleanup(current.parent, next.parent, home);
  }
});

test("unowned identical-looking target is conflict and is never adopted", async () => {
  const canonical = await makeCanonical();
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-managed-unowned-"));
  const target = path.join(home, "legora");
  try {
    await fs.mkdir(target, { recursive: true });
    for (const file of canonical.snapshot.files) {
      const filePath = path.join(target, ...file.relativePath.split("/"));
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.bytes);
    }
    assert.deepEqual(await inspectManagedCopy(target, canonical.snapshot), { state: "CONFLICT", reason: "UNOWNED_TARGET" });
  } finally {
    await cleanup(canonical.parent, home);
  }
});

test("malformed ownership manifest is conflict", async () => {
  const canonical = await makeCanonical();
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-managed-manifest-"));
  const target = path.join(home, "legora");
  try {
    await writeManagedTarget(target, canonical.snapshot);
    await fs.writeFile(path.join(target, ".legora-install.json"), "{not-json\n");
    assert.deepEqual(await inspectManagedCopy(target, canonical.snapshot), { state: "CONFLICT", reason: "MANIFEST_INVALID" });
  } finally {
    await cleanup(canonical.parent, home);
  }
});

test("tampered valid-looking manifest payload digest is conflict", async () => {
  const canonical = await makeCanonical();
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-managed-manifest-digest-"));
  const target = path.join(home, "legora");
  try {
    await writeManagedTarget(target, canonical.snapshot);
    const manifestPath = path.join(target, ".legora-install.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as LegoraInstallManifest;
    manifest.payloadDigest = "0".repeat(64);
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    assert.deepEqual(await inspectManagedCopy(target, canonical.snapshot), { state: "CONFLICT", reason: "MANIFEST_INVALID" });
  } finally {
    await cleanup(canonical.parent, home);
  }
});

test("locally modified, missing, or extra managed content is conflict", async () => {
  const canonical = await makeCanonical();
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-managed-modified-"));
  try {
    const modified = path.join(home, "modified");
    await writeManagedTarget(modified, canonical.snapshot);
    await fs.appendFile(path.join(modified, "SKILL.md"), "local\n");
    assert.deepEqual(await inspectManagedCopy(modified, canonical.snapshot), { state: "CONFLICT", reason: "MANAGED_FILE_MODIFIED" });

    const missing = path.join(home, "missing");
    await writeManagedTarget(missing, canonical.snapshot);
    await fs.rm(path.join(missing, "references", "verify.md"));
    assert.deepEqual(await inspectManagedCopy(missing, canonical.snapshot), { state: "CONFLICT", reason: "MANAGED_FILE_MISSING" });

    const extra = path.join(home, "extra");
    await writeManagedTarget(extra, canonical.snapshot);
    await fs.writeFile(path.join(extra, "local-note.md"), "do not delete\n");
    assert.deepEqual(await inspectManagedCopy(extra, canonical.snapshot), { state: "CONFLICT", reason: "MANAGED_FILE_MODIFIED" });
  } finally {
    await cleanup(canonical.parent, home);
  }
});

test("non-directory target is conflict", async () => {
  const canonical = await makeCanonical();
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-managed-file-target-"));
  const target = path.join(home, "legora");
  try {
    await fs.writeFile(target, "not a directory\n");
    assert.deepEqual(await inspectManagedCopy(target, canonical.snapshot), { state: "CONFLICT", reason: "TARGET_NOT_DIRECTORY" });
  } finally {
    await cleanup(canonical.parent, home);
  }
});

test("fresh publication can be rolled back or finalized without residue", async () => {
  const canonical = await makeCanonical();
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-managed-fresh-"));
  const target = path.join(home, ".agents", "skills", "legora");
  try {
    const first = await publishManagedCopy({ target, snapshot: canonical.snapshot, packageVersion: "0.1.0" });
    assert.equal(first.changed, true);
    assert.deepEqual(await inspectManagedCopy(target, canonical.snapshot), { state: "NO_CHANGE", reason: "CURRENT_MANAGED_COPY", installedPackageVersion: "0.1.0" });
    await first.rollback();
    assert.equal(await treeBytes(target), null);

    const second = await publishManagedCopy({ target, snapshot: canonical.snapshot, packageVersion: "0.1.0" });
    await second.finalize();
    assert.deepEqual(await inspectManagedCopy(target, canonical.snapshot), { state: "NO_CHANGE", reason: "CURRENT_MANAGED_COPY", installedPackageVersion: "0.1.0" });
    assert.equal((await fs.readdir(path.dirname(target))).some((name) => name.includes(".legora-stage-") || name.includes(".legora-backup-")), false);
  } finally {
    await cleanup(canonical.parent, home);
  }
});

test("managed update rollback restores exact prior bytes and finalize retains the new copy", async () => {
  const current = await makeCanonical("v1\n");
  const next = await makeCanonical("v2\n");
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-managed-update-"));
  const target = path.join(home, "legora");
  try {
    await writeManagedTarget(target, current.snapshot, "0.1.0");
    const before = await treeBytes(target);

    const update = await publishManagedCopy({ target, snapshot: next.snapshot, packageVersion: "0.2.0" });
    assert.deepEqual(await inspectManagedCopy(target, next.snapshot), { state: "NO_CHANGE", reason: "CURRENT_MANAGED_COPY", installedPackageVersion: "0.2.0" });
    await update.rollback();
    assert.deepEqual(await treeBytes(target), before);

    const committed = await publishManagedCopy({ target, snapshot: next.snapshot, packageVersion: "0.2.0" });
    await committed.finalize();
    assert.deepEqual(await inspectManagedCopy(target, next.snapshot), { state: "NO_CHANGE", reason: "CURRENT_MANAGED_COPY", installedPackageVersion: "0.2.0" });
  } finally {
    await cleanup(current.parent, next.parent, home);
  }
});

test("fresh install rename failure leaves no managed target or transaction residue", async () => {
  const canonical = await makeCanonical();
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-managed-fail-fresh-"));
  const target = path.join(home, "legora");
  const ops = realFileOps({
    rename: async (from, to) => {
      if (to === target && from.includes(".legora-stage-")) throw new Error("injected fresh rename failure");
      await fs.rename(from, to);
    },
  });
  try {
    await assert.rejects(() => publishManagedCopy({ target, snapshot: canonical.snapshot, packageVersion: "0.1.0", fileOps: ops }), /injected/);
    assert.equal(await treeBytes(target), null);
    assert.equal((await fs.readdir(home)).some((name) => name.includes(".legora-stage-") || name.includes(".legora-backup-")), false);
  } finally {
    await cleanup(canonical.parent, home);
  }
});

test("update failure after old target moves to backup restores the old target", async () => {
  const current = await makeCanonical("v1\n");
  const next = await makeCanonical("v2\n");
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-managed-fail-update-"));
  const target = path.join(home, "legora");
  let renames = 0;
  const ops = realFileOps({
    rename: async (from, to) => {
      renames += 1;
      if (renames === 2) throw new Error("injected update publish failure");
      await fs.rename(from, to);
    },
  });
  try {
    await writeManagedTarget(target, current.snapshot);
    const before = await treeBytes(target);
    await assert.rejects(() => publishManagedCopy({ target, snapshot: next.snapshot, packageVersion: "0.2.0", fileOps: ops }), /injected/);
    assert.deepEqual(await treeBytes(target), before);
  } finally {
    await cleanup(current.parent, next.parent, home);
  }
});

test("post-publish validation failure restores the old target", async () => {
  const current = await makeCanonical("v1\n");
  const next = await makeCanonical("v2\n");
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-managed-fail-validate-"));
  const target = path.join(home, "legora");
  let renames = 0;
  const ops = realFileOps({
    rename: async (from, to) => {
      await fs.rename(from, to);
      renames += 1;
    },
    readFile: async (filePath) => {
      if (renames >= 2 && filePath === path.join(target, "SKILL.md")) throw new Error("injected validation failure");
      return fs.readFile(filePath);
    },
  });
  try {
    await writeManagedTarget(target, current.snapshot);
    const before = await treeBytes(target);
    await assert.rejects(() => publishManagedCopy({ target, snapshot: next.snapshot, packageVersion: "0.2.0", fileOps: ops }), /injected/);
    assert.deepEqual(await treeBytes(target), before);
  } finally {
    await cleanup(current.parent, next.parent, home);
  }
});

test("publication rejects traversal in a forged snapshot before writing outside target", async () => {
  const canonical = await makeCanonical();
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-managed-traversal-"));
  const target = path.join(home, "legora");
  const escapeBytes = Buffer.from("escape\n");
  const forged: CanonicalSkillSnapshot = {
    ...canonical.snapshot,
    files: [...canonical.snapshot.files, { relativePath: "../escape.md", bytes: escapeBytes, sha256: hash(escapeBytes) }],
  };
  try {
    await assert.rejects(() => publishManagedCopy({ target, snapshot: forged, packageVersion: "0.1.0" }), /relative path|traversal/i);
    await assert.rejects(() => fs.access(path.join(home, "escape.md")));
  } finally {
    await cleanup(canonical.parent, home);
  }
});
