import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runCliCommand } from "../../../src/cli/index.ts";
import { loadCanonicalSkillSnapshot } from "../../../src/skills/canonical.ts";
import type { CanonicalSkillSnapshot } from "../../../src/skills/canonical.ts";
import { publishManagedCopy } from "../../../src/bootstrap/managed-copy.ts";
import type { HostEnvironment } from "../../../src/bootstrap/contracts.ts";

const SKILL_PREFIX = `---\nname: legora\ndescription: Understand repository behavior from current source evidence. Use for code-flow questions.\nmetadata:\n  legora-managed: "true"\n  legora-skill-schema: "1"\n---\n# Legora\n`;

async function makeCanonical(suffix: string): Promise<{ parent: string; root: string; snapshot: CanonicalSkillSnapshot }> {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-canonical-"));
  const root = path.join(parent, "legora");
  await fs.mkdir(path.join(root, "references"), { recursive: true });
  await fs.writeFile(path.join(root, "SKILL.md"), `${SKILL_PREFIX}${suffix}`);
  await fs.writeFile(path.join(root, "references", "explain.md"), "# Explain\n");
  await fs.writeFile(path.join(root, "references", "explore.md"), "# Explore\n");
  await fs.writeFile(path.join(root, "references", "verify.md"), "# Verify\n");
  return { parent, root, snapshot: await loadCanonicalSkillSnapshot(root) };
}

function host(homeDir: string, binDir = ""): HostEnvironment {
  return {
    homeDir,
    platform: "win32",
    env: { Path: binDir, PATHEXT: ".COM;.EXE;.BAT;.CMD" },
  };
}

async function makeBin(commands: readonly string[]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-r5-bin-"));
  for (const command of commands) await fs.writeFile(path.join(dir, `${command}.cmd`), "@echo off\r\n");
  return dir;
}

test("bootstrap defaults to human output and explicit missing agent may be pre-provisioned", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-bootstrap-"));
  try {
    const result = await runCliCommand(["bootstrap", "--agent", "claude"], process.cwd(), {
      host: host(home),
      packageVersion: "0.1.0",
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.data.status, "BOOTSTRAP_READY");
    assert.match(result.stdout ?? "", /Claude/i);
    assert.match(result.stdout ?? "", /NOT_FOUND|not found/i);
    assert.equal(await fs.stat(path.join(home, ".claude", "skills", "legora", "SKILL.md")).then(() => true), true);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("bootstrap and doctor accept OpenCode as a first-class agent", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-opencode-"));
  const bin = await makeBin(["opencode"]);
  try {
    const bootstrap = await runCliCommand(["bootstrap", "--agent", "opencode", "--json"], process.cwd(), {
      host: host(home, bin),
      packageVersion: "0.1.0",
    });
    assert.equal(bootstrap.exitCode, 0);
    assert.deepEqual(bootstrap.data.agents.map((entry: { agent: string }) => entry.agent), ["opencode"]);

    const doctor = await runCliCommand(["doctor", "--agent", "opencode", "--json"], process.cwd(), {
      host: host(home, bin),
    });
    assert.equal(doctor.exitCode, 0);
    assert.equal(doctor.data.status, "READY");
    assert.equal(doctor.data.agents[0].nativeDiscovery, "NOT_PROBED");
  } finally {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(bin, { recursive: true, force: true });
  }
});

test("bootstrap --json suppresses human stdout and dry-run writes nothing", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-bootstrap-json-"));
  try {
    const result = await runCliCommand(["bootstrap", "--agent", "all", "--dry-run", "--json"], process.cwd(), {
      host: host(home),
      packageVersion: "0.1.0",
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, undefined);
    assert.equal(result.data.dryRun, true);
    assert.deepEqual(await fs.readdir(home), []);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("bootstrap conflicts return exit 7", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-bootstrap-conflict-"));
  const target = path.join(home, ".agents", "skills", "legora");
  try {
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, "SKILL.md"), "unowned\n");
    const result = await runCliCommand(["bootstrap", "--agent", "codex", "--json"], process.cwd(), {
      host: host(home),
      packageVersion: "0.1.0",
    });
    assert.equal(result.exitCode, 7);
    assert.equal(result.data.status, "BOOTSTRAP_CONFLICT");
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("doctor defaults to human output and --json preserves structured output", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-doctor-"));
  const bin = await makeBin(["codex"]);
  try {
    const snapshot = await loadCanonicalSkillSnapshot();
    const receipt = await publishManagedCopy({
      target: path.join(home, ".agents", "skills", "legora"),
      snapshot,
      packageVersion: "0.1.0",
    });
    await receipt.finalize();

    const human = await runCliCommand(["doctor", "--agent", "codex"], process.cwd(), { host: host(home, bin) });
    assert.equal(human.exitCode, 0);
    assert.equal(human.data.status, "READY");
    assert.match(human.stdout ?? "", /Codex/i);
    assert.match(human.stdout ?? "", /NOT_PROBED/);

    const json = await runCliCommand(["doctor", "--agent", "codex", "--json"], process.cwd(), { host: host(home, bin) });
    assert.equal(json.exitCode, 0);
    assert.equal(json.stdout, undefined);
    assert.equal(json.data.status, "READY");
  } finally {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(bin, { recursive: true, force: true });
  }
});

test("doctor reports an outdated managed install with both versions and update guidance", async () => {
  const older = await makeCanonical("v1\n");
  const newer = await makeCanonical("v2\n");
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-doctor-outdated-"));
  const bin = await makeBin(["codex"]);
  try {
    const receipt = await publishManagedCopy({
      target: path.join(home, ".agents", "skills", "legora"),
      snapshot: older.snapshot,
      packageVersion: "0.1.0",
    });
    await receipt.finalize();

    const result = await runCliCommand(["doctor", "--agent", "codex"], process.cwd(), {
      host: host(home, bin),
      packageVersion: "0.2.0",
      canonicalSkillRoot: newer.root,
    });

    assert.equal(result.exitCode, 7);
    assert.equal(result.data.status, "NOT_READY");
    assert.equal(result.data.agents[0].managedDigest, "OUTDATED");
    assert.equal(result.data.agents[0].installedVersion, "0.1.0");
    assert.equal(result.data.agents[0].currentVersion, "0.2.0");
    assert.match(result.stdout ?? "", /OUTDATED/);
    assert.match(result.stdout ?? "", /0\.1\.0/);
    assert.match(result.stdout ?? "", /0\.2\.0/);
    assert.match(result.stdout ?? "", /legora bootstrap/);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(bin, { recursive: true, force: true });
    await fs.rm(older.parent, { recursive: true, force: true });
    await fs.rm(newer.parent, { recursive: true, force: true });
  }
});

test("doctor explicit missing agent returns exit 7", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-doctor-missing-"));
  try {
    const result = await runCliCommand(["doctor", "--agent", "claude", "--json"], process.cwd(), { host: host(home) });
    assert.equal(result.exitCode, 7);
    assert.equal(result.data.status, "NOT_READY");
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("bootstrap and doctor reject unsupported or conflicting option syntax", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-invalid-"));
  try {
    const cases = [
      ["bootstrap", "--agent", "cursor"],
      ["bootstrap", "--agent", "codex", "--agent", "claude"],
      ["bootstrap", "--json", "--json"],
      ["doctor", "--agent", "all"],
      ["doctor", "--dry-run"],
    ];
    for (const argv of cases) {
      const result = await runCliCommand(argv, process.cwd(), { host: host(home), packageVersion: "0.1.0" });
      assert.equal(result.exitCode, 2, argv.join(" "));
      assert.equal(result.data.status, "USAGE_ERROR");
    }
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("existing entry command remains structured JSON data with no stdout override", async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "legora-cli-entry-r5-"));
  try {
    const result = await runCliCommand(["entry", "--json", "request routing"], repo);
    assert.equal(result.exitCode, 3);
    assert.equal(result.data.status, "KNOWLEDGE_NOT_FOUND");
    assert.equal(result.stdout, undefined);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});
