import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readCartographerModelDocument } from "../../../../src/providers/cartographer/source.ts";
import { CartographerAdapterError } from "../../../../src/providers/cartographer/errors.ts";

test("source reads repository-local Cartographer model JSON", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "legora-carto-source-"));
  await fs.mkdir(path.join(root, ".cartographer"));
  await fs.writeFile(path.join(root, ".cartographer", "model.json"), JSON.stringify({ rootPath: root }), "utf8");

  const document = await readCartographerModelDocument(root);
  assert.deepEqual(document, { rootPath: root });
});

test("missing model fails with CARTOGRAPHER_MODEL_NOT_FOUND", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "legora-carto-missing-"));
  await assert.rejects(
    () => readCartographerModelDocument(root),
    (error: unknown) => error instanceof CartographerAdapterError && error.code === "CARTOGRAPHER_MODEL_NOT_FOUND",
  );
});

test("unreadable model fails with CARTOGRAPHER_MODEL_UNREADABLE", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "legora-carto-unreadable-"));
  await fs.mkdir(path.join(root, ".cartographer"));
  await fs.mkdir(path.join(root, ".cartographer", "model.json"));
  await assert.rejects(
    () => readCartographerModelDocument(root),
    (error: unknown) => error instanceof CartographerAdapterError && error.code === "CARTOGRAPHER_MODEL_UNREADABLE",
  );
});

test("malformed JSON fails with CARTOGRAPHER_MODEL_INVALID_JSON", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "legora-carto-json-"));
  await fs.mkdir(path.join(root, ".cartographer"));
  await fs.writeFile(path.join(root, ".cartographer", "model.json"), "{", "utf8");
  await assert.rejects(
    () => readCartographerModelDocument(root),
    (error: unknown) => error instanceof CartographerAdapterError && error.code === "CARTOGRAPHER_MODEL_INVALID_JSON",
  );
});
