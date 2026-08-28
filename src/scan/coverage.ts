import path from "node:path";
import type { KnowledgeRecord } from "../repository-knowledge/contracts.ts";
import { checkKnowledgeRecordFreshness } from "../repository-knowledge/freshness.ts";
import { readKnowledgeRecords } from "../repository-knowledge/store.ts";
import type { CoverageStatus, FileInventoryEntry, ModuleSummary, ScanResult } from "./contracts.ts";
import { collectRepositoryInventory } from "./inventory.ts";

export interface ScanOptions {
  depth?: "file" | "module";
}

export async function computeScanCoverage(
  repositoryRoot: string,
  options?: ScanOptions,
): Promise<ScanResult> {
  const depth = options?.depth ?? "module";
  const inventory = await collectRepositoryInventory(repositoryRoot);
  const records = await readKnowledgeRecords(repositoryRoot);

  // Build map: filePath -> set of records that reference it via activeEvidence
  const fileToRecords = new Map<string, KnowledgeRecord[]>();
  for (const record of records) {
    for (const anchor of record.activeEvidence) {
      const normalized = anchor.filePath;
      const existing = fileToRecords.get(normalized);
      if (existing) {
        existing.push(record);
      } else {
        fileToRecords.set(normalized, [record]);
      }
    }
  }

  // Determine coverage for each file
  const files: FileInventoryEntry[] = [];
  const freshnessCache = new Map<string, string>();

  for (const filePath of inventory) {
    const referencingRecords = fileToRecords.get(filePath);
    if (!referencingRecords || referencingRecords.length === 0) {
      files.push({ filePath, coverageStatus: "uncovered" });
      continue;
    }

    let coverageStatus: CoverageStatus = "stale";
    for (const record of referencingRecords) {
      let status = freshnessCache.get(record.id);
      if (status === undefined) {
        const freshnessResult = await checkKnowledgeRecordFreshness(repositoryRoot, record);
        status = freshnessResult.status;
        freshnessCache.set(record.id, status);
      }
      if (status === "CURRENT") {
        coverageStatus = "covered";
        break;
      }
    }
    files.push({ filePath, coverageStatus });
  }

  // Compute module grouping
  const moduleMap = new Map<string, FileInventoryEntry[]>();
  for (const entry of files) {
    const module = path.dirname(entry.filePath);
    const existing = moduleMap.get(module);
    if (existing) {
      existing.push(entry);
    } else {
      moduleMap.set(module, [entry]);
    }
  }

  const modules: ModuleSummary[] = [];
  for (const [module, moduleFiles] of moduleMap) {
    const covered = moduleFiles.filter((f) => f.coverageStatus === "covered").length;
    const stale = moduleFiles.filter((f) => f.coverageStatus === "stale").length;
    const uncovered = moduleFiles.filter((f) => f.coverageStatus === "uncovered").length;
    modules.push({
      module,
      total: moduleFiles.length,
      covered,
      stale,
      uncovered,
      files: moduleFiles,
    });
  }
  modules.sort((a, b) => a.module.localeCompare(b.module));

  const coveredFiles = files.filter((f) => f.coverageStatus === "covered").length;
  const staleFiles = files.filter((f) => f.coverageStatus === "stale").length;
  const uncoveredFiles = files.filter((f) => f.coverageStatus === "uncovered").length;

  return {
    totalFiles: files.length,
    coveredFiles,
    staleFiles,
    uncoveredFiles,
    modules,
    files,
    depth,
  };
}
