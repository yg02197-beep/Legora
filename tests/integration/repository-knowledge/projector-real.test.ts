import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateExecutableFact } from "../../../src/core/executable-evidence-gate.ts";
import type { BehaviorSlice, EvidenceClaim } from "../../../src/core/contracts.ts";
import { decodeCartographerModel } from "../../../src/providers/cartographer/decoder.ts";
import { projectCartographerSlice } from "../../../src/providers/cartographer/projector.ts";
import { readCartographerModelDocument } from "../../../src/providers/cartographer/source.ts";
import { importCartographerModelView } from "../../../src/repository-knowledge/cartographer-import.ts";
import { projectKnowledgeBehaviorSlice } from "../../../src/repository-knowledge/projector.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, "../../..");
const sliceId = "slice:Lock enabled refresh deduplication";

function behaviorText(slice: BehaviorSlice) {
  return {
    participants: slice.participants.map((fact) => fact.text),
    states: slice.states.map((fact) => fact.text),
    events: slice.events.map((fact) => fact.text),
    flows: slice.flows.map((fact) => fact.text),
    constraints: slice.constraints.map((fact) => fact.text),
    effects: slice.effects.map((fact) => fact.text),
    failures: slice.failures.map((fact) => fact.text),
  };
}

function executableByText(slice: BehaviorSlice, evidenceClaims: readonly EvidenceClaim[]) {
  return [
    ...slice.participants,
    ...slice.states,
    ...slice.events,
    ...slice.flows,
    ...slice.constraints,
    ...slice.effects,
    ...slice.failures,
  ].map((fact) => [fact.text, evaluateExecutableFact(fact, evidenceClaims).eligible] as const);
}

test("actual Cartographer projection and absorbed Repository Knowledge projection preserve behavior and executable evidence decisions", async () => {
  const document = await readCartographerModelDocument(repositoryRoot);
  const model = decodeCartographerModel(document, repositoryRoot);
  const oldProjection = projectCartographerSlice(model, sliceId);
  const imported = importCartographerModelView(model, "2026-08-22T00:00:00.000Z");
  const newProjection = projectKnowledgeBehaviorSlice(imported.records, `cartographer:flow:${sliceId}`);

  assert.equal(newProjection.source.kind, "REPOSITORY_KNOWLEDGE");
  assert.deepEqual(behaviorText(newProjection.behaviorSlice), behaviorText(oldProjection.behaviorSlice));
  assert.deepEqual(
    executableByText(newProjection.behaviorSlice, newProjection.evidenceClaims),
    executableByText(oldProjection.behaviorSlice, oldProjection.evidenceClaims),
  );
});
