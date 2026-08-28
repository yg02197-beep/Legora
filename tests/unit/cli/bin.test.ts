import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { writeKnowledgeRecord } from "../../../src/repository-knowledge/store.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("package exposes the Legora CLI bin without a provider-specific executable", async () => {
  const pkg = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));

  assert.equal(pkg.bin?.legora, "./dist/cli/bin.mjs");
});

test("CLI process writes one JSON result and propagates usage exit code", () => {
  const binPath = path.join(projectRoot, "src", "cli", "bin.mjs");
  const child = spawnSync(
    process.execPath,
    [binPath, "unknown"],
    { cwd: projectRoot, encoding: "utf8" },
  );

  assert.equal(child.status, 2);
  assert.equal(child.stderr, "");
  const output = JSON.parse(child.stdout);
  assert.equal(output.status, "USAGE_ERROR");
  assert.match(output.usage, /legora knowledge status/);
});

test("CLI process uses cwd as repository root for a successful entry command", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-process-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "route.ts"), "route();\n", "utf8");
  const now = "2026-08-22T00:00:00.000Z";
  await writeKnowledgeRecord(repositoryRoot, {
    id: "knowledge:entity:route",
    kind: "entity:capability",
    subject: "route request",
    structure: { type: "ENTITY", entityKind: "capability", name: "route request" },
    activeEvidence: [{ filePath: "src/route.ts", lineStart: 1, snippet: "route();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: now,
    updatedAt: now,
  });
  await writeKnowledgeRecord(repositoryRoot, {
    id: "knowledge:flow:routing",
    kind: "behavior-flow:flow",
    subject: "request routing",
    structure: {
      type: "BEHAVIOR_FLOW",
      flowKind: "flow",
      name: "Request routing",
      steps: [{ entityId: "knowledge:entity:route", label: "Route request" }],
    },
    activeEvidence: [{ filePath: "src/route.ts", lineStart: 1, snippet: "route();", confidence: "CONFIRMED" }],
    history: [],
    createdAt: now,
    updatedAt: now,
  });

  const binPath = path.join(projectRoot, "src", "cli", "bin.mjs");
  const child = spawnSync(
    process.execPath,
    [binPath, "entry", "--json", "request routing"],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  assert.equal(child.status, 0, child.stderr || child.stdout);
  assert.equal(child.stderr, "");
  const output = JSON.parse(child.stdout);
  assert.equal(output.status, "READY");
  assert.equal(output.flowRecordId, "knowledge:flow:routing");
  assert.equal(output.behaviorSlice.owner, "LEGORA");
});
