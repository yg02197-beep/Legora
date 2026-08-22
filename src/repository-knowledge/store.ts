import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { KnowledgeEvidenceSet, KnowledgeRecord } from "./contracts.ts";

const STORE_RELATIVE_PATH = path.join(".legora", "repository-knowledge.json");
const STORE_LOCK_FILE = ".repository-knowledge.lock";
const STORE_LOCK_RETRY_MS = 10;
const STORE_LOCK_TIMEOUT_MS = 5_000;
const STORE_LOCK_STALE_MS = 30_000;

function knowledgeStorePath(repositoryRoot: string): string {
  return path.join(repositoryRoot, STORE_RELATIVE_PATH);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function processIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function withKnowledgeStoreLock<T>(
  repositoryRoot: string,
  operation: () => Promise<T>,
): Promise<T> {
  const storeDirectory = path.dirname(knowledgeStorePath(repositoryRoot));
  await fs.mkdir(storeDirectory, { recursive: true });
  const lockPath = path.join(storeDirectory, STORE_LOCK_FILE);
  const token = randomUUID();
  const deadline = Date.now() + STORE_LOCK_TIMEOUT_MS;

  let acquired = false;
  while (!acquired) {
    try {
      const handle = await fs.open(lockPath, "wx");
      try {
        await handle.writeFile(JSON.stringify({ pid: process.pid, token, createdAt: Date.now() }), "utf8");
      } catch (error) {
        await fs.rm(lockPath, { force: true }).catch(() => undefined);
        throw error;
      } finally {
        await handle.close().catch(() => undefined);
      }
      acquired = true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST" && code !== "EPERM") throw error;

      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > STORE_LOCK_STALE_MS) {
          let ownerPid = 0;
          try {
            const lock = JSON.parse(await fs.readFile(lockPath, "utf8")) as { pid?: unknown };
            if (typeof lock.pid === "number") ownerPid = lock.pid;
          } catch {
            ownerPid = 0;
          }
          if (!processIsAlive(ownerPid)) {
            await fs.rm(lockPath, { force: true });
            continue;
          }
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw statError;
      }

      if (Date.now() >= deadline) {
        throw new Error("Repository knowledge store lock timeout.");
      }
      await sleep(STORE_LOCK_RETRY_MS);
    }
  }

  try {
    return await operation();
  } finally {
    try {
      const lock = JSON.parse(await fs.readFile(lockPath, "utf8")) as { token?: unknown };
      if (lock.token === token) await fs.rm(lockPath, { force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

async function publishKnowledgeRecordsAtomic(
  repositoryRoot: string,
  records: readonly KnowledgeRecord[],
): Promise<void> {
  const storePath = knowledgeStorePath(repositoryRoot);
  const storeDirectory = path.dirname(storePath);
  await fs.mkdir(storeDirectory, { recursive: true });
  const temporaryPath = path.join(
    storeDirectory,
    `.repository-knowledge.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, storePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readKnowledgeRecords(repositoryRoot: string): Promise<KnowledgeRecord[]> {
  const storePath = knowledgeStorePath(repositoryRoot);
  try {
    const raw = await fs.readFile(storePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Repository knowledge store must contain a record array.");
    }
    return parsed as KnowledgeRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export interface KnowledgeRecordsTransaction<T> {
  records?: readonly KnowledgeRecord[];
  result: T;
}

export async function transactKnowledgeRecordsAtomic<T>(
  repositoryRoot: string,
  transaction: (
    records: readonly KnowledgeRecord[],
  ) => KnowledgeRecordsTransaction<T> | Promise<KnowledgeRecordsTransaction<T>>,
): Promise<T> {
  return withKnowledgeStoreLock(repositoryRoot, async () => {
    const currentRecords = await readKnowledgeRecords(repositoryRoot);
    const outcome = await transaction(currentRecords);
    if (outcome.records !== undefined) {
      await publishKnowledgeRecordsAtomic(repositoryRoot, outcome.records);
    }
    return outcome.result;
  });
}

export async function writeKnowledgeRecord(
  repositoryRoot: string,
  record: KnowledgeRecord,
): Promise<void> {
  await upsertKnowledgeRecordsAtomic(repositoryRoot, [record]);
}

export async function upsertKnowledgeRecordsAtomic(
  repositoryRoot: string,
  incomingRecords: readonly KnowledgeRecord[],
): Promise<void> {
  const batchIds = new Set<string>();
  for (const record of incomingRecords) {
    if (batchIds.has(record.id)) {
      throw new Error(`Duplicate knowledge record id in atomic batch: ${record.id}`);
    }
    batchIds.add(record.id);
  }

  await transactKnowledgeRecordsAtomic(repositoryRoot, (currentRecords) => {
    const records = [...currentRecords];
    for (const record of incomingRecords) {
      const existingIndex = records.findIndex((candidate) => candidate.id === record.id);
      if (existingIndex === -1) records.push(record);
      else records[existingIndex] = record;
    }
    return { records, result: undefined };
  });
}

export async function promoteKnowledgeEvidence(
  repositoryRoot: string,
  recordId: string,
  activeEvidence: KnowledgeEvidenceSet,
  updatedAt: string,
): Promise<KnowledgeRecord> {
  return transactKnowledgeRecordsAtomic(repositoryRoot, (currentRecords) => {
    const records = [...currentRecords];
    const recordIndex = records.findIndex((candidate) => candidate.id === recordId);
    if (recordIndex === -1) throw new Error(`Knowledge record not found: ${recordId}`);
    const record = records[recordIndex]!;

    const promoted: KnowledgeRecord = {
      ...record,
      activeEvidence,
      history: [...record.history, record.activeEvidence],
      updatedAt,
    };
    records[recordIndex] = promoted;
    return { records, result: promoted };
  });
}
