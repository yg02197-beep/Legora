import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import {
  copyExternalFixture,
  createR4Workspace,
  installPackedLegora,
} from "../r4/helpers.ts";

async function snapshotTree(root: string): Promise<Record<string, string>> {
  const output: Record<string, string> = {};
  async function walk(current: string): Promise<void> {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const relative = path.relative(root, full).split(path.sep).join("/");
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) output[relative] = (await fs.readFile(full)).toString("base64");
      else output[relative] = `SPECIAL:${entry.name}`;
    }
  }
  await walk(root);
  return Object.fromEntries(Object.entries(output).sort(([a], [b]) => a.localeCompare(b)));
}

function runInstalledNodeCli(input: {
  bin: string;
  cwd: string;
  args: readonly string[];
  fakeHome: string;
  emptyBin: string;
}): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [input.bin, ...input.args], {
      cwd: input.cwd,
      env: {
        ...process.env,
        HOME: input.fakeHome,
        USERPROFILE: input.fakeHome,
        PATH: input.emptyBin,
        Path: input.emptyBin,
      },
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ exitCode: code ?? 1, stdout, stderr }));
  });
}

test("packed bootstrap and doctor mutate only fake user scope, never the target repository", async () => {
  const workspace = await createR4Workspace();
  const fakeHome = path.join(workspace.root, "fake-home");
  const emptyBin = path.join(workspace.root, "empty-bin");
  try {
    await copyExternalFixture(workspace.targetRepository);
    await fs.mkdir(fakeHome, { recursive: true });
    await fs.mkdir(emptyBin, { recursive: true });
    const installed = await installPackedLegora(workspace);
    const bin = path.join(installed.packageRoot, "dist", "cli", "bin.mjs");
    const beforeRepository = await snapshotTree(workspace.targetRepository);

    const bootstrap = await runInstalledNodeCli({
      bin,
      cwd: workspace.targetRepository,
      args: ["bootstrap", "--agent", "all", "--json"],
      fakeHome,
      emptyBin,
    });
    assert.equal(bootstrap.exitCode, 0, bootstrap.stderr || bootstrap.stdout);
    const bootstrapData = JSON.parse(bootstrap.stdout) as { status: string; physicalWrites: number };
    assert.equal(bootstrapData.status, "BOOTSTRAP_READY");
    assert.equal(bootstrapData.physicalWrites, 2);
    assert.equal(await fs.stat(path.join(fakeHome, ".agents", "skills", "legora", "SKILL.md")).then(() => true), true);
    assert.equal(await fs.stat(path.join(fakeHome, ".claude", "skills", "legora", "SKILL.md")).then(() => true), true);
    assert.deepEqual(await snapshotTree(workspace.targetRepository), beforeRepository);

    const beforeDoctorHome = await snapshotTree(fakeHome);
    const doctor = await runInstalledNodeCli({
      bin,
      cwd: workspace.targetRepository,
      args: ["doctor", "--agent", "claude", "--json"],
      fakeHome,
      emptyBin,
    });
    assert.equal(doctor.exitCode, 7, doctor.stderr || doctor.stdout);
    const doctorData = JSON.parse(doctor.stdout) as { status: string };
    assert.equal(doctorData.status, "NOT_READY");
    assert.deepEqual(await snapshotTree(fakeHome), beforeDoctorHome);
    assert.deepEqual(await snapshotTree(workspace.targetRepository), beforeRepository);

    const beforeDryRunHome = await snapshotTree(fakeHome);
    const dryRun = await runInstalledNodeCli({
      bin,
      cwd: workspace.targetRepository,
      args: ["bootstrap", "--agent", "all", "--dry-run", "--json"],
      fakeHome,
      emptyBin,
    });
    assert.equal(dryRun.exitCode, 0, dryRun.stderr || dryRun.stdout);
    assert.deepEqual(await snapshotTree(fakeHome), beforeDryRunHome);
    assert.deepEqual(await snapshotTree(workspace.targetRepository), beforeRepository);
  } finally {
    await fs.rm(workspace.root, { recursive: true, force: true });
  }
});
