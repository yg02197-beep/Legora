export type CoverageStatus = "covered" | "stale" | "uncovered";

export interface FileInventoryEntry {
  filePath: string;
  coverageStatus: CoverageStatus;
}

export interface ModuleSummary {
  module: string;
  total: number;
  covered: number;
  stale: number;
  uncovered: number;
  files: FileInventoryEntry[];
}

export interface ScanResult {
  totalFiles: number;
  coveredFiles: number;
  staleFiles: number;
  uncoveredFiles: number;
  modules: ModuleSummary[];
  files: FileInventoryEntry[];
  depth: "file" | "module";
}
