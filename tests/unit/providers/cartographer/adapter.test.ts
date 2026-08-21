import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projectCartographerRepositorySlice } from "../../../../src/providers/cartographer/adapter.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, "../../../fixtures/cartographer/model-v0.8.0.json");

test("facade reads decodes and projects a deterministic repository-local Cartographer model", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-carto-adapter-"));
  const cartographerDir = path.join(repositoryRoot, ".cartographer");
  await fs.mkdir(cartographerDir);
  const fixture = JSON.parse(await fs.readFile(fixturePath, "utf8"));
  fixture.rootPath = repositoryRoot;
  await fs.writeFile(path.join(cartographerDir, "model.json"), JSON.stringify(fixture), "utf8");

  const result = await projectCartographerRepositorySlice({
    repositoryRoot,
    sliceId: "slice:main",
  });

  assert.equal(result.provider.kind, "CARTOGRAPHER");
  assert.equal(result.provider.decoderContract, "cartographer-decoder-v1");
  assert.equal(result.provider.sliceId, "slice:main");
  assert.equal(result.behaviorSlice.owner, "LEGORA");
  assert.ok(result.behaviorSlice.flows.length > 0);
  assert.ok(result.behaviorSlice.flows.every((fact) => fact.providerRefs.length > 0));
  assert.ok(result.behaviorSlice.flows.every((fact) => fact.requiredEvidenceClaimIds.every(
    (id) => result.evidenceClaims.some((claim) => claim.id === id),
  )));
});
