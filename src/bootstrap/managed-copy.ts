import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { CanonicalSkillSnapshot } from "../skills/canonical.ts";
import type {
  BootstrapFileOps,
  LegoraInstallManifest,
  ManagedCopyInspection,
  ManagedCopyPublication,
} from "./contracts.ts";

const MANIFEST_NAME = ".legora-install.json";
const SHA256 = /^[a-f0-9]{64}$/;

const DEFAULT_FILE_OPS: BootstrapFileOps = {
  lstat: (filePath) => fs.lstat(filePath),
  mkdir: (filePath, options) => fs.mkdir(filePath, options),
  readFile: (filePath) => fs.readFile(filePath),
  writeFile: (filePath, data) => fs.writeFile(filePath, data),
  readdir: (filePath, options) => fs.readdir(filePath, options),
  rename: (from, to) => fs.rename(from, to),
  rm: (filePath, options) => fs.rm(filePath, options),
};

function digest(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isEnoent(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

function isSafeManagedRelativePath(relativePath: string): boolean {
  if (!relativePath || relativePath === MANIFEST_NAME) return false;
  if (relativePath.includes("\\")) return false;
  if (path.posix.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) return false;
  if (path.posix.normalize(relativePath) !== relativePath) return false;
  const segments = relativePath.split("/");
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function nativePath(root: string, relativePath: string): string {
  return path.join(root, ...relativePath.split("/"));
}

function canonicalManifest(snapshot: CanonicalSkillSnapshot, packageVersion: string): LegoraInstallManifest {
  return {
    schemaVersion: 1,
    packageVersion,
    payloadDigest: snapshot.payloadDigest,
    files: [...snapshot.files]
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
      .map(({ relativePath, sha256 }) => ({ relativePath, sha256 })),
  };
}

function isValidManifest(value: unknown): value is LegoraInstallManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1) return false;
  if (typeof record.packageVersion !== "string" || !record.packageVersion.trim()) return false;
  if (typeof record.payloadDigest !== "string" || !SHA256.test(record.payloadDigest)) return false;
  if (!Array.isArray(record.files) || record.files.length === 0) return false;

  const seen = new Set<string>();
  for (const item of record.files) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const file = item as Record<string, unknown>;
    if (typeof file.relativePath !== "string" || !isSafeManagedRelativePath(file.relativePath)) return false;
    if (seen.has(file.relativePath)) return false;
    seen.add(file.relativePath);
    if (typeof file.sha256 !== "string" || !SHA256.test(file.sha256)) return false;
  }
  const files = record.files as Array<{ relativePath: string; sha256: string }>;
  const computedPayloadDigest = digest(
    [...files]
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
      .map((file) => `${file.relativePath}\0${file.sha256}\n`)
      .join(""),
  );
  if (computedPayloadDigest !== record.payloadDigest) return false;
  return true;
}

async function readManifest(
  target: string,
  fileOps: BootstrapFileOps,
): Promise<{ kind: "missing" } | { kind: "invalid" } | { kind: "valid"; manifest: LegoraInstallManifest }> {
  let bytes: Buffer;
  try {
    bytes = await fileOps.readFile(path.join(target, MANIFEST_NAME));
  } catch (error) {
    if (isEnoent(error)) return { kind: "missing" };
    throw error;
  }
  try {
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    return isValidManifest(parsed) ? { kind: "valid", manifest: parsed } : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

async function enumerateInstalledFiles(
  root: string,
  current: string,
  fileOps: BootstrapFileOps,
): Promise<{ files: string[]; special: boolean }> {
  const files: string[] = [];
  let special = false;
  for (const entry of await fileOps.readdir(current, { withFileTypes: true })) {
    const fullPath = path.join(current, entry.name);
    const relativePath = path.relative(root, fullPath).split(path.sep).join("/");
    if (entry.isSymbolicLink()) {
      special = true;
      continue;
    }
    if (entry.isDirectory()) {
      const nested = await enumerateInstalledFiles(root, fullPath, fileOps);
      files.push(...nested.files);
      special ||= nested.special;
      continue;
    }
    if (!entry.isFile()) {
      special = true;
      continue;
    }
    files.push(relativePath);
  }
  files.sort();
  return { files, special };
}

function snapshotManifestMatches(snapshot: CanonicalSkillSnapshot, manifest: LegoraInstallManifest): boolean {
  const expected = canonicalManifest(snapshot, manifest.packageVersion);
  if (expected.files.length !== manifest.files.length) return false;
  return expected.files.every((file, index) => {
    const actual = [...manifest.files].sort((a, b) => a.relativePath.localeCompare(b.relativePath))[index];
    return actual?.relativePath === file.relativePath && actual.sha256 === file.sha256;
  });
}

async function inspectManagedCopyWithOps(
  target: string,
  snapshot: CanonicalSkillSnapshot,
  fileOps: BootstrapFileOps,
): Promise<ManagedCopyInspection> {
  let targetStat: import("node:fs").Stats;
  try {
    targetStat = await fileOps.lstat(target);
  } catch (error) {
    if (isEnoent(error)) return { state: "ABSENT", reason: "TARGET_ABSENT" };
    throw error;
  }
  if (!targetStat.isDirectory() || targetStat.isSymbolicLink()) {
    return { state: "CONFLICT", reason: "TARGET_NOT_DIRECTORY" };
  }

  const manifestResult = await readManifest(target, fileOps);
  if (manifestResult.kind === "missing") return { state: "CONFLICT", reason: "UNOWNED_TARGET" };
  if (manifestResult.kind === "invalid") return { state: "CONFLICT", reason: "MANIFEST_INVALID" };
  const manifest = manifestResult.manifest;

  for (const file of manifest.files) {
    let bytes: Buffer;
    try {
      bytes = await fileOps.readFile(nativePath(target, file.relativePath));
    } catch (error) {
      if (isEnoent(error)) return { state: "CONFLICT", reason: "MANAGED_FILE_MISSING" };
      throw error;
    }
    if (digest(bytes) !== file.sha256) return { state: "CONFLICT", reason: "MANAGED_FILE_MODIFIED" };
  }

  const inventory = await enumerateInstalledFiles(target, target, fileOps);
  if (inventory.special) return { state: "CONFLICT", reason: "MANAGED_FILE_MODIFIED" };
  const expectedPaths = [...manifest.files.map((file) => file.relativePath), MANIFEST_NAME].sort();
  if (inventory.files.length !== expectedPaths.length || inventory.files.some((file, index) => file !== expectedPaths[index])) {
    return { state: "CONFLICT", reason: "MANAGED_FILE_MODIFIED" };
  }

  if (manifest.payloadDigest === snapshot.payloadDigest) {
    if (!snapshotManifestMatches(snapshot, manifest)) return { state: "CONFLICT", reason: "MANIFEST_INVALID" };
    return { state: "NO_CHANGE", reason: "CURRENT_MANAGED_COPY", installedPackageVersion: manifest.packageVersion };
  }
  return { state: "MANAGED_UPDATE", reason: "PACKAGED_PAYLOAD_CHANGED", installedPackageVersion: manifest.packageVersion };
}

function validateSnapshotIntegrity(snapshot: CanonicalSkillSnapshot): void {
  const sorted = [...snapshot.files].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  if (sorted.length === 0) throw new Error("Canonical snapshot contains no managed files.");
  const seen = new Set<string>();
  for (const file of sorted) {
    if (!isSafeManagedRelativePath(file.relativePath)) {
      throw new Error(`Invalid managed relative path or traversal: ${file.relativePath}`);
    }
    if (seen.has(file.relativePath)) throw new Error(`Duplicate managed relative path: ${file.relativePath}`);
    seen.add(file.relativePath);
    if (digest(file.bytes) !== file.sha256) throw new Error(`Canonical snapshot file digest mismatch: ${file.relativePath}`);
  }
  const computed = digest(sorted.map((file) => `${file.relativePath}\0${file.sha256}\n`).join(""));
  if (computed !== snapshot.payloadDigest) throw new Error("Canonical snapshot payload digest mismatch.");
}

async function materializeStage(
  stage: string,
  snapshot: CanonicalSkillSnapshot,
  packageVersion: string,
  fileOps: BootstrapFileOps,
): Promise<void> {
  await fileOps.mkdir(stage, { recursive: false });
  for (const file of snapshot.files) {
    const filePath = nativePath(stage, file.relativePath);
    await fileOps.mkdir(path.dirname(filePath), { recursive: true });
    await fileOps.writeFile(filePath, file.bytes);
  }
  const manifest = canonicalManifest(snapshot, packageVersion);
  await fileOps.writeFile(path.join(stage, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function validatePublishedTarget(
  target: string,
  snapshot: CanonicalSkillSnapshot,
  fileOps: BootstrapFileOps,
): Promise<void> {
  const inspection = await inspectManagedCopyWithOps(target, snapshot, fileOps);
  if (inspection.state !== "NO_CHANGE") {
    throw new Error(`Published managed copy failed validation: ${inspection.reason}`);
  }
}

async function safeRemove(filePath: string, fileOps: BootstrapFileOps): Promise<void> {
  try {
    await fileOps.rm(filePath, { recursive: true, force: true });
  } catch {
    // Owned transaction residue cleanup is best effort; primary failures remain authoritative.
  }
}

async function exists(filePath: string, fileOps: BootstrapFileOps): Promise<boolean> {
  try {
    await fileOps.lstat(filePath);
    return true;
  } catch (error) {
    if (isEnoent(error)) return false;
    throw error;
  }
}

export async function inspectManagedCopy(
  target: string,
  snapshot: CanonicalSkillSnapshot,
): Promise<ManagedCopyInspection> {
  return inspectManagedCopyWithOps(target, snapshot, DEFAULT_FILE_OPS);
}

export async function publishManagedCopy(input: {
  target: string;
  snapshot: CanonicalSkillSnapshot;
  packageVersion: string;
  fileOps?: BootstrapFileOps;
}): Promise<ManagedCopyPublication> {
  const { target, snapshot, packageVersion } = input;
  const fileOps = input.fileOps ?? DEFAULT_FILE_OPS;
  if (!packageVersion.trim()) throw new Error("A package version is required for managed publication.");
  validateSnapshotIntegrity(snapshot);

  const inspection = await inspectManagedCopyWithOps(target, snapshot, fileOps);
  if (inspection.state === "CONFLICT") {
    throw new Error(`Managed Skill target conflict: ${inspection.reason}`);
  }
  if (inspection.state === "NO_CHANGE") {
    return {
      changed: false,
      target,
      rollback: async () => {},
      finalize: async () => {},
    };
  }

  await fileOps.mkdir(path.dirname(target), { recursive: true });
  const token = randomUUID();
  const stage = `${target}.legora-stage-${token}`;
  const backup = `${target}.legora-backup-${token}`;
  let backupRetained = false;
  let published = false;

  try {
    await materializeStage(stage, snapshot, packageVersion, fileOps);
    await validatePublishedTarget(stage, snapshot, fileOps);

    if (inspection.state === "MANAGED_UPDATE") {
      await fileOps.rename(target, backup);
      backupRetained = true;
    }

    await fileOps.rename(stage, target);
    published = true;
    await validatePublishedTarget(target, snapshot, fileOps);
  } catch (error) {
    if (published) await safeRemove(target, fileOps);
    if (backupRetained) {
      try {
        await fileOps.rename(backup, target);
        backupRetained = false;
      } catch (restoreError) {
        await safeRemove(stage, fileOps);
        throw new AggregateError([error, restoreError], "Managed Skill publication failed and rollback restoration also failed.");
      }
    }
    await safeRemove(stage, fileOps);
    throw error;
  }

  let receiptState: "OPEN" | "ROLLED_BACK" | "FINALIZED" = "OPEN";
  const rollback = async (): Promise<void> => {
    if (receiptState !== "OPEN") return;
    if (await exists(target, fileOps)) {
      await validatePublishedTarget(target, snapshot, fileOps);
      await fileOps.rm(target, { recursive: true, force: true });
    }
    if (backupRetained) {
      await fileOps.rename(backup, target);
      backupRetained = false;
    }
    await safeRemove(stage, fileOps);
    receiptState = "ROLLED_BACK";
  };

  const finalize = async (): Promise<void> => {
    if (receiptState !== "OPEN") return;
    if (backupRetained) {
      await fileOps.rm(backup, { recursive: true, force: true });
      backupRetained = false;
    }
    await safeRemove(stage, fileOps);
    receiptState = "FINALIZED";
  };

  return { changed: true, target, rollback, finalize };
}
