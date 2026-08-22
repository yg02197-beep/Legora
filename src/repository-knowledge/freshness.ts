import fs from "node:fs/promises";
import path from "node:path";
import type { KnowledgeRecord } from "./contracts.ts";

export type KnowledgeFreshnessStatus = "CURRENT" | "STALE" | "UNKNOWN";

export interface KnowledgeFreshnessIssue {
  code: string;
  filePath?: string;
  message: string;
}

export interface KnowledgeFreshnessResult {
  status: KnowledgeFreshnessStatus;
  checkedAnchors: number;
  issues: KnowledgeFreshnessIssue[];
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function isInsideRepository(repositoryRoot: string, absolutePath: string): boolean {
  const relative = path.relative(path.resolve(repositoryRoot), absolutePath);
  return relative === "" || (
    relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

export async function checkKnowledgeRecordFreshness(
  repositoryRoot: string,
  record: KnowledgeRecord,
): Promise<KnowledgeFreshnessResult> {
  let checkedAnchors = 0;
  const issues: KnowledgeFreshnessIssue[] = [];
  const realRepositoryRoot = await fs.realpath(repositoryRoot);

  for (const anchor of record.activeEvidence) {
    if (!anchor.snippet) {
      issues.push({
        code: "EVIDENCE_SNAPSHOT_UNAVAILABLE",
        filePath: anchor.filePath,
        message: "Active knowledge evidence has no snapshot snippet to compare with the current repository.",
      });
      continue;
    }
    const absolutePath = path.resolve(repositoryRoot, anchor.filePath);
    if (!isInsideRepository(repositoryRoot, absolutePath)) {
      return {
        status: "UNKNOWN",
        checkedAnchors,
        issues: [{
          code: "EVIDENCE_PATH_OUTSIDE_REPOSITORY",
          filePath: anchor.filePath,
          message: "Active knowledge evidence points outside the repository root and was not read.",
        }],
      };
    }
    let realPath: string;
    try {
      realPath = await fs.realpath(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          status: "STALE",
          checkedAnchors,
          issues: [{
            code: "EVIDENCE_FILE_MISSING",
            filePath: anchor.filePath,
            message: "A file referenced by active knowledge evidence no longer exists.",
          }],
        };
      }
      throw error;
    }
    if (!isInsideRepository(realRepositoryRoot, realPath)) {
      return {
        status: "UNKNOWN",
        checkedAnchors,
        issues: [{
          code: "EVIDENCE_PATH_OUTSIDE_REPOSITORY",
          filePath: anchor.filePath,
          message: "Active knowledge evidence resolves outside the repository root and was not read.",
        }],
      };
    }
    let content: string;
    try {
      content = normalizeNewlines(
        await fs.readFile(realPath, "utf8"),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          status: "STALE",
          checkedAnchors,
          issues: [{
            code: "EVIDENCE_FILE_MISSING",
            filePath: anchor.filePath,
            message: "A file referenced by active knowledge evidence no longer exists.",
          }],
        };
      }
      throw error;
    }
    const lineEnd = anchor.lineEnd ?? anchor.lineStart;
    const current = content.split("\n").slice(anchor.lineStart - 1, lineEnd).join("\n");
    checkedAnchors += 1;

    if (current !== normalizeNewlines(anchor.snippet)) {
      return {
        status: "STALE",
        checkedAnchors,
        issues: [{
          code: "EVIDENCE_CONTENT_CHANGED",
          filePath: anchor.filePath,
          message: "Current repository evidence does not match the active knowledge evidence snippet.",
        }],
      };
    }
  }

  if (issues.length > 0) return { status: "UNKNOWN", checkedAnchors, issues };
  if (checkedAnchors === 0) {
    return {
      status: "UNKNOWN",
      checkedAnchors,
      issues: [{
        code: "EVIDENCE_SURFACE_UNCHECKABLE",
        message: "No active knowledge evidence surface could be checked against the current repository.",
      }],
    };
  }

  return { status: "CURRENT", checkedAnchors, issues: [] };
}
