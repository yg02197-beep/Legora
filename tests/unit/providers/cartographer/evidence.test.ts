import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCartographerEvidence } from "../../../../src/providers/cartographer/evidence.ts";

test("proven plus valid anchor becomes CONFIRMED", () => {
  const claims = normalizeCartographerEvidence({
    id: "entity:one",
    name: "one",
    description: "One claim",
    evidence: [{
      id: "ev:1",
      confidence: "proven",
      provenance: "deterministic",
      anchors: [{ filePath: "src/a.ts", lineStart: 1 }],
    }],
  });
  assert.equal(claims[0]?.confidence, "CONFIRMED");
});

test("high medium and low anchored evidence become INFERRED", () => {
  for (const confidence of ["high", "medium", "low"] as const) {
    const claims = normalizeCartographerEvidence({
      id: `entity:${confidence}`,
      description: confidence,
      evidence: [{
        id: `ev:${confidence}`,
        confidence,
        anchors: [{ filePath: "src/a.ts", lineStart: 2 }],
      }],
    });
    assert.equal(claims[0]?.confidence, "INFERRED");
  }
});

test("speculative and unknown future confidence become UNKNOWN", () => {
  for (const confidence of ["speculative", "future-confidence"]) {
    const claims = normalizeCartographerEvidence({
      id: `entity:${confidence}`,
      description: confidence,
      evidence: [{
        id: `ev:${confidence}`,
        confidence,
        anchors: [{ filePath: "src/a.ts", lineStart: 3 }],
      }],
    });
    assert.equal(claims[0]?.confidence, "UNKNOWN");
  }
});

test("proven without a valid source line anchor cannot become CONFIRMED", () => {
  const claims = normalizeCartographerEvidence({
    id: "entity:no-anchor",
    description: "No valid line anchor",
    evidence: [{
      id: "ev:no-anchor",
      confidence: "proven",
      anchors: [{ filePath: "src/a.ts" }],
    }],
  });
  assert.equal(claims[0]?.confidence, "UNKNOWN");
  assert.deepEqual(claims[0]?.evidence, []);
});

test("provider evidence without an id receives a deterministic local index id", () => {
  const claims = normalizeCartographerEvidence({
    id: "entity:indexed",
    description: "Indexed evidence",
    evidence: [{ confidence: "proven", anchors: [{ filePath: "src/a.ts", lineStart: 4 }] }],
  });
  assert.equal(claims[0]?.id, "entity:indexed#evidence-0");
});
