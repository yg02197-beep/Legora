import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import { runCliCommand } from "../../../src/cli/index.ts";

const cwd = os.tmpdir();

test("no arguments returns HELP with exit code 0", async () => {
  const result = await runCliCommand([], cwd);

  assert.equal(result.exitCode, 0);
  assert.equal(result.data.status, "HELP");
  assert.equal(result.data.command, "help");
});

test("--help returns HELP with exit code 0", async () => {
  const result = await runCliCommand(["--help"], cwd);

  assert.equal(result.exitCode, 0);
  assert.equal(result.data.status, "HELP");
});

test("-h returns HELP with exit code 0", async () => {
  const result = await runCliCommand(["-h"], cwd);

  assert.equal(result.exitCode, 0);
  assert.equal(result.data.status, "HELP");
});

test("help returns HELP with exit code 0", async () => {
  const result = await runCliCommand(["help"], cwd);

  assert.equal(result.exitCode, 0);
  assert.equal(result.data.status, "HELP");
});

test("unknown command still returns USAGE_ERROR with exit code 2", async () => {
  const result = await runCliCommand(["frobnicate"], cwd);

  assert.equal(result.exitCode, 2);
  assert.equal(result.data.status, "USAGE_ERROR");
});

test("help stdout lists the primary commands", async () => {
  const result = await runCliCommand(["help"], cwd);

  assert.ok(result.stdout, "expected human-readable stdout");
  assert.match(result.stdout!, /legora entry/);
  assert.match(result.stdout!, /legora scan/);
  assert.match(result.stdout!, /legora verify/);
});
