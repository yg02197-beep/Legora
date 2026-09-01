import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { acquireRepositoryKnowledge } from "../../../src/repository-knowledge/acquisition-service.ts";
import { readKnowledgeRecords } from "../../../src/repository-knowledge/store.ts";

async function makeRepository(): Promise<string> {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-capture-override-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "primary.ts"), "primary();\n", "utf8");
  await fs.writeFile(path.join(repositoryRoot, "src", "other.ts"), "other();\n", "utf8");
  return repositoryRoot;
}

function proposal(evidenceCaptureLocators: Array<{ filePath: string; lineStart: number }>) {
  return {
    candidates: [{
      id: "native:entity:primary",
      kind: "entity:service",
      subject: "Primary service",
      structure: { type: "ENTITY" as const, entityKind: "service", name: "Primary" },
      evidenceLocators: [{ filePath: "src/primary.ts", lineStart: 1 }],
      evidenceCaptureLocators,
    }],
  };
}

test("acquisition rejects an empty evidence capture override instead of publishing evidence-free knowledge", async () => {
  const repositoryRoot = await makeRepository();

  const result = await acquireRepositoryKnowledge({
    repositoryRoot,
    proposal: proposal([]),
  });

  assert.equal(result.status, "REJECTED");
  assert.equal(result.code, "STRUCTURE_INVALID");
  assert.deepEqual(await readKnowledgeRecords(repositoryRoot), []);
});

test("acquisition rejects a capture override that drops the candidate's declared evidence locators", async () => {
  const repositoryRoot = await makeRepository();

  const result = await acquireRepositoryKnowledge({
    repositoryRoot,
    proposal: proposal([{ filePath: "src/other.ts", lineStart: 1 }]),
  });

  assert.equal(result.status, "REJECTED");
  assert.equal(result.code, "STRUCTURE_INVALID");
  assert.deepEqual(await readKnowledgeRecords(repositoryRoot), []);
});
