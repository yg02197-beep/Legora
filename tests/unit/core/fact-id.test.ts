import test from "node:test";
import assert from "node:assert/strict";
import { createBehaviorFactId } from "../../../src/core/fact-id.ts";

test("same category and provider refs produce the same stable fact id", () => {
  const first = createBehaviorFactId("flows", ["slice:main", "capability:refresh"]);
  const second = createBehaviorFactId("flows", ["slice:main", "capability:refresh"]);
  assert.equal(first, second);
  assert.match(first, /^fact:flows:[a-f0-9]{64}$/);
});

test("different categories cannot collide for the same provider refs", () => {
  const refs = ["entity:request"];
  assert.notEqual(
    createBehaviorFactId("participants", refs),
    createBehaviorFactId("events", refs),
  );
});

test("provider refs participate in identity", () => {
  assert.notEqual(
    createBehaviorFactId("flows", ["slice:a", "entity:x"]),
    createBehaviorFactId("flows", ["slice:b", "entity:x"]),
  );
});
