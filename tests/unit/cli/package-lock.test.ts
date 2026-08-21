import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("package lock root metadata exposes the same Legora bin as package.json", async () => {
  const lock = JSON.parse(await fs.readFile(path.join(projectRoot, "package-lock.json"), "utf8"));

  assert.equal(lock.packages?.[""]?.bin?.legora, "src/cli/bin.mjs");
});
