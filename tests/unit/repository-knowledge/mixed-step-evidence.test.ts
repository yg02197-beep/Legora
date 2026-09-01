import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSimpleAcquisitionProposal,
  type SimpleKnowledgeAcquisitionInput,
} from "../../../src/repository-knowledge/simple-acquisition.ts";

test("mixed explicit and legacy flow steps keep omitted steps on top-level flow evidence only", () => {
  const input: SimpleKnowledgeAcquisitionInput = {
    type: "flow",
    subject: "Mixed evidence flow",
    evidenceLocators: [{ filePath: "src/flow.ts", lineStart: 1 }],
    steps: [
      {
        entity: "Explicit step",
        label: "Run explicit step",
        evidenceLocators: [{ filePath: "src/flow.ts", lineStart: 2 }],
      },
      {
        entity: "Legacy step",
        label: "Run legacy step",
      },
    ],
  };

  const proposal = buildSimpleAcquisitionProposal(input, []);
  const flow = proposal.candidates.find((candidate) => candidate.id === "native:flow:mixed-evidence-flow");

  assert.equal(flow?.structure?.type, "BEHAVIOR_FLOW");
  if (flow?.structure?.type !== "BEHAVIOR_FLOW") return;
  assert.deepEqual(flow.structure.steps.map((step) => step.evidenceAnchorIndexes), [[1], [0]]);
});
