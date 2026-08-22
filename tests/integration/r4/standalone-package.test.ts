import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import {
  createR4Workspace,
  exists,
  installPackedLegora,
  runInstalledLegora,
} from "./helpers.ts";

test("packed Legora runs from an external repository without target dependencies", async () => {
  const workspace = await createR4Workspace();
  try {
    const installed = await installPackedLegora(workspace);

    assert.equal(await exists(path.join(workspace.targetRepository, "node_modules")), false);
    assert.equal(await exists(path.join(workspace.targetRepository, "package-lock.json")), false);
    assert.equal(installed.executable.startsWith(workspace.toolHome), true);
    assert.equal(await exists(path.join(installed.packageRoot, "dist", "cli", "bin.mjs")), true);
    assert.equal(await exists(path.join(installed.packageRoot, "SKILL.md")), true);
    assert.equal(await exists(path.join(installed.packageRoot, "references", "explain.md")), true);
    assert.equal(await exists(path.join(installed.packageRoot, "src")), false);
    assert.equal(await exists(path.join(installed.packageRoot, "tests")), false);
    assert.equal(await exists(path.join(installed.packageRoot, "node_modules", "tsx")), false);
    assert.equal(await exists(path.join(installed.packageRoot, "node_modules", "typescript")), false);

    const result = await runInstalledLegora(
      installed,
      workspace.targetRepository,
      ["entry", "request routing"],
    );

    assert.equal(result.exitCode, 3, result.stderr || result.stdout);
    assert.equal((result.data as { status?: string } | undefined)?.status, "KNOWLEDGE_NOT_FOUND");
  } finally {
    await fs.rm(workspace.root, { recursive: true, force: true });
  }
});
