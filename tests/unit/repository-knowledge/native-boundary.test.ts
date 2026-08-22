import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const nativeRuntimeFiles = [
  "src/entry.ts",
  "src/cli/index.ts",
  "src/repository-knowledge/acquisition-contracts.ts",
  "src/repository-knowledge/acquisition-validator.ts",
  "src/repository-knowledge/evidence-capture.ts",
  "src/repository-knowledge/acquisition-service.ts",
  "src/repository-knowledge/freshness.ts",
  "src/repository-knowledge/projector.ts",
  "src/repository-knowledge/query.ts",
  "src/repository-knowledge/store.ts",
];

test("native repository knowledge runtime does not depend on Cartographer control-plane concepts", async () => {
  const source = (await Promise.all(
    nativeRuntimeFiles.map((relativePath) => fs.readFile(path.join(projectRoot, relativePath), "utf8")),
  )).join("\n");

  assert.doesNotMatch(source, /providers\/cartographer/);
  assert.doesNotMatch(source, /\bCartographer\b/);
  assert.doesNotMatch(source, /sliceId/);
  assert.doesNotMatch(source, /refreshCartographer/);
  assert.doesNotMatch(source, /\bmcp\b/i);
});
