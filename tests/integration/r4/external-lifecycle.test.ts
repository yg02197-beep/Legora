import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  copyExternalFixture,
  createR4Workspace,
  installPackedLegora,
  runInstalledLegora,
} from "./helpers.ts";

const routingProposal = {
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

test("installed CLI closes the external acquire-refresh lifecycle and preserves history", async () => {
  const workspace = await createR4Workspace();
  try {
    await copyExternalFixture(workspace.targetRepository);
    const installed = await installPackedLegora(workspace);

    const missing = await runInstalledLegora(installed, workspace.targetRepository, ["entry", "--json", "request routing"]);
    assert.equal(missing.exitCode, 3, missing.stderr || missing.stdout);
    assert.equal((missing.data as any).status, "KNOWLEDGE_NOT_FOUND");
    assert.equal((missing.data as any).nextAction?.type, "ACQUIRE_KNOWLEDGE");

    const acquire = await runInstalledLegora(
      installed,
      workspace.targetRepository,
      ["knowledge", "acquire"],
      JSON.stringify(routingProposal),
    );
    assert.equal(acquire.exitCode, 0, acquire.stderr || acquire.stdout);
    assert.equal((acquire.data as any).status, "ACQUIRED");

    const ready = await runInstalledLegora(installed, workspace.targetRepository, ["entry", "--json", "request routing"]);
    assert.equal(ready.exitCode, 0, ready.stderr || ready.stdout);
    assert.equal((ready.data as any).status, "READY");
    assert.equal((ready.data as any).behaviorSlice?.owner, "LEGORA");
    assert.equal((ready.data as any).nextAction, null);

    await fs.writeFile(
      path.join(workspace.targetRepository, "src", "router.ts"),
      'export function routeRequest(path: string): "auth" | "billing" {\n  return path === "/login" ? "auth" : "billing";\n}\n',
      "utf8",
    );

    const stale = await runInstalledLegora(installed, workspace.targetRepository, ["entry", "--json", "request routing"]);
    assert.equal(stale.exitCode, 4, stale.stderr || stale.stdout);
    assert.equal((stale.data as any).status, "KNOWLEDGE_STALE");
    assert.equal((stale.data as any).nextAction?.type, "REFRESH_KNOWLEDGE");
    assert.deepEqual(
      [...(stale.data as any).nextAction.recordIds].sort(),
      ["native:entity:router", "native:flow:routing"].sort(),
    );

    const refresh = await runInstalledLegora(
      installed,
      workspace.targetRepository,
      ["knowledge", "acquire"],
      JSON.stringify(routingProposal),
    );
    assert.equal(refresh.exitCode, 0, refresh.stderr || refresh.stdout);

    const records = JSON.parse(
      await fs.readFile(path.join(workspace.targetRepository, ".legora", "repository-knowledge.json"), "utf8"),
    ) as any[];
    assert.equal(records.length, 2);
    for (const record of records) {
      assert.equal(record.history.length, 1);
      assert.notEqual(record.history[0][0].snippet, record.activeEvidence[0].snippet);
      assert.equal(record.activeEvidence[0].snippet.includes('path === "/login"'), true);
    }

    const readyAgain = await runInstalledLegora(installed, workspace.targetRepository, ["entry", "--json", "request routing"]);
    assert.equal(readyAgain.exitCode, 0, readyAgain.stderr || readyAgain.stdout);
    assert.equal((readyAgain.data as any).status, "READY");
    assert.equal((readyAgain.data as any).nextAction, null);
  } finally {
    await fs.rm(workspace.root, { recursive: true, force: true });
  }
});
