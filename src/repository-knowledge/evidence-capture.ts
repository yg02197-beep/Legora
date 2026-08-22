import fs from "node:fs/promises";
import path from "node:path";

export type EvidenceCaptureResult =
  | {
      status: "CAPTURED";
      evidence: {
        filePath: string;
        lineStart: number;
        lineEnd: number;
        snippet: string;
      };
    }
  | {
      status: "REJECTED";
      reason: string;
    };

export async function captureEvidence(input: {
  repositoryRoot: string;
  locator: {
    filePath: string;
    lineStart: number;
    lineEnd?: number;
  };
  readFile: (filePath: string) => Promise<string>;
}): Promise<EvidenceCaptureResult> {
  if (path.isAbsolute(input.locator.filePath)) {
    return { status: "REJECTED", reason: "EVIDENCE_PATH_MUST_BE_RELATIVE" };
  }

  const root = path.resolve(input.repositoryRoot);
  const target = path.resolve(root, input.locator.filePath);

  if (!target.startsWith(`${root}${path.sep}`) && target !== root) {
    return { status: "REJECTED", reason: "EVIDENCE_OUTSIDE_REPOSITORY" };
  }

  const start = input.locator.lineStart;
  const end = input.locator.lineEnd ?? start;

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    return { status: "REJECTED", reason: "INVALID_LINE_RANGE" };
  }

  let realRoot: string;
  let realTarget: string;
  try {
    realRoot = await fs.realpath(root);
    realTarget = await fs.realpath(target);
  } catch (error) {
    return {
      status: "REJECTED",
      reason: (error as NodeJS.ErrnoException).code ?? "EVIDENCE_REALPATH_FAILED",
    };
  }

  const realRelative = path.relative(realRoot, realTarget);
  if (realRelative === ".." || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
    return { status: "REJECTED", reason: "EVIDENCE_OUTSIDE_REPOSITORY" };
  }

  const content = await input.readFile(realTarget);
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  if (end > lines.length) {
    return { status: "REJECTED", reason: "INVALID_LINE_RANGE" };
  }

  return {
    status: "CAPTURED",
    evidence: {
      filePath: input.locator.filePath,
      lineStart: start,
      lineEnd: end,
      snippet: lines.slice(start - 1, end).join("\n"),
    },
  };
}
