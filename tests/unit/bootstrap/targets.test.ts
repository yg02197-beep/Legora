import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  detectSupportedAgents,
  parseSupportedAgent,
  resolveBootstrapTargets,
} from "../../../src/bootstrap/targets.ts";
import type { HostEnvironment } from "../../../src/bootstrap/contracts.ts";

function host(homeDir: string, platform: NodeJS.Platform, env: NodeJS.ProcessEnv = {}): HostEnvironment {
  return { homeDir, platform, env };
}

test("Codex and Gemini share one portable physical target", () => {
  const homeDir = path.resolve("D:/users/tester");
  const targets = resolveBootstrapTargets(homeDir, ["codex", "gemini"]);

  assert.equal(targets.length, 1);
  assert.equal(targets[0].kind, "agents-shared");
  assert.equal(targets[0].path, path.join(homeDir, ".agents", "skills", "legora"));
  assert.deepEqual(targets[0].agents, ["codex", "gemini"]);
});

test("Claude uses its own user-scope physical target", () => {
  const homeDir = path.resolve("D:/users/tester");
  const targets = resolveBootstrapTargets(homeDir, ["claude"]);

  assert.deepEqual(targets, [{
    kind: "claude",
    path: path.join(homeDir, ".claude", "skills", "legora"),
    agents: ["claude"],
  }]);
});

test("all three agents resolve to exactly two deterministic physical targets", () => {
  const homeDir = path.resolve("D:/users/tester");
  const targets = resolveBootstrapTargets(homeDir, ["gemini", "claude", "codex", "gemini"]);

  assert.equal(targets.length, 2);
  assert.deepEqual(targets.map((target) => target.kind), ["agents-shared", "claude"]);
  assert.deepEqual(targets[0].agents, ["codex", "gemini"]);
  assert.deepEqual(targets[1].agents, ["claude"]);
});

test("target resolution rejects an empty home directory", () => {
  assert.throws(() => resolveBootstrapTargets("   ", ["codex"]), /home/i);
});

test("supported-agent parser accepts canonical names and all only", () => {
  assert.equal(parseSupportedAgent("codex"), "codex");
  assert.equal(parseSupportedAgent("CLAUDE"), "claude");
  assert.equal(parseSupportedAgent("Gemini"), "gemini");
  assert.equal(parseSupportedAgent("all"), "all");
  assert.equal(parseSupportedAgent("cursor"), null);
});

test("Windows PATH detection finds command shims without spawning agents", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "legora-path-win-"));
  try {
    await fs.writeFile(path.join(temp, "codex.cmd"), "@echo off\r\n");
    await fs.writeFile(path.join(temp, "claude.cmd"), "@echo off\r\n");
    const result = await detectSupportedAgents(host("C:\\Users\\tester", "win32", {
      Path: temp,
      PATHEXT: ".COM;.EXE;.BAT;.CMD",
    }));

    assert.equal(result.find((entry) => entry.agent === "codex")?.executable, path.join(temp, "codex.cmd"));
    assert.equal(result.find((entry) => entry.agent === "claude")?.executable, path.join(temp, "claude.cmd"));
    assert.equal(result.find((entry) => entry.agent === "gemini")?.executable, null);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test("POSIX PATH detection requires an executable regular file", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX execute-bit semantics are not observable on Windows");
    return;
  }

  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "legora-path-posix-"));
  try {
    const codex = path.join(temp, "codex");
    const gemini = path.join(temp, "gemini");
    await fs.writeFile(codex, "#!/bin/sh\n");
    await fs.writeFile(gemini, "#!/bin/sh\n");
    await fs.chmod(codex, 0o755);
    await fs.chmod(gemini, 0o644);

    const result = await detectSupportedAgents(host("/home/tester", "linux", { PATH: temp }));
    assert.equal(result.find((entry) => entry.agent === "codex")?.executable, codex);
    assert.equal(result.find((entry) => entry.agent === "gemini")?.executable, null);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
