# Legora — Production Cartographer Adapter Design

## 0. Document Status

- Project: **Legora**
- Date: 2026-08-21
- Status: **Approved Design**
- Scope: Production boundary from an actual Cartographer world model to a Legora-owned, question-scoped `BehaviorSlice`
- Depends on:
  - `docs/design/2026-08-14-human-understanding-system-design.md`
  - `docs/references/2026-08-14-tier1-architecture-review.md`
  - `docs/spikes/2026-08-14-cartographer-learn-codebase-integration-spike-results.md`
  - `docs/spikes/2026-08-21-legora-existence-value-e2e-results.md`
  - Actual Cartographer model observed at `.cartographer/model.json`
- Implementation status: **Not implemented in production**

---

# 1. Purpose

Cartographer owns a persistent repository world model. Legora must consume that model without copying Cartographer's ontology into Legora or making Router / Explain / Explore / Verify depend on Cartographer-native JSON.

The production boundary must do four things:

1. read a provider model safely;
2. validate the provider shape conservatively;
3. project one explicitly selected Cartographer behavior slice into a smaller Legora-owned `BehaviorSlice`;
4. preserve a direct evidence link for every behavior fact so later explanation or executable behavior cannot become more certain than repository evidence.

The core rule is:

> **Cartographer owns the persistent world model; Legora owns only a question-scoped understanding projection.**

---

# 2. Non-Goals

This design does **not** introduce:

- a second persistent world-model database;
- generic graph traversal or repository indexing;
- automatic discovery of the user's intended Cartographer slice inside the adapter;
- prose-based inference to fill missing states, events, constraints, effects, or failures;
- recursive semantic expansion across the Cartographer graph;
- Cartographer UI integration;
- Cartographer-specific types inside Understanding Router, Explain, Explore, Verify, or Microworld contracts;
- a requirement that Cartographer always be running while Legora consumes an already-created provider snapshot.

---

# 3. Architectural Decision

The production path is split into I/O, provider decoding, semantic projection, and evidence normalization.

```text
.cartographer/model.json
        ↓
CartographerSource
        ↓ unknown
CartographerModelDecoder
        ↓
CartographerModelView
        ↓
CartographerSliceProjector
        ↓
EvidenceNormalizer
        ↓
CartographerProjectionResult
        ├─ BehaviorSlice
        ├─ EvidenceClaim[]
        └─ Diagnostics
```

The separation is intentional.

- `CartographerSource` knows where bytes come from.
- `CartographerModelDecoder` knows the observed Cartographer storage shape.
- `CartographerSliceProjector` knows the small allowlisted semantic mapping into Legora.
- Legora downstream components know only Legora contracts.

A Cartographer storage change should normally require changing the source/decoder layer, not Router / Explain / Explore / Verify.

---

# 4. Responsibility Boundaries

## 4.1 `CartographerSource`

Responsibility: provider I/O only.

Input:

```text
repositoryRoot
```

Output:

```text
unknown provider document
```

MVP source:

```text
<repositoryRoot>/.cartographer/model.json
```

Rules:

- do not mutate the target repository;
- do not invoke Cartographer writes;
- do not infer provider semantics;
- distinguish missing model, unreadable model, malformed JSON, and successful read;
- return bytes/data to the decoder rather than provider-native objects to Legora callers.

The source may later be replaced by an MCP-backed source without changing the Legora semantic contract.

## 4.2 `CartographerModelDecoder`

Responsibility: validate the provider's observed structural contract and return a typed ephemeral view.

It is the only production layer allowed to know the raw Cartographer JSON shape.

Required top-level shape for decoder v1:

```text
rootPath: string
entities: array
relationships: array
slices: array
```

`perspectives` and other provider fields may be present but are not required for BehaviorSlice projection.

Decoder behavior:

- reject missing required top-level fields;
- reject duplicate object IDs where identity would become ambiguous;
- reject slice steps that reference missing entities;
- retain unknown extra fields without assigning them Legora semantics;
- map unknown future confidence values to `UNKNOWN`, never to a stronger confidence;
- validate evidence records and source anchors before they can contribute to `CONFIRMED` evidence;
- validate the provider `rootPath` against the expected repository root using normalized filesystem comparison;
- fail closed on structural ambiguity that could change semantic meaning.

Cartographer currently does not provide a dependable provider schema version in the observed `model.json`. Therefore Legora must not invent a Cartographer schema version. Legora instead versions its own decoder contract, for example `cartographer-decoder-v1`.

## 4.3 `CartographerModelView`

Responsibility: short-lived typed representation of the decoded provider model.

It is:

- ephemeral;
- provider-specific;
- not persisted as a new Legora world model;
- not exposed to Router / Explain / Explore / Verify.

## 4.4 `CartographerSliceProjector`

Responsibility: convert **one explicit Cartographer `sliceId`** into a Legora projection.

Input:

```text
CartographerModelView
sliceId
```

The projector does **not** decide which slice best answers the user's question. Slice selection belongs above the adapter boundary, where the user request and understanding goal are available.

A missing `sliceId` fails closed with a typed adapter error.

---

# 5. Canonical Legora Behavior Contract

The earlier spike used bare string arrays plus one global evidence list. That is insufficient for production because it loses which evidence supports each simplified claim.

Production uses evidence-addressable facts.

```ts
interface BehaviorFact {
  text: string;
  providerRefs: string[];
  requiredEvidenceClaimIds: string[];
}

interface BehaviorSlice {
  owner: "LEGORA";
  subject: string;
  participants: BehaviorFact[];
  states: BehaviorFact[];
  events: BehaviorFact[];
  flows: BehaviorFact[];
  constraints: BehaviorFact[];
  effects: BehaviorFact[];
  failures: BehaviorFact[];
}
```

Rules:

1. every `BehaviorFact` must identify the provider object(s) from which it was projected;
2. every `BehaviorFact` must identify the normalized evidence claim(s) required to justify that fact;
3. a fact may exist with `INFERRED` or `UNKNOWN` evidence for explanation purposes, but executable behavior must apply a stronger gate;
4. simplification may reduce detail but must not remove the ability to trace a fact back to evidence;
5. no downstream component may strengthen the evidence confidence attached to the fact.

This makes the principle **"simplification must not increase certainty"** enforceable in data rather than relying only on prompt behavior.

---

# 6. Normalized Evidence Contract

Provider evidence is converted into Legora evidence claims.

```ts
interface EvidenceClaim {
  id: string;
  claim: string;
  confidence: "CONFIRMED" | "INFERRED" | "UNKNOWN";
  sourceConfidence: string;
  evidence: EvidenceAnchor[];
  providerObjectId: string;
  provenance: string | null;
}
```

A valid source anchor requires at minimum:

```text
filePath: non-empty string
lineStart: positive integer
```

`lineEnd` and `snippet` may be preserved when supplied.

Confidence mapping:

```text
proven + valid source anchor
→ CONFIRMED

high / medium / low + valid source anchor
→ INFERRED

speculative
→ UNKNOWN

proven without valid source anchor
→ UNKNOWN

unknown future confidence value
→ UNKNOWN
```

This mapping is monotonic: normalization may weaken certainty but cannot strengthen it.

---

# 7. Projection Mapping

The projector uses explicit provider structure only.

## 7.1 Direct slice mapping

```text
Cartographer slice.name
→ BehaviorSlice.subject

slice step whose entity.kind == actor
→ participants

slice step whose entity.kind == state
→ states

slice step whose entity.kind == event
→ events

slice step label
→ flows
```

A flow fact receives evidence from the slice plus the referenced step entity as available. It does not infer additional semantics from the wording of the label.

## 7.2 Allowlisted one-hop semantic context

The projector may inspect exactly one relationship hop around entities already referenced by the selected slice.

Allowed semantic entity kinds:

```text
invariant
side-effect
failure-point
```

Allowed mappings:

```text
invariant --guards→ slice-step entity
→ constraints

slice-step entity --triggers→ side-effect
→ effects

slice-step entity --triggers→ failure-point
→ failures
```

Equivalent reverse storage direction may be accepted only when the relationship kind and endpoint kinds still express the same explicit relation.

No other entity/relationship combination acquires Legora semantics by default.

## 7.3 Explicit limits

The projector must not:

- recursively traverse beyond one hop;
- convert arbitrary entity descriptions into state/event/failure facts;
- infer a constraint from a prose phrase such as "only one" unless represented by an allowed semantic object/relationship;
- infer missing failure behavior from tests or filenames during projection;
- import unrelated neighboring entities merely because they share a boundary;
- treat Cartographer confidence as executable permission by itself.

Empty output categories are valid.

For example, if the selected provider slice contains no explicit state entity:

```text
states: []
```

is correct and preferable to an invented state.

---

## 7.4 Evidence binding per BehaviorFact

Evidence binding is deterministic; the projector does not choose supporting evidence by semantic similarity.

```text
participant / state / event
providerRefs = [step entity id]
requiredEvidenceClaimIds = normalized evidence from that step entity

flow
providerRefs = [slice id, step entity id]
requiredEvidenceClaimIds = normalized evidence from the slice and that step entity

constraint
providerRefs = [invariant entity id, guards relationship id, guarded step entity id]
requiredEvidenceClaimIds = normalized evidence from the invariant and guards relationship; step evidence may be retained when present

effect
providerRefs = [step entity id, triggers relationship id, side-effect entity id]
requiredEvidenceClaimIds = normalized evidence from the triggers relationship and side-effect entity; step evidence may be retained when present

failure
providerRefs = [step entity id, triggers relationship id, failure-point entity id]
requiredEvidenceClaimIds = normalized evidence from the triggers relationship and failure-point entity; step evidence may be retained when present
```

A normalized evidence claim ID is deterministic within one decoded provider model:

```text
<providerObjectId>#<providerEvidenceId>
```

If the provider evidence record has no ID, the decoder assigns a deterministic index-based local ID only for that decoded model. Such an ID does not create confidence; the source-anchor rules still determine confidence.

A `BehaviorFact` with no normalized evidence claims may be retained only as non-executable descriptive structure when the provider explicitly supplied the fact. It must never become executable.


# 8. Executable Behavior Gate

`BehaviorSlice` is an understanding representation, not automatic executable permission.

For a `BehaviorFact` to be used as an executable Microworld transition or constraint:

1. it must contain at least one `requiredEvidenceClaimId`;
2. every evidence claim required by that executable fact must resolve to an existing normalized evidence claim;
3. every required claim must be `CONFIRMED`;
4. every required claim must contain a valid source anchor;
5. no unresolved provider reference may participate in the executable fact.

Otherwise:

```text
explanation candidate: possibly allowed
executable behavior: denied
```

This preserves the existing rule:

> **No Evidence, No Executable Behavior.**

---

# 9. Projection Result Contract

The adapter returns a provider-neutral result envelope.

```ts
interface CartographerProjectionResult {
  provider: {
    kind: "CARTOGRAPHER";
    projectRoot: string;
    modelId: string | null;
    sliceId: string;
    decoderContract: "cartographer-decoder-v1";
  };
  behaviorSlice: BehaviorSlice;
  evidenceClaims: EvidenceClaim[];
  diagnostics: {
    warnings: AdapterDiagnostic[];
    ignoredKinds: string[];
    ignoredRelations: string[];
  };
}
```

Diagnostics are observability, not hidden inference.

Examples:

- unknown provider entity kind was ignored;
- relationship kind was outside the allowlist;
- provider evidence had no valid source anchor and was downgraded to `UNKNOWN`;
- optional provider field was not recognized.

Structural failures that could invalidate identity or evidence mapping are errors, not warnings.

---

# 10. Failure Model

Expected typed failures include:

```text
CARTOGRAPHER_MODEL_NOT_FOUND
CARTOGRAPHER_MODEL_UNREADABLE
CARTOGRAPHER_MODEL_INVALID_JSON
CARTOGRAPHER_MODEL_SHAPE_UNSUPPORTED
CARTOGRAPHER_ROOT_MISMATCH
CARTOGRAPHER_DUPLICATE_ID
CARTOGRAPHER_SLICE_NOT_FOUND
CARTOGRAPHER_SLICE_ENTITY_NOT_FOUND
CARTOGRAPHER_EVIDENCE_REFERENCE_INVALID
```

Fail-closed principle:

- unknown optional data → ignore + diagnostic;
- unknown confidence → `UNKNOWN`;
- missing evidence → non-executable;
- ambiguous identity/reference → reject projection;
- malformed required provider structure → reject decoding.

No failure path silently substitutes a guessed fact.

---

# 11. Provider Access Strategy

MVP primary path:

```text
local .cartographer/model.json
→ CartographerSource
```

This is acceptable because Cartographer owns that provider-local storage and the target repository's tracked source/product files remain read-only from Legora's perspective.

A later MCP source may provide the same decoded input boundary:

```text
Cartographer MCP
→ CartographerSource implementation
→ same Decoder / Projector
```

The semantic projector must not depend on whether data came from disk or MCP.

---

# 12. Testing Strategy

Production implementation uses TDD.

## 12.1 Decoder tests

Must cover:

- real observed Cartographer v0.8.0-style model fixture decodes;
- missing required top-level field fails;
- root mismatch fails;
- duplicate IDs fail;
- slice step references missing entity fails;
- unknown extra fields are tolerated;
- unknown confidence becomes `UNKNOWN`;
- `proven` without a valid source anchor does not become `CONFIRMED`.

## 12.2 Projector tests

Must cover:

- explicit slice becomes `owner: LEGORA` `BehaviorSlice`;
- actor/state/event only map from explicitly typed step entities;
- flow labels remain traceable to provider refs and evidence claims;
- one-hop `invariant --guards→ step` becomes a constraint;
- one-hop `step --triggers→ side-effect` becomes an effect;
- one-hop `step --triggers→ failure-point` becomes a failure;
- two-hop semantic neighbors are not imported;
- arbitrary prose is not promoted into a typed fact;
- missing slice fails closed;
- all `requiredEvidenceClaimIds` resolve.

## 12.3 Executable gate tests

Must cover:

- fully `CONFIRMED` fact is eligible;
- `INFERRED` fact is ineligible for execution;
- `UNKNOWN` fact is ineligible for execution;
- mixed required evidence where one claim is weaker than `CONFIRMED` is ineligible;
- missing evidence reference is ineligible/fails validation.

## 12.4 Actual-model integration test

Use a copy/fixture derived from the observed Legora Cartographer model shape rather than reading mutable `.cartographer/model.json` as a deterministic unit-test dependency.

A separate integration test may read the current real `.cartographer/model.json` and prove compatibility, but production unit tests must remain reproducible without requiring Cartographer to run.

---

# 13. Migration From Existing Spikes

Existing spike code under `.chatgpt2codex/spikes/` remains throwaway evidence and is not imported directly as production code.

Production implementation should preserve the proven behavior while rewriting against the production contracts:

```text
spike nested evidence parsing
→ decoder/evidence normalization tests first

spike explicit slice projection
→ projector tests first

spike one-hop semantic context
→ allowlisted semantic mapping tests first

spike missing-slice refusal
→ typed failure test first
```

The earlier bare-string `BehaviorSlice` spike contract is superseded for production by evidence-addressable `BehaviorFact` members.

---

# 14. Repository Hygiene

- Cartographer provider storage remains under `.cartographer/`.
- Legora must not stage or commit `.cartographer/` provider runtime data by default.
- Throwaway spikes remain under ignored `.chatgpt2codex/spikes/`.
- Production implementation must live outside ignored spike directories.
- No global Git configuration changes are required; repository operations on this filesystem use command-local `safe.directory` when necessary.

---

# 15. Acceptance Criteria

The production adapter design is satisfied only when all of the following are true:

1. Cartographer raw storage shape is isolated behind a decoder boundary.
2. Router / Explain / Explore / Verify do not import Cartographer-native model types.
3. `BehaviorSlice` is ephemeral and Legora-owned.
4. Every behavior fact is traceable to provider refs and normalized evidence claims.
5. Confidence normalization never strengthens provider evidence.
6. Projection uses explicit slice structure plus only allowlisted one-hop semantics.
7. Missing categories remain empty rather than inferred.
8. Executable behavior requires `CONFIRMED` evidence for every required claim.
9. Unknown provider additions degrade safely through diagnostics or `UNKNOWN` confidence.
10. Structural ambiguity fails closed.
11. Unit tests are deterministic without a running Cartographer service.
12. A real-model integration test demonstrates compatibility with an actual Cartographer-generated model.

---

# 16. Next Gate

After written-spec approval:

1. create a TDD implementation plan;
2. implement the canonical `BehaviorFact` / `BehaviorSlice` contract first;
3. implement `CartographerModelDecoder`;
4. implement `CartographerSliceProjector` and evidence normalization;
5. implement the executable evidence gate;
6. verify against deterministic fixtures;
7. run a separate integration check against an actual Cartographer-generated model;
8. only after that, connect the resulting `BehaviorSlice` to the existing Prediction / Microworld / Transfer Verify path.

No production adapter implementation begins before this written spec is reviewed and approved.
