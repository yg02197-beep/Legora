import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  prepareLegoraEntry,
  runLegoraEntry,
  type LegoraEntryInput,
} from "../../src/entry.ts";

test("Legora Entry exposes a repository-knowledge entry without sliceId or provider refresh input", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-entry-public-"));
  const input = {
    repositoryRoot,
    question: "How does routing work?",
  } satisfies LegoraEntryInput;

  const result = await runLegoraEntry(input);

  assert.equal(result.status, "KNOWLEDGE_NOT_FOUND");
  assert.equal(result.flowRecordId, null);
});

test("prepareLegoraEntry remains a compatibility alias for the Legora-native entry", () => {
  assert.equal(prepareLegoraEntry, runLegoraEntry);
});

test("Entry implementation has no Cartographer runtime, public sliceId, or refresh hook dependency", async () => {
  const sourcePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/entry.ts");
  const source = await fs.readFile(sourcePath, "utf8");

  assert.doesNotMatch(source, /cartographer/i);
  assert.doesNotMatch(source, /sliceId/);
  assert.doesNotMatch(source, /refreshCartographer/);
});
