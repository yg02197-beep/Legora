import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projectCartographerRepositorySlice } from "../../../../src/providers/cartographer/adapter.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, "../../../..");
const modelPath = path.join(repositoryRoot, ".cartographer", "model.json");

test("actual Cartographer-generated Legora model remains compatible with the production adapter", async () => {
  await fs.access(modelPath);

  const result = await projectCartographerRepositorySlice({
    repositoryRoot,
    sliceId: "slice:Lock enabled refresh deduplication",
  });

  assert.equal(result.behaviorSlice.owner, "LEGORA");
  assert.equal(result.behaviorSlice.subject, "Lock enabled refresh deduplication");
  assert.ok(result.behaviorSlice.participants.some((fact) => fact.text === "expired request"));
  assert.ok(result.behaviorSlice.flows.some((fact) => /in-flight refresh/i.test(fact.text)));
  assert.ok(result.evidenceClaims.length > 0);
  assert.ok(result.evidenceClaims.every((claim) =>
    ["CONFIRMED", "INFERRED", "UNKNOWN"].includes(claim.confidence)
  ));

  const evidenceIds = new Set(result.evidenceClaims.map((claim) => claim.id));
  const allFacts = [
    ...result.behaviorSlice.participants,
    ...result.behaviorSlice.states,
    ...result.behaviorSlice.events,
    ...result.behaviorSlice.flows,
    ...result.behaviorSlice.constraints,
    ...result.behaviorSlice.effects,
    ...result.behaviorSlice.failures,
  ];
  assert.ok(allFacts.every((fact) =>
    fact.requiredEvidenceClaimIds.every((id) => evidenceIds.has(id))
  ));
});
