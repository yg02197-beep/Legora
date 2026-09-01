# Step Evidence Attribution Design

## Problem

Simple flow acquisition currently accepts one flow-wide `evidenceLocators` array and copies it onto every generated participant Entity and the Flow record. A flow with 8 unique source locators and 9 generated steps therefore stores the same evidence repeatedly across 10 records. Entry freshness then reports 80 record-anchor checks even though there are only 8 unique source locations, and projected step facts can display broad duplicated evidence such as `+15`.

This also loses semantic attribution: Legora knows which source locations were seen while acquiring the flow, but not which locations directly ground each step.

## Goal

Allow a flow step to identify the source evidence that directly grounds that step without making reusable Entity records flow-specific, while preserving compatibility with existing Knowledge records and existing simple-acquisition input.

## Non-goals

- Do not redesign Entity identity or duplicate detection.
- Do not require migration of existing `.legora/repository-knowledge.json` files.
- Do not implement question-specific minimal-slice selection in this change.
- Do not change confidence promotion rules; acquired source remains `INFERRED` unless another existing mechanism confirms it.
- Do not make Git optional for `legora scan` in this change.

## Chosen model

Step evidence belongs to the Behavior Flow, not to the referenced Entity.

### Agent-facing simple acquisition

`SimpleFlowAcquisitionStep` gains an optional `evidenceLocators` field:

```ts
export interface SimpleFlowAcquisitionStep {
  entity: string;
  label?: string;
  evidenceLocators?: KnowledgeEvidenceLocator[];
}
```

The existing top-level `SimpleFlowAcquisitionInput.evidenceLocators` remains required and continues to mean evidence for the overall flow. Existing inputs therefore remain valid.

When a step supplies `evidenceLocators`, those locators mean "this source directly grounds this step". When omitted, the step uses legacy flow-level grounding behavior.

### Persisted flow structure

`KnowledgeBehaviorFlowStep` gains optional indexes into the owning Flow record's `activeEvidence` array:

```ts
export interface KnowledgeBehaviorFlowStep {
  entityId: string;
  label?: string;
  evidenceAnchorIndexes?: number[];
}
```

Indexes are used instead of embedding captured evidence in `structure` so that evidence snapshots, confidence, freshness, and history continue to live in the existing `KnowledgeRecord.activeEvidence` / `history` lifecycle.

For a newly acquired flow, the Flow candidate's evidence locator list is the stable, deduplicated union of:

1. top-level flow evidence locators, then
2. each step's explicit evidence locators in step order.

Locator identity is `(filePath, lineStart, lineEnd)` after the existing locator validation rules. Each step's `evidenceAnchorIndexes` points to the corresponding locations in this union. Duplicate locators are stored once and may be referenced by multiple steps.

### Participant Entity evidence

Generated participant Entities remain reusable records. They must not be updated merely because the same Entity appears in another Flow.

For a newly generated Entity, acquisition may use that step's explicit locators when present, otherwise the flow-level locators, as evidence that the Entity was observed. If an Entity already exists, the Flow acquisition reuses its ID without replacing its evidence.

Flow-step facts must not treat Entity evidence as direct evidence for the step when explicit step evidence exists.

## Projection semantics

For a flow step with `evidenceAnchorIndexes`:

- Project only the indexed claims from the Flow record as `requiredEvidenceClaimIds` for that step's flow fact.
- Keep the Entity reference for semantic identity / traceability, but do not add the Entity's claims to that step's required evidence.
- Reject or diagnose out-of-range indexes rather than silently broadening grounding.

For a legacy step without `evidenceAnchorIndexes`, preserve the current projection behavior so existing repositories continue to work without migration.

## Freshness semantics

Entry freshness should follow the evidence claims that actually ground the projected slice, rather than every semantic provider reference.

The projection already exposes `EvidenceClaim.providerObjectId`. `checkProjectionFreshness` should therefore determine referenced Knowledge records from the `requiredEvidenceClaimIds` used by projected facts plus the selected Flow record, instead of treating every `providerRef` as evidence-bearing.

This prevents a reusable Entity from causing redundant freshness checks when its evidence is not required to ground a step.

Freshness remains fail-closed: any required record that is `STALE` or `UNKNOWN` still blocks `READY`.

## Human-readable evidence output

Two display problems are addressed:

1. Fact anchor lists should be deduplicated by source locator before rendering `+N`.
2. READY evidence summary should distinguish unique source locations from raw record-anchor checks when they differ.

Preferred wording:

```text
8 unique anchors checked, all CURRENT
```

If implementation still performs more raw checks than unique locators for required records, expose both counts rather than presenting the larger number as independent evidence, for example:

```text
8 unique anchors (12 record-anchor checks), all CURRENT
```

The JSON result remains backward compatible; additive diagnostic fields are allowed if needed, but existing fields and statuses must not be removed or renamed.

## Backward compatibility

- Existing simple flow acquisition JSON without per-step evidence remains accepted.
- Existing persisted Flow steps without `evidenceAnchorIndexes` remain valid and use legacy projection semantics.
- Existing Entity records are never rewritten simply to attach evidence from a new Flow.
- Existing `READY`, `KNOWLEDGE_STALE`, `KNOWLEDGE_UNKNOWN`, candidate and acquisition status names remain unchanged.

## Failure behavior

Fail closed for malformed step evidence:

- `evidenceLocators` present but empty is invalid.
- Any malformed locator is invalid.
- Persisted `evidenceAnchorIndexes` containing a negative, fractional, duplicate, or out-of-range index must not silently fall back to all flow evidence.

Acquisition remains atomic: invalid step evidence rejects the proposal before partial Knowledge publication.

## Tests

The implementation must add or update tests covering:

1. Explicit per-step evidence is stored separately from flow-wide evidence.
2. Two steps can share one deduplicated locator.
3. Existing flow input without step evidence behaves as before.
4. Reusing an existing Entity does not replace that Entity's active evidence.
5. Projected step facts with explicit evidence use only their indexed flow claims.
6. Legacy persisted steps still project with legacy grounding.
7. Invalid evidence indexes fail closed / emit the existing projection error path rather than broadening evidence.
8. Freshness does not check a semantic Entity record when no projected fact requires its evidence.
9. Human fact rendering deduplicates identical locators.
10. Human READY summary reports unique anchors accurately.
11. Full unit, typecheck, build, R4 integration, and R5 integration gates remain green on Ubuntu and Windows CI.

## Acceptance criteria

The original reproduction must no longer turn 8 unique flow sources into a misleading `80 anchors checked` result solely because the flow has 9 steps. A newly acquired flow with explicit step evidence must let each projected step point to its own direct source locations while preserving reusable Entity identity and all existing repository Knowledge compatibility.