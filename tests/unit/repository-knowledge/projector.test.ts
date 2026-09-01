import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeCartographerModel } from "../../../src/providers/cartographer/decoder.ts";
import { importCartographerModelView } from "../../../src/repository-knowledge/cartographer-import.ts";
import type { KnowledgeRecord } from "../../../src/repository-knowledge/contracts.ts";
import {
  projectKnowledgeBehaviorSlice,
  RepositoryKnowledgeProjectionError,
} from "../../../src/repository-knowledge/projector.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, "../../fixtures/cartographer/model-v0.8.0.json");

async function importedRecords() {
  const document = JSON.parse(await fs.readFile(fixturePath, "utf8"));
  const model = decodeCartographerModel(document, "D:/Projects/Fixture");
  return importCartographerModelView(model, "2026-08-22T00:00:00.000Z").records;
}

test("repository knowledge flow projects to the same Legora-owned behavior categories", async () => {
  const records = await importedRecords();
  const result = projectKnowledgeBehaviorSlice(records, "cartographer:flow:slice:main");

  assert.equal(result.behaviorSlice.owner, "LEGORA");
  assert.equal(result.behaviorSlice.subject, "Main flow");
  assert.deepEqual(result.behaviorSlice.participants.map((fact) => fact.text), ["request"]);
  assert.deepEqual(result.behaviorSlice.states.map((fact) => fact.text), ["expired"]);
  assert.deepEqual(result.behaviorSlice.events.map((fact) => fact.text), ["request arrives"]);
  assert.deepEqual(result.behaviorSlice.flows.map((fact) => fact.text), [
    "Expired request arrives",
    "Token is expired",
    "Request arrival is observed",
    "Refresh token",
  ]);
  assert.deepEqual(result.behaviorSlice.constraints.map((fact) => fact.text), [
    "Executable behavior requires confirmed evidence",
  ]);
  assert.deepEqual(result.behaviorSlice.effects.map((fact) => fact.text), [
    "Understanding asset files are written",
  ]);
  assert.deepEqual(result.behaviorSlice.failures.map((fact) => fact.text), [
    "Unsupported input is refused",
  ]);
});

test("repository knowledge projection preserves evidence confidence and resolves every fact claim", async () => {
  const records = await importedRecords();
  const result = projectKnowledgeBehaviorSlice(records, "cartographer:flow:slice:main");
  const evidenceIds = new Set(result.evidenceClaims.map((claim) => claim.id));
  const allFacts = [
    ...result.behaviorSlice.participants,
    ...result.behaviorSlice.states,
    ...result.behaviorSlice.events,
    ...result.behaviorSlice.flows,
    ...result.behaviorSlice.constraints,
    ...result.behaviorSlice.effects,
    ...result.behaviorSlice.failures,
  ];

  assert.ok(result.evidenceClaims.some((claim) => claim.confidence === "CONFIRMED"));
  assert.ok(result.evidenceClaims.some((claim) => claim.confidence === "INFERRED"));
  assert.ok(allFacts.every((fact) => fact.requiredEvidenceClaimIds.every((id) => evidenceIds.has(id))));
});

test("repository knowledge projection reads active evidence only and never history", async () => {
  const records = await importedRecords();
  const actor = records.find((record) => record.id === "cartographer:entity:actor:request");
  assert.ok(actor);
  actor.activeEvidence = [{
    filePath: "src/current.ts",
    lineStart: 1,
    snippet: "current",
    confidence: "INFERRED",
    sourceConfidence: "high",
    provenance: "active",
  }];
  actor.history = [[{
    filePath: "src/old.ts",
    lineStart: 1,
    snippet: "old",
    confidence: "CONFIRMED",
    sourceConfidence: "proven",
    provenance: "history",
  }]];

  const result = projectKnowledgeBehaviorSlice(records, "cartographer:flow:slice:main");
  const actorClaims = result.evidenceClaims.filter((claim) => claim.providerObjectId === actor.id);

  assert.deepEqual(actorClaims.map((claim) => claim.confidence), ["INFERRED"]);
  assert.deepEqual(actorClaims.flatMap((claim) => claim.evidence.map((anchor) => anchor.filePath)), ["src/current.ts"]);
});

test("projected fact identity depends on knowledge record refs, not human-facing labels", async () => {
  const records = await importedRecords();
  const flow = records.find((record) => record.id === "cartographer:flow:slice:main");
  assert.ok(flow?.structure?.type === "BEHAVIOR_FLOW");
  const before = projectKnowledgeBehaviorSlice(records, flow.id);
  const refreshBefore = before.behaviorSlice.flows.find((fact) => fact.text === "Refresh token");
  assert.ok(refreshBefore);

  const refreshStep = flow.structure.steps.find((step) => step.entityId === "cartographer:entity:capability:refresh");
  assert.ok(refreshStep);
  refreshStep.label = "Human wording changed only";
  const after = projectKnowledgeBehaviorSlice(records, flow.id);
  const refreshAfter = after.behaviorSlice.flows.find((fact) => fact.text === "Human wording changed only");

  assert.equal(refreshAfter?.id, refreshBefore.id);
});

test("missing repository knowledge flow fails closed", async () => {
  const records = await importedRecords();
  assert.throws(
    () => projectKnowledgeBehaviorSlice(records, "knowledge:missing"),
    (error: unknown) => error instanceof RepositoryKnowledgeProjectionError
      && error.code === "KNOWLEDGE_FLOW_NOT_FOUND",
  );
});

test("reverse relationship storage direction preserves the same explicit guards semantics", async () => {
  const records = await importedRecords();
  const relationship = records.find((record) =>
    record.id === "cartographer:relationship:invariant:confirmed-only>guards>capability:refresh"
  );
  assert.ok(relationship?.structure?.type === "RELATIONSHIP");
  const sourceId = relationship.structure.sourceId;
  relationship.structure.sourceId = relationship.structure.targetId;
  relationship.structure.targetId = sourceId;

  const result = projectKnowledgeBehaviorSlice(records, "cartographer:flow:slice:main");

  assert.deepEqual(result.behaviorSlice.constraints.map((fact) => fact.text), [
    "Executable behavior requires confirmed evidence",
  ]);
});

test("arbitrary entity prose is not promoted into a typed constraint", async () => {
  const records = await importedRecords();
  const capability = records.find((record) => record.id === "cartographer:entity:capability:refresh");
  assert.ok(capability?.structure?.type === "ENTITY");
  capability.structure.description = "Only one refresh can run at a time";
  capability.subject = "Only one refresh can run at a time";

  const result = projectKnowledgeBehaviorSlice(records, "cartographer:flow:slice:main");

  assert.ok(!result.behaviorSlice.constraints.some((fact) => /Only one refresh/i.test(fact.text)));
  assert.deepEqual(result.behaviorSlice.constraints.map((fact) => fact.text), [
    "Executable behavior requires confirmed evidence",
  ]);
});

test("two-hop and unrelated repository relationships remain ignored and diagnosed", async () => {
  const records = await importedRecords();
  const result = projectKnowledgeBehaviorSlice(records, "cartographer:flow:slice:main");

  assert.ok(result.diagnostics.ignoredRelations.includes("triggers"));
  assert.ok(result.diagnostics.ignoredRelations.includes("contains"));
});

test("explicit flow step evidence indexes ground only that step fact", () => {
  const now = "2026-09-01T00:00:00.000Z";
  const records: KnowledgeRecord[] = [
    {
      id: "native:flow:report-generation",
      kind: "behavior-flow:flow",
      subject: "Report generation",
      structure: {
        type: "BEHAVIOR_FLOW",
        flowKind: "flow",
        name: "Report generation",
        steps: [
          {
            entityId: "native:entity:apply-corrections",
            label: "Apply reviewed corrections",
            evidenceAnchorIndexes: [0],
          },
          {
            entityId: "native:entity:publish-report",
            label: "Publish report",
            evidenceAnchorIndexes: [1],
          },
        ],
      },
      activeEvidence: [
        {
          filePath: "src/report.ts",
          lineStart: 20,
          lineEnd: 30,
          snippet: "applyCorrections();",
          confidence: "INFERRED",
          sourceConfidence: "repository-captured",
        },
        {
          filePath: "src/publish.ts",
          lineStart: 40,
          lineEnd: 50,
          snippet: "publishReport();",
          confidence: "INFERRED",
          sourceConfidence: "repository-captured",
        },
      ],
      history: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "native:entity:apply-corrections",
      kind: "entity:participant",
      subject: "Apply corrections",
      structure: { type: "ENTITY", entityKind: "participant", name: "Apply corrections" },
      activeEvidence: [{
        filePath: "src/entity.ts",
        lineStart: 1,
        snippet: "entityEvidence();",
        confidence: "INFERRED",
        sourceConfidence: "repository-captured",
      }],
      history: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "native:entity:publish-report",
      kind: "entity:participant",
      subject: "Publish report",
      structure: { type: "ENTITY", entityKind: "participant", name: "Publish report" },
      activeEvidence: [{
        filePath: "src/entity.ts",
        lineStart: 2,
        snippet: "otherEntityEvidence();",
        confidence: "INFERRED",
        sourceConfidence: "repository-captured",
      }],
      history: [],
      createdAt: now,
      updatedAt: now,
    },
  ];

  const result = projectKnowledgeBehaviorSlice(records, "native:flow:report-generation");
  const correction = result.behaviorSlice.flows.find((fact) => fact.text === "Apply reviewed corrections");
  const publication = result.behaviorSlice.flows.find((fact) => fact.text === "Publish report");

  assert.deepEqual(correction?.requiredEvidenceClaimIds, [
    "native:flow:report-generation#active-evidence-0",
  ]);
  assert.deepEqual(publication?.requiredEvidenceClaimIds, [
    "native:flow:report-generation#active-evidence-1",
  ]);
});
