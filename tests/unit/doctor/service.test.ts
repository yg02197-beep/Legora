import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { doctorLegora } from "../../../src/doctor/service.ts";
import { loadCanonicalSkillSnapshot } from "../../../src/skills/canonical.ts";
import { publishManagedCopy } from "../../../src/bootstrap/managed-copy.ts";
import type { HostEnvironment } from "../../../src/bootstrap/contracts.ts";
import type { LocalCommandRunner } from "../../../src/doctor/contracts.ts";

async function makeBin(commands: readonly string[]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "legora-doctor-bin-"));
  for (const command of commands) await fs.writeFile(path.join(dir, `${command}.cmd`), "@echo off\r\n");
  return dir;
}

function windowsHost(homeDir: string, binDir = ""): HostEnvironment {
  return {
    homeDir,
    platform: "win32",
    env: { Path: binDir, PATHEXT: ".COM;.EXE;.BAT;.CMD" },
  };
}

async function installCurrent(home: string, agents: readonly ("codex" | "claude" | "gemini" | "opencode")[]): Promise<void> {
  const snapshot = await loadCanonicalSkillSnapshot();
  const targets = new Set<string>();
  if (agents.includes("codex") || agents.includes("gemini") || agents.includes("opencode")) {
    targets.add(path.join(home, ".agents", "skills", "legora"));
  }
  if (agents.includes("claude")) targets.add(path.join(home, ".claude", "skills", "legora"));
  for (const target of targets) {
    const receipt = await publishManagedCopy({ target, snapshot, packageVersion: "0.1.0" });
    await receipt.finalize();
  }
}

async function treeBytes(root: string): Promise<Record<string, string>> {
  const output: Record<string, string> = {};
  async function walk(current: string): Promise<void> {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const relative = path.relative(root, full).split(path.sep).join("/");
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) output[relative] = (await fs.readFile(full)).toString("base64");
    }
  }
  await walk(root);
  return Object.fromEntries(Object.entries(output).sort(([a], [b]) => a.localeCompare(b)));
}

async function geminiFixture(location: string): Promise<string> {
  const template = await fs.readFile(path.join(process.cwd(), "tests", "fixtures", "r5", "gemini-skills-list.txt"), "utf8");
  return template
    .replace("__LEGORA_LOCATION__", location)
    .replace("__OTHER_LOCATION__", path.join(path.dirname(location), "other", "SKILL.md"));
}

function runner(result: { stdout: string; stderr?: string; exitCode?: number; timedOut?: boolean }, assertions?: (command: string, args: readonly string[], timeoutMs: number) => void): LocalCommandRunner {
  return async (command, args, timeoutMs) => {
    assertions?.(command, args, timeoutMs);
    return {
      exitCode: result.exitCode ?? 0,
      stdout: result.stdout,
      stderr: result.stderr ?? "",
      timedOut: result.timedOut ?? false,
    };
  };
}

test("all-agent Doctor ignores missing agents when one detected agent is healthy", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-doctor-all-"));
  const bin = await makeBin(["codex"]);
  try {
    await installCurrent(home, ["codex"]);
    const result = await doctorLegora({ requested: "all", host: windowsHost(home, bin) });
    assert.equal(result.status, "READY");
    assert.equal(result.canonicalSkillFormat, "PASS");
    assert.deepEqual(result.agents.map((entry) => [entry.agent, entry.executable, entry.nativeDiscovery]), [
      ["codex", "PASS", "NOT_PROBED"],
      ["gemini", "NOT_FOUND", "NOT_FOUND"],
      ["opencode", "NOT_FOUND", "NOT_FOUND"],
      ["claude", "NOT_FOUND", "NOT_FOUND"],
    ]);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(bin, { recursive: true, force: true });
  }
});

test("explicit missing agent is NOT_READY even when its Skill is pre-provisioned", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-doctor-missing-"));
  try {
    await installCurrent(home, ["claude"]);
    const result = await doctorLegora({ requested: ["claude"], host: windowsHost(home) });
    assert.equal(result.status, "NOT_READY");
    assert.deepEqual(result.agents[0], {
      agent: "claude",
      executable: "NOT_FOUND",
      installTarget: "PASS",
      managedDigest: "PASS",
      nativeDiscovery: "NOT_FOUND",
    });
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("Codex, OpenCode, and Claude current managed installs remain NOT_PROBED for native discovery", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-doctor-not-probed-"));
  const bin = await makeBin(["codex", "opencode", "claude"]);
  try {
    await installCurrent(home, ["codex", "opencode", "claude"]);
    const result = await doctorLegora({ requested: ["codex", "opencode", "claude"], host: windowsHost(home, bin) });
    assert.equal(result.status, "READY");
    for (const agent of result.agents) {
      assert.equal(agent.installTarget, "PASS");
      assert.equal(agent.managedDigest, "PASS");
      assert.equal(agent.nativeDiscovery, "NOT_PROBED");
    }
  } finally {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(bin, { recursive: true, force: true });
  }
});

test("Gemini discovery is CONFIRMED only for enabled Legora at the managed location", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-doctor-gemini-"));
  const bin = await makeBin(["gemini"]);
  const target = path.join(home, ".agents", "skills", "legora");
  try {
    await installCurrent(home, ["gemini"]);
    const location = path.join(target, "SKILL.md");
    const stdout = await geminiFixture(location);
    let probeCalls = 0;
    const result = await doctorLegora({
      requested: ["gemini"],
      host: windowsHost(home, bin),
      runLocalCommand: runner({ stdout, stderr: "Loaded cached credentials.\nAuthentication warning\n" }, (_command, args, timeoutMs) => {
        probeCalls += 1;
        assert.deepEqual(args, ["skills", "list", "--all"]);
        assert.equal(timeoutMs, 10_000);
      }),
    });
    assert.equal(probeCalls, 1);
    assert.equal(result.status, "READY");
    assert.equal(result.agents[0].nativeDiscovery, "CONFIRMED");
  } finally {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(bin, { recursive: true, force: true });
  }
});

test("Gemini disabled, wrong-location, absent, and malformed listings are not confirmation", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-doctor-gemini-negative-"));
  const bin = await makeBin(["gemini"]);
  const target = path.join(home, ".agents", "skills", "legora");
  try {
    await installCurrent(home, ["gemini"]);
    const correct = await geminiFixture(path.join(target, "SKILL.md"));
    const variants = [
      correct.replace("legora [Enabled]", "legora [Disabled]"),
      correct.replace(path.join(target, "SKILL.md"), path.join(home, ".gemini", "skills", "legora", "SKILL.md")),
      "Discovered Agent Skills:\n\nother [Enabled]\n  Location: C:\\tmp\\other\\SKILL.md\n",
      "not a skill listing\n",
    ];
    for (const stdout of variants) {
      const result = await doctorLegora({
        requested: ["gemini"],
        host: windowsHost(home, bin),
        runLocalCommand: runner({ stdout }),
      });
      assert.equal(result.status, "NOT_READY");
      assert.equal(result.agents[0].nativeDiscovery, "FAIL");
    }
  } finally {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(bin, { recursive: true, force: true });
  }
});

test("Gemini native discovery timeout is reported separately", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-doctor-timeout-"));
  const bin = await makeBin(["gemini"]);
  try {
    await installCurrent(home, ["gemini"]);
    const result = await doctorLegora({
      requested: ["gemini"],
      host: windowsHost(home, bin),
      runLocalCommand: runner({ stdout: "", timedOut: true }),
    });
    assert.equal(result.status, "NOT_READY");
    assert.equal(result.agents[0].nativeDiscovery, "TIMEOUT");
  } finally {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(bin, { recursive: true, force: true });
  }
});

test("conflict target is NOT_READY and Gemini probe is not executed", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-doctor-conflict-"));
  const bin = await makeBin(["gemini"]);
  const target = path.join(home, ".agents", "skills", "legora");
  try {
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, "SKILL.md"), "unowned\n");
    let calls = 0;
    const result = await doctorLegora({
      requested: ["gemini"],
      host: windowsHost(home, bin),
      runLocalCommand: runner({ stdout: "" }, () => { calls += 1; }),
    });
    assert.equal(result.status, "NOT_READY");
    assert.equal(result.agents[0].installTarget, "FAIL");
    assert.equal(result.agents[0].managedDigest, "FAIL");
    assert.equal(result.agents[0].nativeDiscovery, "NOT_PROBED");
    assert.equal(calls, 0);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(bin, { recursive: true, force: true });
  }
});

test("Doctor is strictly read-only over fake home", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-doctor-readonly-"));
  const bin = await makeBin(["codex", "claude", "gemini", "opencode"]);
  const target = path.join(home, ".agents", "skills", "legora");
  try {
    await installCurrent(home, ["codex", "claude", "gemini", "opencode"]);
    const before = await treeBytes(home);
    const result = await doctorLegora({
      requested: "all",
      host: windowsHost(home, bin),
      runLocalCommand: runner({ stdout: await geminiFixture(path.join(target, "SKILL.md")) }),
    });
    assert.equal(result.status, "READY");
    assert.deepEqual(await treeBytes(home), before);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(bin, { recursive: true, force: true });
  }
});
