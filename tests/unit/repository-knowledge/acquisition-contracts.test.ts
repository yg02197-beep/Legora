import assert from "node:assert/strict";
import test from "node:test";
import type { KnowledgeAcquisitionProposal } from "../../../src/repository-knowledge/acquisition-contracts.ts";

test("native acquisition proposal keeps evidence locators separate from captured evidence", () => {
  const proposal: KnowledgeAcquisitionProposal = {
    candidates: [{
      id: "candidate-1",
      kind: "ENTITY",
      subject: "Example",
      evidenceLocators: [{ filePath: "src/example.ts", lineStart: 1 }],
    }],
  };

  assert.equal(proposal.candidates[0]?.evidenceLocators[0]?.filePath, "src/example.ts");
  assert.equal("snippet" in proposal.candidates[0]!, false);
});
