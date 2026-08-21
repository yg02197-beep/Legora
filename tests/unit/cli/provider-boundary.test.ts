import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("public CLI source does not expose Cartographer, MCP, or provider-specific slice controls", async () => {
  const source = [
    await fs.readFile(path.join(projectRoot, "src", "cli", "index.ts"), "utf8"),
    await fs.readFile(path.join(projectRoot, "src", "cli", "bin.mjs"), "utf8"),
  ].join("\n");

  assert.doesNotMatch(source, /cartographer/i);
  assert.doesNotMatch(source, /\bmcp\b/i);
  assert.doesNotMatch(source, /sliceId/);
  assert.doesNotMatch(source, /refreshCartographer/);
});
