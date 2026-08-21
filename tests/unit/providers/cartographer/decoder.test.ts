import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeCartographerModel } from "../../../../src/providers/cartographer/decoder.ts";
import { CartographerAdapterError } from "../../../../src/providers/cartographer/errors.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, "../../../fixtures/cartographer/model-v0.8.0.json");

async function fixture(): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(fixturePath, "utf8")) as Record<string, unknown>;
}

test("observed v0.8.0-style model decodes into an ephemeral model view", async () => {
  const document = await fixture();
  const model = decodeCartographerModel(document, "D:/Projects/Fixture");
  assert.equal(model.rootPath, "D:/Projects/Fixture");
  assert.equal(model.entities.length, 9);
  assert.equal(model.relationships.length, 5);
  assert.equal(model.slices.length, 1);
  assert.ok(model.decodeDiagnostics.ignoredFields.includes("extraTopLevel"));
});

test("missing required top-level field fails closed", async () => {
  const document = await fixture();
  delete document.entities;
  assert.throws(
    () => decodeCartographerModel(document, "D:/Projects/Fixture"),
    (error: unknown) => error instanceof CartographerAdapterError && error.code === "CARTOGRAPHER_MODEL_SHAPE_UNSUPPORTED",
  );
});

test("repository root mismatch fails closed", async () => {
  const document = await fixture();
  assert.throws(
    () => decodeCartographerModel(document, "D:/Projects/Other"),
    (error: unknown) => error instanceof CartographerAdapterError && error.code === "CARTOGRAPHER_ROOT_MISMATCH",
  );
});

test("duplicate provider object ids fail closed", async () => {
  const document = await fixture();
  const entities = document.entities as unknown[];
  entities.push(structuredClone(entities[0]));
  assert.throws(
    () => decodeCartographerModel(document, "D:/Projects/Fixture"),
    (error: unknown) => error instanceof CartographerAdapterError && error.code === "CARTOGRAPHER_DUPLICATE_ID",
  );
});

test("slice step referencing a missing entity fails closed", async () => {
  const document = await fixture();
  const slices = document.slices as Array<{ steps: Array<{ entityId: string }> }>;
  slices[0]!.steps.push({ entityId: "entity:missing" });
  assert.throws(
    () => decodeCartographerModel(document, "D:/Projects/Fixture"),
    (error: unknown) => error instanceof CartographerAdapterError && error.code === "CARTOGRAPHER_SLICE_ENTITY_NOT_FOUND",
  );
});
