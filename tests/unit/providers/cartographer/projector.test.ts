import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeCartographerModel } from "../../../../src/providers/cartographer/decoder.ts";
import { projectCartographerSlice } from "../../../../src/providers/cartographer/projector.ts";
import { CartographerAdapterError } from "../../../../src/providers/cartographer/errors.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, "../../../fixtures/cartographer/model-v0.8.0.json");

async function model() {
  const document = JSON.parse(await fs.readFile(fixturePath, "utf8"));
  return decodeCartographerModel(document, "D:/Projects/Fixture");
}

test("explicit slice becomes a Legora-owned evidence-addressable BehaviorSlice", async () => {
  const result = projectCartographerSlice(await model(), "slice:main");
  assert.equal(result.behaviorSlice.owner, "LEGORA");
  assert.equal(result.behaviorSlice.subject, "Main flow");
  assert.deepEqual(result.behaviorSlice.participants.map((x) => x.text), ["request"]);
  assert.deepEqual(result.behaviorSlice.states.map((x) => x.text), ["expired"]);
  assert.deepEqual(result.behaviorSlice.events.map((x) => x.text), ["request arrives"]);
  assert.deepEqual(result.behaviorSlice.flows.map((x) => x.text), [
    "Expired request arrives",
    "Token is expired",
    "Request arrival is observed",
    "Refresh token",
  ]);
});

test("each flow keeps deterministic provider refs and evidence claims", async () => {
  const result = projectCartographerSlice(await model(), "slice:main");
  const flow = result.behaviorSlice.flows.find((fact) => fact.text === "Refresh token");
  assert.ok(flow);
  assert.deepEqual(flow.providerRefs, ["slice:main", "capability:refresh"]);
  assert.ok(flow.requiredEvidenceClaimIds.includes("slice:main#ev:slice"));
  assert.ok(flow.requiredEvidenceClaimIds.includes("capability:refresh#ev:cap"));
});

test("projected facts receive deterministic Legora-owned ids", async () => {
  const first = projectCartographerSlice(await model(), "slice:main");
  const second = projectCartographerSlice(await model(), "slice:main");

  assert.deepEqual(
    first.behaviorSlice.flows.map((fact) => fact.id),
    second.behaviorSlice.flows.map((fact) => fact.id),
  );
  assert.ok(first.behaviorSlice.flows.every((fact) => /^fact:flows:[a-f0-9]{64}$/.test(fact.id)));
});

test("fact identity does not depend on human-facing text", async () => {
  const decoded = await model();
  const before = projectCartographerSlice(decoded, "slice:main");
  const entity = decoded.entities.find((item) => item.id === "capability:refresh");
  assert.ok(entity);
  const originalId = before.behaviorSlice.flows.find((fact) => fact.text === "Refresh token")!.id;

  const step = decoded.slices.find((item) => item.id === "slice:main")!.steps.find(
    (item) => item.entityId === "capability:refresh",
  )!;
  step.label = "Human wording changed only";

  const after = projectCartographerSlice(decoded, "slice:main");
  const changed = after.behaviorSlice.flows.find((fact) => fact.text === "Human wording changed only")!;
  assert.equal(changed.id, originalId);
});

test("only allowlisted one-hop semantic context becomes constraint effect and failure", async () => {
  const result = projectCartographerSlice(await model(), "slice:main");
  assert.deepEqual(result.behaviorSlice.constraints.map((x) => x.text), [
    "Executable behavior requires confirmed evidence",
  ]);
  assert.deepEqual(result.behaviorSlice.effects.map((x) => x.text), [
    "Understanding asset files are written",
  ]);
  assert.deepEqual(result.behaviorSlice.failures.map((x) => x.text), [
    "Unsupported input is refused",
  ]);
  assert.ok(!result.behaviorSlice.effects.some((x) => /two hop/i.test(x.text)));
});

test("semantic facts bind evidence from semantic entity and explicit relationship", async () => {
  const result = projectCartographerSlice(await model(), "slice:main");
  const constraint = result.behaviorSlice.constraints[0]!;
  assert.deepEqual(constraint.providerRefs, [
    "invariant:confirmed-only",
    "invariant:confirmed-only>guards>capability:refresh",
    "capability:refresh",
  ]);
  assert.ok(constraint.requiredEvidenceClaimIds.includes("invariant:confirmed-only#ev:inv"));
  assert.ok(constraint.requiredEvidenceClaimIds.includes("invariant:confirmed-only>guards>capability:refresh#ev:guards"));
});

test("reverse stored endpoint direction is accepted only for the same explicit guards relation", async () => {
  const decoded = await model();
  const relationship = decoded.relationships.find((item) => item.id === "invariant:confirmed-only>guards>capability:refresh");
  assert.ok(relationship);
  relationship.source = "capability:refresh";
  relationship.target = "invariant:confirmed-only";

  const result = projectCartographerSlice(decoded, "slice:main");
  const constraint = result.behaviorSlice.constraints[0]!;
  assert.deepEqual(constraint.providerRefs, [
    "invariant:confirmed-only",
    "invariant:confirmed-only>guards>capability:refresh",
    "capability:refresh",
  ]);
});

test("arbitrary provider prose is not promoted into a typed constraint", async () => {
  const decoded = await model();
  const capability = decoded.entities.find((entity) => entity.id === "capability:refresh");
  assert.ok(capability);
  capability.description = "Only one refresh can run at a time";

  const result = projectCartographerSlice(decoded, "slice:main");
  assert.ok(!result.behaviorSlice.constraints.some((fact) => /Only one refresh/i.test(fact.text)));
  assert.deepEqual(result.behaviorSlice.constraints.map((fact) => fact.text), [
    "Executable behavior requires confirmed evidence",
  ]);
});

test("two-hop and unrelated relationship semantics are ignored and diagnosed", async () => {
  const result = projectCartographerSlice(await model(), "slice:main");
  assert.ok(result.diagnostics.ignoredRelations.includes("triggers"));
  assert.ok(result.diagnostics.ignoredRelations.includes("contains"));
  assert.ok(result.diagnostics.warnings.some((warning) => warning.code === "CARTOGRAPHER_UNKNOWN_TOP_LEVEL_FIELD"));
});

test("every required evidence claim id resolves in the returned evidence set", async () => {
  const result = projectCartographerSlice(await model(), "slice:main");
  const ids = new Set(result.evidenceClaims.map((claim) => claim.id));
  const allFacts = [
    ...result.behaviorSlice.participants,
    ...result.behaviorSlice.states,
    ...result.behaviorSlice.events,
    ...result.behaviorSlice.flows,
    ...result.behaviorSlice.constraints,
    ...result.behaviorSlice.effects,
    ...result.behaviorSlice.failures,
  ];
  assert.ok(allFacts.every((fact) => fact.requiredEvidenceClaimIds.every((id) => ids.has(id))));
});

test("missing slice fails closed instead of inventing a projection", async () => {
  const decoded = await model();
  assert.throws(
    () => projectCartographerSlice(decoded, "slice:missing"),
    (error: unknown) => error instanceof CartographerAdapterError && error.code === "CARTOGRAPHER_SLICE_NOT_FOUND",
  );
});
