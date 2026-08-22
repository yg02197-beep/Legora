import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  copyExternalFixture,
  createR4Workspace,
  exists,
  installPackedLegora,
  inventoryRepository,
  runInstalledLegora,
} from "./helpers.ts";

const validProposal = {
  candidates: [
    {
      id: "native:entity:router",
      kind: "entity:service",
      subject: "request router",
      structure: { type: "ENTITY", entityKind: "service", name: "router" },
      evidenceLocators: [{ filePath: "src/router.ts", lineStart: 1, lineEnd: 3 }],
    },
    {
      id: "native:flow:routing",
      kind: "behavior-flow:routing",
      subject: "request routing",
      structure: {
        type: "BEHAVIOR_FLOW",
        flowKind: "routing",
        name: "Request routing",
        steps: [{ entityId: "native:entity:router", label: "Route request" }],
      },
      evidenceLocators: [{ filePath: "src/router.ts", lineStart: 1, lineEnd: 3 }],
    },
  ],
};

function oneEntityProposal(id: string, filePath: string, lineStart: number, lineEnd?: number) {
  return {
    candidates: [{
      id,
      kind: "entity:test",
      subject: id,
      structure: { type: "ENTITY", entityKind: "test", name: id },
      evidenceLocators: [{ filePath, lineStart, ...(lineEnd === undefined ? {} : { lineEnd }) }],
    }],
  };
}

async function acquire(installed: any, repo: string, proposal: unknown) {
  return runInstalledLegora(installed, repo, ["knowledge", "acquire"], JSON.stringify(proposal));
}

test("external operation changes only Repository Knowledge and publishes only question-bounded records", async () => {
  const workspace = await createR4Workspace();
  try {
    await copyExternalFixture(workspace.targetRepository);
    const installed = await installPackedLegora(workspace);
    const beforeInventory = await inventoryRepository(workspace.targetRepository);
    const beforeFiles = new Map<string, Buffer>();
    for (const relative of beforeInventory) {
      beforeFiles.set(relative, await fs.readFile(path.join(workspace.targetRepository, relative)));
    }

    const result = await acquire(installed, workspace.targetRepository, validProposal);
    assert.equal(result.exitCode, 0, result.stderr || result.stdout);

    const afterInventory = await inventoryRepository(workspace.targetRepository);
    const additions = afterInventory.filter((entry) => !beforeInventory.includes(entry));
    assert.deepEqual(additions, [".legora/repository-knowledge.json"]);
    assert.equal(await exists(path.join(workspace.targetRepository, ".legora", ".repository-knowledge.lock")), false);

    for (const [relative, bytes] of beforeFiles) {
      assert.deepEqual(await fs.readFile(path.join(workspace.targetRepository, relative)), bytes, relative);
    }

    const records = JSON.parse(
      await fs.readFile(path.join(workspace.targetRepository, ".legora", "repository-knowledge.json"), "utf8"),
    ) as any[];
    assert.deepEqual(
      records.map((record) => record.id).sort(),
      ["native:entity:router", "native:flow:routing"].sort(),
    );
    assert.equal(records.some((record) => JSON.stringify(record).includes("documentationPhrase")), false);
    assert.equal(records.some((record) => record.id.includes("billing")), false);
  } finally {
    await fs.rm(workspace.root, { recursive: true, force: true });
  }
});

test("installed public CLI rejects adversarial acquisitions without changing the store", async (t) => {
  const workspace = await createR4Workspace();
  try {
    await copyExternalFixture(workspace.targetRepository);
    const installed = await installPackedLegora(workspace);
    const baseline = await acquire(installed, workspace.targetRepository, validProposal);
    assert.equal(baseline.exitCode, 0, baseline.stderr || baseline.stdout);

    const storePath = path.join(workspace.targetRepository, ".legora", "repository-knowledge.json");
    const original = await fs.readFile(storePath, "utf8");

    async function expectRejected(proposal: unknown): Promise<void> {
      const result = await acquire(installed, workspace.targetRepository, proposal);
      assert.equal(result.exitCode, 6, result.stderr || result.stdout);
      assert.equal(await fs.readFile(storePath, "utf8"), original);
      assert.equal(await exists(path.join(workspace.targetRepository, ".legora", ".repository-knowledge.lock")), false);
    }

    const malformed = await runInstalledLegora(installed, workspace.targetRepository, ["knowledge", "acquire"], "{");
    assert.equal(malformed.exitCode, 2, malformed.stderr || malformed.stdout);
    assert.equal(await fs.readFile(storePath, "utf8"), original);

    await expectRejected({ candidates: [] });
    await expectRejected(oneEntityProposal("bad:absolute", path.join(workspace.targetRepository, "src", "router.ts"), 1));

    await fs.writeFile(path.join(workspace.root, "outside.ts"), "outside();\n", "utf8");
    await expectRejected(oneEntityProposal("bad:parent", "../outside.ts", 1));
    await expectRejected(oneEntityProposal("bad:zero", "src/router.ts", 0));
    await expectRejected(oneEntityProposal("bad:fractional", "src/router.ts", 1.5));
    await expectRejected(oneEntityProposal("bad:reverse", "src/router.ts", 3, 2));

    await expectRejected({
      candidates: [{
        id: "bad:relationship",
        kind: "relationship:test",
        subject: "missing relationship",
        structure: { type: "RELATIONSHIP", relationshipKind: "calls", sourceId: "missing:a", targetId: "missing:b" },
        evidenceLocators: [{ filePath: "src/router.ts", lineStart: 1 }],
      }],
    });

    await expectRejected({
      candidates: [{
        id: "bad:flow",
        kind: "behavior-flow:test",
        subject: "missing flow",
        structure: { type: "BEHAVIOR_FLOW", flowKind: "test", name: "Missing flow", steps: [{ entityId: "missing:entity" }] },
        evidenceLocators: [{ filePath: "src/router.ts", lineStart: 1 }],
      }],
    });

    await expectRejected({
      candidates: [{
        id: "native:entity:router",
        kind: "behavior-flow:invalid-replacement",
        subject: "request router",
        structure: { type: "BEHAVIOR_FLOW", flowKind: "replacement", name: "Invalid replacement", steps: [] },
        evidenceLocators: [{ filePath: "src/router.ts", lineStart: 1 }],
      }],
    });

    const outsideDir = path.join(workspace.root, "outside-dir");
    const linkPath = path.join(workspace.targetRepository, "escape-link");
    await fs.mkdir(outsideDir, { recursive: true });
    await fs.writeFile(path.join(outsideDir, "secret.ts"), "secret();\n", "utf8");
    let linkCreated = false;
    try {
      await fs.symlink(outsideDir, linkPath, process.platform === "win32" ? "junction" : "dir");
      linkCreated = true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? "UNKNOWN";
      t.diagnostic(`junction/symlink case skipped because creation failed: ${code}`);
    }
    if (linkCreated) {
      await expectRejected(oneEntityProposal("bad:link", "escape-link/secret.ts", 1));
    }
  } finally {
    await fs.rm(workspace.root, { recursive: true, force: true });
  }
});
