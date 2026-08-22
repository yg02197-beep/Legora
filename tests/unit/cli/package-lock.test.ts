import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("package lock root metadata matches package.json version and Legora bin", async () => {
  const pkg = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));
  const lock = JSON.parse(await fs.readFile(path.join(projectRoot, "package-lock.json"), "utf8"));

  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages?.[""]?.version, pkg.version);
  assert.equal(lock.packages?.[""]?.bin?.legora, pkg.bin?.legora?.replace(/^\.\//, ""));
});
