import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  importCartographerModelView,
  importCartographerRepositoryKnowledge,
} from "../../../src/repository-knowledge/cartographer-import.ts";
import { readKnowledgeRecords } from "../../../src/repository-knowledge/store.ts";
import type { CartographerModelView } from "../../../src/providers/cartographer/model-view.ts";

function fixtureModel(): CartographerModelView {
  return {
    id: "model:fixture",
    rootPath: "D:/Projects/fixture",
    entities: [{
      id: "capability:route",
      kind: "capability",
      name: "routeRequest",
      description: "Routes an incoming request.",
      evidence: [{
        confidence: "proven",
        provenance: "deterministic",
        anchors: [{ filePath: "src/route.ts", lineStart: 2, lineEnd: 3, snippet: "route();" }],
      }],
    }],
    relationships: [{
      id: "capability:route>triggers>side-effect:dispatch",
      kind: "triggers",
      source: "capability:route",
      target: "side-effect:dispatch",
      description: "Routing triggers dispatch.",
      evidence: [{
        confidence: "high",
        anchors: [{ filePath: "src/route.ts", lineStart: 4, snippet: "dispatch();" }],
      }],
    }],
    slices: [{
      id: "slice:request-routing",
      name: "Request routing",
      kind: "flow",
      steps: [{ entityId: "capability:route", label: "Route request" }],
      evidence: [{
        confidence: "proven",
        anchors: [{ filePath: "src/route.ts", lineStart: 2, lineEnd: 4, snippet: "route();\ndispatch();" }],
      }],
    }],
    decodeDiagnostics: { warnings: [], ignoredFields: [] },
  };
}

test("Cartographer model objects import as namespaced Legora knowledge records", () => {
  const result = importCartographerModelView(fixtureModel(), "2026-08-22T00:00:00.000Z");

  assert.deepEqual(result.records.map((record) => record.id), [
    "cartographer:entity:capability:route",
    "cartographer:relationship:capability:route>triggers>side-effect:dispatch",
    "cartographer:flow:slice:request-routing",
  ]);
  assert.deepEqual(result.records.map((record) => record.kind), [
    "entity:capability",
    "relationship:triggers",
    "behavior-flow:flow",
  ]);
  assert.deepEqual(result.records[0]?.activeEvidence, [
    {
      filePath: "src/route.ts",
      lineStart: 2,
      lineEnd: 3,
      snippet: "route();",
      confidence: "CONFIRMED",
      sourceConfidence: "proven",
      provenance: "deterministic",
    },
  ]);
  assert.deepEqual(result.records[0]?.structure, {
    type: "ENTITY",
    entityKind: "capability",
    name: "routeRequest",
    description: "Routes an incoming request.",
  });
  assert.deepEqual(result.records[1]?.structure, {
    type: "RELATIONSHIP",
    relationshipKind: "triggers",
    sourceId: "cartographer:entity:capability:route",
    targetId: "cartographer:entity:side-effect:dispatch",
  });
  assert.deepEqual(result.records[2]?.structure, {
    type: "BEHAVIOR_FLOW",
    flowKind: "flow",
    name: "Request routing",
    steps: [{ entityId: "cartographer:entity:capability:route", label: "Route request" }],
  });
  assert.equal(result.records[1]?.activeEvidence[0]?.confidence, "INFERRED");
  assert.match(result.records[1]?.subject ?? "", /capability:route.*triggers.*side-effect:dispatch/);
  assert.match(result.records[2]?.subject ?? "", /capability:route.*Route request/);
  assert.ok(result.records.every((record) => record.history.length === 0));
  assert.ok(result.records.every((record) => record.createdAt === "2026-08-22T00:00:00.000Z"));
});

test("repository import reads decodes and persists Cartographer knowledge", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cartographer-import-"));
  await fs.mkdir(path.join(repositoryRoot, ".cartographer"));
  const document = {
    id: "model:fixture",
    rootPath: repositoryRoot,
    entities: [{
      id: "capability:route",
      kind: "capability",
      name: "routeRequest",
      evidence: [{
        confidence: "proven",
        anchors: [{ filePath: "src/route.ts", lineStart: 1, snippet: "route();" }],
      }],
    }],
    relationships: [],
    slices: [],
  };
  await fs.writeFile(
    path.join(repositoryRoot, ".cartographer", "model.json"),
    JSON.stringify(document),
    "utf8",
  );

  const result = await importCartographerRepositoryKnowledge(
    repositoryRoot,
    "2026-08-22T00:10:00.000Z",
  );

  assert.deepEqual(result.records.map((record) => record.id), [
    "cartographer:entity:capability:route",
  ]);
  assert.deepEqual(await readKnowledgeRecords(repositoryRoot), result.records);
});

test("re-import preserves createdAt and promotes changed active evidence into history", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cartographer-reimport-"));
  await fs.mkdir(path.join(repositoryRoot, ".cartographer"));
  const modelPath = path.join(repositoryRoot, ".cartographer", "model.json");
  const document = {
    id: "model:fixture",
    rootPath: repositoryRoot,
    entities: [{
      id: "capability:route",
      kind: "capability",
      name: "routeRequest",
      evidence: [{
        confidence: "proven",
        anchors: [{ filePath: "src/route.ts", lineStart: 1, snippet: "old" }],
      }],
    }],
    relationships: [],
    slices: [],
  };
  await fs.writeFile(modelPath, JSON.stringify(document), "utf8");
  await importCartographerRepositoryKnowledge(repositoryRoot, "2026-08-22T00:00:00.000Z");

  await importCartographerRepositoryKnowledge(repositoryRoot, "2026-08-22T00:05:00.000Z");
  let [record] = await readKnowledgeRecords(repositoryRoot);
  assert.ok(record);
  assert.equal(record.createdAt, "2026-08-22T00:00:00.000Z");
  assert.deepEqual(record.history, []);

  document.entities[0]!.evidence[0]!.anchors[0]!.snippet = "current";
  await fs.writeFile(modelPath, JSON.stringify(document), "utf8");
  await importCartographerRepositoryKnowledge(repositoryRoot, "2026-08-22T00:10:00.000Z");

  [record] = await readKnowledgeRecords(repositoryRoot);
  assert.ok(record);
  assert.equal(record.createdAt, "2026-08-22T00:00:00.000Z");
  assert.equal(record.updatedAt, "2026-08-22T00:10:00.000Z");
  assert.deepEqual(record.activeEvidence, [
    {
      filePath: "src/route.ts",
      lineStart: 1,
      snippet: "current",
      confidence: "CONFIRMED",
      sourceConfidence: "proven",
      provenance: null,
    },
  ]);
  assert.deepEqual(record.history, [[
    {
      filePath: "src/route.ts",
      lineStart: 1,
      snippet: "old",
      confidence: "CONFIRMED",
      sourceConfidence: "proven",
      provenance: null,
    },
  ]]);
});

test("invalid Cartographer anchors are not promoted into active evidence", () => {
  const model = fixtureModel();
  model.entities[0]!.evidence = [{
    confidence: "proven",
    anchors: [{ filePath: "", lineStart: 0, snippet: "invalid" }],
  }];

  const result = importCartographerModelView(model, "2026-08-22T00:00:00.000Z");

  assert.deepEqual(result.records[0]?.activeEvidence, []);
  assert.ok(result.diagnostics.some((item) => item.code === "CARTOGRAPHER_INVALID_SOURCE_ANCHOR"));
});
