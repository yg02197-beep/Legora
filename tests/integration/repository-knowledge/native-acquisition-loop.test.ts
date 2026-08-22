import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runLegoraEntry } from "../../../src/entry.ts";
import type { KnowledgeAcquisitionProposal } from "../../../src/repository-knowledge/acquisition-contracts.ts";
import { acquireRepositoryKnowledge } from "../../../src/repository-knowledge/acquisition-service.ts";
import { readKnowledgeRecords } from "../../../src/repository-knowledge/store.ts";

function routingProposal(): KnowledgeAcquisitionProposal {
  return {
    candidates: [
      {
        id: "native:entity:router",
        kind: "entity:service",
        subject: "request router",
        structure: { type: "ENTITY", entityKind: "service", name: "router" },
        evidenceLocators: [{ filePath: "src/router.ts", lineStart: 1 }],
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
        evidenceLocators: [{ filePath: "src/router.ts", lineStart: 1 }],
      },
    ],
  };
}

test("native acquisition closes the Entry acquire-refresh loop without a provider model", async () => {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "legora-native-loop-"));
  await fs.mkdir(path.join(repositoryRoot, "src"));
  await fs.writeFile(path.join(repositoryRoot, "src", "router.ts"), "route();\n", "utf8");

  const missing = await runLegoraEntry({ repositoryRoot, question: "request routing" });
  assert.equal(missing.status, "KNOWLEDGE_NOT_FOUND");
  assert.equal(missing.nextAction?.type, "ACQUIRE_KNOWLEDGE");

  const acquired = await acquireRepositoryKnowledge({ repositoryRoot, proposal: routingProposal() });
  assert.equal(acquired.status, "ACQUIRED");

  const ready = await runLegoraEntry({ repositoryRoot, question: "request routing" });
  assert.equal(ready.status, "READY");
  assert.equal(ready.behaviorSlice?.owner, "LEGORA");
  assert.equal(ready.nextAction, null);
  assert.ok(ready.evidenceClaims.length > 0);
  assert.ok(ready.evidenceClaims.every((claim) => claim.confidence === "INFERRED"));

  await fs.writeFile(path.join(repositoryRoot, "src", "router.ts"), "routeChanged();\n", "utf8");
  const stale = await runLegoraEntry({ repositoryRoot, question: "request routing" });
  assert.equal(stale.status, "KNOWLEDGE_STALE");
  assert.equal(stale.nextAction?.type, "REFRESH_KNOWLEDGE");
  assert.deepEqual(
    stale.nextAction?.type === "REFRESH_KNOWLEDGE" ? stale.nextAction.recordIds : [],
    ["native:entity:router", "native:flow:routing"],
  );

  const refreshed = await acquireRepositoryKnowledge({ repositoryRoot, proposal: routingProposal() });
  assert.equal(refreshed.status, "ACQUIRED");
  const records = await readKnowledgeRecords(repositoryRoot);
  assert.ok(records.every((record) => record.history.length === 1));
  assert.ok(records.every((record) => record.activeEvidence[0]?.snippet === "routeChanged();"));

  const readyAgain = await runLegoraEntry({ repositoryRoot, question: "request routing" });
  assert.equal(readyAgain.status, "READY");
  assert.equal(readyAgain.nextAction, null);
});
