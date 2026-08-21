import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importCartographerModelView } from "../../../src/repository-knowledge/cartographer-import.ts";
import { decodeCartographerModel } from "../../../src/providers/cartographer/decoder.ts";
import { readCartographerModelDocument } from "../../../src/providers/cartographer/source.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, "../../..");

test("actual Cartographer model maps into repository knowledge without provider runtime calls", async () => {
  const document = await readCartographerModelDocument(repositoryRoot);
  const model = decodeCartographerModel(document, repositoryRoot);
  const result = importCartographerModelView(model, "2026-08-22T00:00:00.000Z");

  assert.equal(
    result.records.length,
    model.entities.length + model.relationships.length + model.slices.length,
  );
  assert.ok(result.records.some((record) => record.kind.startsWith("entity:")));
  assert.ok(result.records.some((record) => record.kind.startsWith("relationship:")));
  assert.ok(result.records.some((record) => record.kind.startsWith("behavior-flow:")));
  assert.ok(result.records.every((record) => record.id.startsWith("cartographer:")));
});
