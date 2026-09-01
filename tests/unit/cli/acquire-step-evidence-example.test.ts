import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runCliCommand } from "../../../src/cli/index.ts";

test("knowledge acquire flow example assigns source evidence directly to each step", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-acquire-step-example-"));

  const result = await runCliCommand(
    ["knowledge", "acquire", "--example"],
    repositoryRoot,
  );

  assert.equal(result.exitCode, 0);
  const flow = (result.data.examples as Array<{
    type: string;
    steps?: Array<{ evidenceLocators?: unknown[] }>;
  }>).find((example) => example.type === "flow");

  assert.ok(flow);
  assert.ok(flow.steps?.length);
  assert.ok(flow.steps?.every((step) => Array.isArray(step.evidenceLocators) && step.evidenceLocators.length > 0));
});
