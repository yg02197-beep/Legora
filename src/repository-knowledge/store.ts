import fs from "node:fs/promises";
import path from "node:path";
import type { KnowledgeEvidenceSet, KnowledgeRecord } from "./contracts.ts";

const STORE_RELATIVE_PATH = path.join(".legora", "repository-knowledge.json");

function knowledgeStorePath(repositoryRoot: string): string {
  return path.join(repositoryRoot, STORE_RELATIVE_PATH);
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

export async function writeKnowledgeRecord(
  repositoryRoot: string,
  record: KnowledgeRecord,
): Promise<void> {
  const records = await readKnowledgeRecords(repositoryRoot);
  const existingIndex = records.findIndex((candidate) => candidate.id === record.id);
  if (existingIndex === -1) records.push(record);
  else records[existingIndex] = record;

  const storePath = knowledgeStorePath(repositoryRoot);
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

export async function promoteKnowledgeEvidence(
  repositoryRoot: string,
  recordId: string,
  activeEvidence: KnowledgeEvidenceSet,
  updatedAt: string,
): Promise<KnowledgeRecord> {
  const records = await readKnowledgeRecords(repositoryRoot);
  const record = records.find((candidate) => candidate.id === recordId);
  if (!record) throw new Error(`Knowledge record not found: ${recordId}`);

  const promoted: KnowledgeRecord = {
    ...record,
    activeEvidence,
    history: [...record.history, record.activeEvidence],
    updatedAt,
  };
  await writeKnowledgeRecord(repositoryRoot, promoted);
  return promoted;
}
