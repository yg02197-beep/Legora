import test from "node:test";
import assert from "node:assert/strict";

import type { LegoraEntryResult } from "../../../src/entry.ts";
import { renderEntryResult } from "../../../src/cli/render.ts";

function readyResult(): LegoraEntryResult {
  return {
    status: "READY",
    question: "How does the step run?",
    flowRecordId: "native:flow:step",
    behaviorSlice: {
      owner: "LEGORA",
      subject: "Step flow",
      participants: [],
      states: [],
      events: [],
      flows: [{
        id: "flows:native:flow:step>native:entity:step",
        text: "Run step",
        providerRefs: ["native:flow:step", "native:entity:step"],
        requiredEvidenceClaimIds: [
          "native:flow:step#active-evidence-0",
          "native:entity:step#active-evidence-0",
        ],
      }],
      constraints: [],
      effects: [],
      failures: [],
    },
    evidenceClaims: [
      {
        id: "native:flow:step#active-evidence-0",
        claim: "Step flow",
        confidence: "INFERRED",
        sourceConfidence: "repository-captured",
        evidence: [{ filePath: "src/flow.ts", lineStart: 1 }],
        providerObjectId: "native:flow:step",
        provenance: null,
      },
      {
        id: "native:entity:step#active-evidence-0",
        claim: "Step",
        confidence: "INFERRED",
        sourceConfidence: "repository-captured",
        evidence: [{ filePath: "src/flow.ts", lineStart: 1 }],
        providerObjectId: "native:entity:step",
        provenance: null,
      },
    ],
    diagnostics: { warnings: [], ignoredKinds: [], ignoredRelations: [] },
    freshness: [
      {
        recordId: "native:flow:step",
        result: { status: "CURRENT", checkedAnchors: 1, issues: [] },
      },
      {
        recordId: "native:entity:step",
        result: { status: "CURRENT", checkedAnchors: 1, issues: [] },
      },
    ],
    nextAction: null,
  };
}

test("READY fact rendering deduplicates identical evidence locations before +N", () => {
  const output = renderEntryResult(readyResult());

  assert.ok(output.includes("src/flow.ts:1"));
  assert.ok(!output.includes("src/flow.ts:1 +1"));
});

test("READY evidence summary distinguishes unique anchors from record-anchor checks", () => {
  const output = renderEntryResult(readyResult());

  assert.ok(output.includes("1 unique anchors checked (2 record-anchor checks), all CURRENT"));
});
