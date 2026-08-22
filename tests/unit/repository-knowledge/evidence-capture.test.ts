import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { captureEvidence } from "../../../src/repository-knowledge/evidence-capture.ts";

test("captureEvidence creates a verified snippet from a repository-local locator", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-evidence-capture-"));
  await fs.mkdir(path.join(repositoryRoot, "fixtures"));
  await fs.writeFile(path.join(repositoryRoot, "fixtures", "example.ts"), "const value = true;\n", "utf8");
  const result = await captureEvidence({
    repositoryRoot,
    locator: {
      filePath: "fixtures/example.ts",
      lineStart: 1,
      lineEnd: 1,
    },
    readFile: (filePath) => fs.readFile(filePath, "utf8"),
  });

  assert.equal(result.status, "CAPTURED");
  if (result.status === "CAPTURED") {
    assert.equal(result.evidence.snippet, "const value = true;");
  }
});

test("captureEvidence rejects paths outside repository root", async () => {
  const result = await captureEvidence({
    repositoryRoot: "C:/repo",
    locator: {
      filePath: "../outside.ts",
      lineStart: 1,
    },
    readFile: async () => "x",
  });

  assert.equal(result.status, "REJECTED");
});

test("captureEvidence rejects an absolute locator even when it points inside the repository", async () => {
  let reads = 0;
  const result = await captureEvidence({
    repositoryRoot: process.cwd(),
    locator: {
      filePath: path.join(process.cwd(), "package.json"),
      lineStart: 1,
    },
    readFile: async () => {
      reads += 1;
      return "{}";
    },
  });

  assert.equal(result.status, "REJECTED");
  assert.equal(reads, 0);
});

test("captureEvidence rejects a junction or symlink that resolves outside the repository", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-evidence-root-"));
  const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-evidence-outside-"));
  await fs.writeFile(path.join(outsideRoot, "secret.ts"), "outside();\n", "utf8");
  await fs.symlink(outsideRoot, path.join(repositoryRoot, "link"), process.platform === "win32" ? "junction" : "dir");

  const result = await captureEvidence({
    repositoryRoot,
    locator: { filePath: "link/secret.ts", lineStart: 1 },
    readFile: (filePath) => fs.readFile(filePath, "utf8"),
  });

  assert.equal(result.status, "REJECTED");
});

test("captureEvidence rejects fractional line coordinates", async () => {
  const result = await captureEvidence({
    repositoryRoot: process.cwd(),
    locator: { filePath: "package.json", lineStart: 1.5 },
    readFile: async () => "line one\nline two\n",
  });

  assert.equal(result.status, "REJECTED");
});
