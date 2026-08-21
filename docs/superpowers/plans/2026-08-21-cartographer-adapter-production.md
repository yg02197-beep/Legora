# Production Cartographer Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Subagent-driven execution is intentionally disabled for this project.

**Goal:** Build the first production Legora adapter that safely reads an actual Cartographer model and projects one explicit provider slice into an evidence-addressable, Legora-owned `BehaviorSlice` without inventing unsupported behavior.

**Architecture:** Keep provider I/O, Cartographer shape decoding, semantic projection, and executable-evidence gating separate. Cartographer remains the persistent world-model owner; Legora creates only an ephemeral question-scoped projection whose every fact carries provider references and normalized evidence claim IDs.

**Tech Stack:** Node.js, TypeScript, ESM, built-in `node:test`, `tsx` for TypeScript test execution, `@types/node` for Node built-in module types, `tsc --noEmit` for type verification. No production runtime dependency is required.

**Spec:** `docs/superpowers/specs/2026-08-21-cartographer-adapter-production-design.md`

## Global Constraints

- No subagents or parallel-agent execution.
- Do not import production code from `.chatgpt2codex/spikes/`; spikes are evidence only.
- Do not stage or commit `.cartographer/` provider runtime data.
- Do not modify global Git configuration; use command-local `git -c safe.directory=D:/Projects/Legora ...` when needed.
- Do not commit or push unless the user explicitly approves that action.
- `BehaviorSlice` remains ephemeral and Legora-owned; do not create a second persistent world-model database.
- Projection accepts an explicit Cartographer `sliceId`; adapter code must not guess the best slice from prose.
- Semantic expansion is exactly one relationship hop and only for the allowlisted mappings in the approved spec.
- Empty `states`, `events`, `constraints`, `effects`, or `failures` are valid and must not be filled by inference.
- Confidence normalization may weaken provider certainty but may never strengthen it.
- No evidence means no executable behavior.

---

## File Structure

```text
package.json
  project test/typecheck scripts and dev-only tooling

package-lock.json
  generated lockfile for the declared dev-only tooling

tsconfig.json
  strict TypeScript contract

src/core/contracts.ts
  provider-neutral Legora BehaviorFact, BehaviorSlice, EvidenceClaim,
  diagnostics, and projection-result contracts

src/core/executable-evidence-gate.ts
  provider-neutral executable eligibility check for one BehaviorFact

src/providers/cartographer/errors.ts
  typed Cartographer adapter errors

src/providers/cartographer/source.ts
  read/parse <repositoryRoot>/.cartographer/model.json only

src/providers/cartographer/model-view.ts
  provider-specific ephemeral decoded model types

src/providers/cartographer/decoder.ts
  validate unknown JSON into CartographerModelView

src/providers/cartographer/evidence.ts
  normalize nested Cartographer evidence into Legora EvidenceClaim records

src/providers/cartographer/projector.ts
  explicit slice -> evidence-addressable Legora BehaviorSlice projection

src/providers/cartographer/adapter.ts
  public orchestration facade: source -> decoder -> projector

tests/fixtures/cartographer/model-v0.8.0.json
  deterministic fixture derived from the observed real Cartographer v0.8.0 model shape

tests/unit/core/contracts.test.ts
tests/unit/core/executable-evidence-gate.test.ts
tests/unit/providers/cartographer/source.test.ts
tests/unit/providers/cartographer/decoder.test.ts
tests/unit/providers/cartographer/evidence.test.ts
tests/unit/providers/cartographer/projector.test.ts
tests/unit/providers/cartographer/adapter.test.ts

tests/integration/providers/cartographer/real-model.test.ts
  explicit compatibility check against current .cartographer/model.json
```

The Prediction / Microworld / Transfer Verify path is not productionized in this plan. This plan ends when the adapter boundary itself passes deterministic and real-model verification. Connecting this result downstream is the next architectural gate.

---

### Task 1: Establish the production TypeScript contract and evidence-addressable BehaviorSlice

**Files:**
- Create: `package.json`
- Create: `package-lock.json` via `npm install`
- Create: `tsconfig.json`
- Create: `src/core/contracts.ts`
- Test: `tests/unit/core/contracts.test.ts`

**Interfaces:**
- Produces:
  - `EvidenceConfidence = "CONFIRMED" | "INFERRED" | "UNKNOWN"`
  - `EvidenceAnchor`
  - `EvidenceClaim`
  - `BehaviorFact`
  - `BehaviorSlice`
  - `AdapterDiagnostic`
  - `CartographerProjectionResult`

Use these exact provider-neutral shapes:

```ts
interface EvidenceAnchor {
  filePath: string;
  lineStart: number;
  lineEnd?: number;
  snippet?: string;
}

interface AdapterDiagnostic {
  code: string;
  message: string;
  providerRef?: string;
}
```

- [ ] **Step 1: Write the failing contract test**

Create `tests/unit/core/contracts.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import type {
  BehaviorFact,
  BehaviorSlice,
  CartographerProjectionResult,
  EvidenceClaim,
} from "../../../src/core/contracts.ts";

function identity<T>(value: T): T { return value; }

test("BehaviorFact keeps provider and evidence traceability", () => {
  const fact = identity<BehaviorFact>({
    text: "Requests share one in-flight refresh",
    providerRefs: ["slice:lock-on", "transition:shared-refresh"],
    requiredEvidenceClaimIds: ["transition:shared-refresh#ev:1"],
  });
  assert.deepEqual(fact.providerRefs, ["slice:lock-on", "transition:shared-refresh"]);
  assert.deepEqual(fact.requiredEvidenceClaimIds, ["transition:shared-refresh#ev:1"]);
});

test("BehaviorSlice is Legora-owned and fact-addressable", () => {
  const fact: BehaviorFact = {
    text: "expired request",
    providerRefs: ["actor:expired request"],
    requiredEvidenceClaimIds: ["actor:expired request#ev:1"],
  };
  const slice = identity<BehaviorSlice>({
    owner: "LEGORA",
    subject: "Lock enabled refresh deduplication",
    participants: [fact], states: [], events: [], flows: [],
    constraints: [], effects: [], failures: [],
  });
  assert.equal(slice.owner, "LEGORA");
  assert.equal(slice.participants[0]?.text, "expired request");
});

test("projection result exposes normalized evidence and diagnostics", () => {
  const claim = identity<EvidenceClaim>({
    id: "actor:expired request#ev:1",
    claim: "Expired requests enter the refresh path",
    confidence: "CONFIRMED",
    sourceConfidence: "proven",
    evidence: [{ filePath: "fixture/refresh.mjs", lineStart: 1 }],
    providerObjectId: "actor:expired request",
    provenance: "deterministic",
  });
  const result = identity<CartographerProjectionResult>({
    provider: {
      kind: "CARTOGRAPHER",
      projectRoot: "D:/Projects/Legora",
      modelId: "model:legora",
      sliceId: "slice:lock-on",
      decoderContract: "cartographer-decoder-v1",
    },
    behaviorSlice: {
      owner: "LEGORA", subject: "Lock enabled refresh deduplication",
      participants: [], states: [], events: [], flows: [],
      constraints: [], effects: [], failures: [],
    },
    evidenceClaims: [claim],
    diagnostics: { warnings: [], ignoredKinds: [], ignoredRelations: [] },
  });
  assert.equal(result.evidenceClaims[0]?.confidence, "CONFIRMED");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --import tsx --test tests/unit/core/contracts.test.ts
```

Expected before setup: FAIL because `tsx` and/or `src/core/contracts.ts` do not exist.

- [ ] **Step 3: Add minimal project tooling**

Create `package.json`:

```json
{
  "name": "legora",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --import tsx --test tests/unit/**/*.test.ts",
    "test:integration:cartographer-real": "node --import tsx --test tests/integration/providers/cartographer/real-model.test.ts",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "tsx": "^4.19.3",
    "typescript": "^5.7.3"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

Install only the declared dev tooling with `npm install`.

- [ ] **Step 4: Implement provider-neutral contracts**

`src/core/contracts.ts` must encode exactly the approved public shapes. `BehaviorFact` must contain `text`, `providerRefs`, and `requiredEvidenceClaimIds`; `BehaviorSlice.owner` is literal `"LEGORA"`.

- [ ] **Step 5: Run GREEN and typecheck**

```powershell
npm test -- --test-name-pattern="BehaviorFact|BehaviorSlice|projection result"
npm run typecheck
```

Expected: contract tests PASS and typecheck exits 0.

- [ ] **Step 6: Review checkpoint**

Inspect only Task 1 diff. Do not commit or push without explicit user approval.

---

### Task 2: Add typed Cartographer source failures and repository-local model reading

**Files:**
- Create: `src/providers/cartographer/errors.ts`
- Create: `src/providers/cartographer/source.ts`
- Test: `tests/unit/providers/cartographer/source.test.ts`

**Interfaces:**
- Produces:
  - `CartographerAdapterErrorCode`
  - `CartographerAdapterError`
  - `readCartographerDocument(repositoryRoot: string): Promise<unknown>`

- [ ] **Step 1: Write failing source tests**

Use `node:fs/promises.mkdtemp` in the OS temp directory. Cover:

```ts
test("missing model has CARTOGRAPHER_MODEL_NOT_FOUND");
test("invalid JSON has CARTOGRAPHER_MODEL_INVALID_JSON");
test("non-ENOENT read failure maps to CARTOGRAPHER_MODEL_UNREADABLE");
test("valid JSON is returned as unknown provider data");
```

For the unreadable case, unit-test a pure failure-mapping helper with a synthetic non-ENOENT error rather than relying on Windows ACL behavior.

- [ ] **Step 2: Verify RED**

```powershell
node --import tsx --test tests/unit/providers/cartographer/source.test.ts
```

Expected: FAIL because source/error modules do not exist.

- [ ] **Step 3: Implement typed errors**

`errors.ts` must expose all approved codes:

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

`CartographerAdapterError` stores `code` and optional `details`; it never substitutes guessed behavior.

- [ ] **Step 4: Implement source-only I/O**

`source.ts` performs exactly:

```text
repositoryRoot/.cartographer/model.json
-> read UTF-8
-> JSON.parse
-> unknown
```

Map `ENOENT` to NOT_FOUND, parse failure to INVALID_JSON, and other read failures to UNREADABLE. Do not inspect entity/slice semantics here.

- [ ] **Step 5: Run GREEN**

```powershell
node --import tsx --test tests/unit/providers/cartographer/source.test.ts
npm run typecheck
```

- [ ] **Step 6: Review checkpoint**

Verify source code contains no Cartographer semantic mapping. No commit/push.

---

### Task 3: Decode the observed Cartographer model shape and normalize nested evidence conservatively

**Files:**
- Create: `src/providers/cartographer/model-view.ts`
- Create: `src/providers/cartographer/decoder.ts`
- Create: `src/providers/cartographer/evidence.ts`
- Create: `tests/fixtures/cartographer/model-v0.8.0.json`
- Test: `tests/unit/providers/cartographer/decoder.test.ts`
- Test: `tests/unit/providers/cartographer/evidence.test.ts`

**Interfaces:**
- Produces:
  - `CartographerModelView`
  - `decodeCartographerModel(document: unknown, expectedRepositoryRoot: string): CartographerModelView`
  - `normalizeCartographerObjectEvidence(object): EvidenceClaim[]`

`CartographerModelView` carries provider-only decoder diagnostics so unknown-but-optional provider additions can be surfaced later without leaking raw provider JSON downstream:

```ts
interface CartographerDecodeDiagnostics {
  warnings: AdapterDiagnostic[];
  ignoredFields: string[];
}

interface CartographerEvidenceRecordView {
  id?: string;
  confidence: string;
  provenance: string | null;
  anchors: Array<Partial<EvidenceAnchor>>;
}

interface CartographerEntityView {
  id: string;
  kind: string;
  name?: string;
  description?: string;
  evidence: CartographerEvidenceRecordView[];
}

interface CartographerRelationshipView {
  id: string;
  kind: string;
  source: string;
  target: string;
  description?: string;
  evidence: CartographerEvidenceRecordView[];
}

interface CartographerSliceStepView {
  entityId: string;
  label?: string;
}

interface CartographerSliceView {
  id: string;
  name: string;
  description?: string;
  steps: CartographerSliceStepView[];
  evidence: CartographerEvidenceRecordView[];
}

interface CartographerModelView {
  decoderContract: "cartographer-decoder-v1";
  id: string | null;
  rootPath: string;
  entities: CartographerEntityView[];
  relationships: CartographerRelationshipView[];
  slices: CartographerSliceView[];
  entitiesById: ReadonlyMap<string, CartographerEntityView>;
  decodeDiagnostics: CartographerDecodeDiagnostics;
}
```

- [ ] **Step 1: Create deterministic observed-shape fixture**

The compact fixture must be derived from the actual v0.8.0 shape and contain:

- top-level `id`, `rootPath`, `entities`, `relationships`, `slices`;
- actor, state, event, capability, invariant, side-effect, failure-point, transition examples;
- nested evidence records `{ anchors, confidence, provenance, id }`;
- one explicit slice with steps;
- one `guards` relation and two `triggers` relations;
- one unrelated two-hop semantic neighbor for non-import testing.

Use neutral fixture root `C:/fixture/repo` and pass the same expected root in tests.

- [ ] **Step 2: Write decoder RED tests**

Cover exactly:

```ts
test("observed v0.8.0-style fixture decodes");
test("missing entities array fails with CARTOGRAPHER_MODEL_SHAPE_UNSUPPORTED");
test("root mismatch fails with CARTOGRAPHER_ROOT_MISMATCH");
test("duplicate entity id fails with CARTOGRAPHER_DUPLICATE_ID");
test("slice step pointing to missing entity fails with CARTOGRAPHER_SLICE_ENTITY_NOT_FOUND");
test("unknown extra top-level fields are tolerated and recorded as decoder diagnostics");
```

Success assertions include:

```ts
assert.equal(model.decoderContract, "cartographer-decoder-v1");
assert.equal(model.rootPath, "C:/fixture/repo");
assert.ok(model.entitiesById.has("actor:request"));
```

- [ ] **Step 3: Verify decoder RED**

```powershell
node --import tsx --test tests/unit/providers/cartographer/decoder.test.ts
```

- [ ] **Step 4: Implement minimum structural decoder**

Code these rules explicitly:

```text
required top-level: rootPath:string, entities:array, relationships:array, slices:array
root comparison: path.resolve; lowercase only on win32
duplicate IDs that make identity ambiguous: reject
slice.steps[].entityId must resolve to entitiesById
unknown extra fields: tolerate without semantics
malformed identity/reference: reject
```

Do not persist the decoded view.

- [ ] **Step 5: Write evidence normalization RED tests**

Cover:

```ts
test("proven plus valid anchor becomes CONFIRMED");
test("high medium and low plus valid anchor become INFERRED");
test("speculative remains UNKNOWN even with anchor");
test("proven without positive lineStart becomes UNKNOWN");
test("unknown future confidence becomes UNKNOWN");
test("claim id is providerObjectId#providerEvidenceId");
test("missing provider evidence id uses deterministic decoded-model index without increasing confidence");
```

- [ ] **Step 6: Verify evidence RED, implement normalizer, then GREEN**

`normalizeCartographerObjectEvidence` reads only nested `object.evidence[]`. A valid source anchor requires non-empty `filePath` and positive integer `lineStart`.

Run:

```powershell
node --import tsx --test tests/unit/providers/cartographer/decoder.test.ts tests/unit/providers/cartographer/evidence.test.ts
npm run typecheck
```

Expected: all Task 3 tests PASS.

- [ ] **Step 7: Review checkpoint**

Confirm `decoder.ts` is the only production layer that accepts raw `unknown` Cartographer JSON. No commit/push.

---

### Task 4: Project one explicit Cartographer slice into evidence-addressable BehaviorFacts

**Files:**
- Create: `src/providers/cartographer/projector.ts`
- Test: `tests/unit/providers/cartographer/projector.test.ts`

**Interfaces:**
- Consumes `CartographerModelView` and normalized evidence.
- Produces `projectCartographerSlice(model: CartographerModelView, sliceId: string): CartographerProjectionResult`.

The projector must merge `model.decodeDiagnostics.warnings` into result diagnostics and preserve decoder `ignoredFields` as warnings; projector-specific `ignoredKinds` and `ignoredRelations` remain separate arrays.

- [ ] **Step 1: Write direct-mapping RED tests**

Assert:

```ts
const result = projectCartographerSlice(model, "slice:main");
assert.equal(result.behaviorSlice.owner, "LEGORA");
assert.equal(result.behaviorSlice.subject, "Main flow");
assert.deepEqual(result.behaviorSlice.participants.map(x => x.text), ["request"]);
assert.deepEqual(result.behaviorSlice.states.map(x => x.text), ["expired"]);
assert.deepEqual(result.behaviorSlice.events.map(x => x.text), ["request arrives"]);
```

For a flow fact, assert exact traceability:

```ts
assert.deepEqual(flow.providerRefs, ["slice:main", "capability:refresh"]);
assert.ok(flow.requiredEvidenceClaimIds.includes("slice:main#ev:slice"));
assert.ok(flow.requiredEvidenceClaimIds.includes("capability:refresh#ev:cap"));
```

- [ ] **Step 2: Verify RED**

```powershell
node --import tsx --test tests/unit/providers/cartographer/projector.test.ts
```

- [ ] **Step 3: Implement only direct mapping**

```text
slice.name -> subject
actor step -> participants
state step -> states
event step -> events
every step.label -> flows
```

Evidence binding is deterministic, never semantic-similarity based.

- [ ] **Step 4: Run direct-mapping GREEN**

Run only direct mapping / flow traceability tests and confirm PASS.

- [ ] **Step 5: Write one-hop semantic RED tests**

Add:

```ts
test("invariant guards step becomes constraint with invariant relationship and step refs");
test("step triggers side-effect becomes effect");
test("step triggers failure-point becomes failure");
test("reverse stored endpoint direction is accepted only for same explicit relation");
test("two-hop semantic neighbor is not imported");
test("arbitrary prose is not promoted into typed fact");
test("missing slice fails with CARTOGRAPHER_SLICE_NOT_FOUND");
test("every requiredEvidenceClaimId resolves to result.evidenceClaims");
```

Constraint provider refs use semantic order regardless of stored endpoint direction:

```ts
assert.deepEqual(constraint.providerRefs, [
  "invariant:confirmed-only",
  "relationship:guards",
  "capability:refresh",
]);
```

- [ ] **Step 6: Verify semantic RED**

Expected: invariant/effect/failure tests FAIL because direct mapping alone is insufficient.

- [ ] **Step 7: Implement exactly one-hop allowlisted mapping**

Allowed only:

```text
invariant <guards> step entity -> constraints
step entity <triggers> side-effect -> effects
step entity <triggers> failure-point -> failures
```

No recursive traversal, boundary-neighbor import, or prose inference. Populate diagnostics for ignored one-hop kinds/relations without changing behavior facts.

- [ ] **Step 8: Run projector GREEN and typecheck**

```powershell
node --import tsx --test tests/unit/providers/cartographer/projector.test.ts
npm run typecheck
```

- [ ] **Step 9: Review checkpoint**

Verify no Cartographer-native type escapes in `CartographerProjectionResult`. No commit/push.

---

### Task 5: Enforce the provider-neutral executable evidence gate

**Files:**
- Create: `src/core/executable-evidence-gate.ts`
- Test: `tests/unit/core/executable-evidence-gate.test.ts`

**Interfaces:**

```ts
interface ExecutableFactDecision {
  eligible: boolean;
  reasons: Array<
    | "NO_REQUIRED_EVIDENCE"
    | "EVIDENCE_CLAIM_MISSING"
    | "EVIDENCE_NOT_CONFIRMED"
    | "VALID_SOURCE_ANCHOR_MISSING"
  >;
}

function evaluateExecutableFact(
  fact: BehaviorFact,
  evidenceClaims: readonly EvidenceClaim[],
): ExecutableFactDecision;
```

Provider-ref resolution is guaranteed by decoder/projector before a production fact is returned. The executable gate still denies direct caller-supplied facts with broken evidence references.

- [ ] **Step 1: Write all executable-gate RED tests**

Cover:

```ts
test("fully confirmed fact with valid anchors is eligible");
test("fact with no required evidence is ineligible");
test("INFERRED required claim is ineligible");
test("UNKNOWN required claim is ineligible");
test("mixed claims with one weaker claim are ineligible");
test("missing required claim id is ineligible");
test("CONFIRMED claim without valid source anchor is ineligible");
```

The eligible case must require all claims, not merely one.

- [ ] **Step 2: Verify RED**

```powershell
node --import tsx --test tests/unit/core/executable-evidence-gate.test.ts
```

- [ ] **Step 3: Implement minimal all-required-claims gate**

```text
if requiredEvidenceClaimIds empty -> deny
for each required ID:
  missing -> deny
  confidence != CONFIRMED -> deny
  no valid source anchor -> deny
eligible only when no reason remains
```

Deduplicate reasons deterministically.

- [ ] **Step 4: Run GREEN plus full unit suite**

```powershell
npm test
npm run typecheck
```

- [ ] **Step 5: Review checkpoint**

Confirm this core gate has no Cartographer import. No commit/push.

---

### Task 6: Add the production adapter facade and deterministic end-to-end test

**Files:**
- Create: `src/providers/cartographer/adapter.ts`
- Test: `tests/unit/providers/cartographer/adapter.test.ts`

**Interfaces:**

```ts
interface ProjectCartographerRepositorySliceInput {
  repositoryRoot: string;
  sliceId: string;
}

async function projectCartographerRepositorySlice(
  input: ProjectCartographerRepositorySliceInput,
): Promise<CartographerProjectionResult>;
```

- [ ] **Step 1: Write RED facade test**

Create a temp repository, copy the deterministic fixture to `.cartographer/model.json` after replacing its `rootPath` with the temp root, then call the facade.

Assert:

```ts
assert.equal(result.provider.kind, "CARTOGRAPHER");
assert.equal(result.provider.decoderContract, "cartographer-decoder-v1");
assert.equal(result.provider.sliceId, "slice:main");
assert.equal(result.behaviorSlice.owner, "LEGORA");
assert.ok(result.behaviorSlice.flows.length > 0);
assert.ok(result.behaviorSlice.flows.every(f => f.providerRefs.length > 0));
assert.ok(result.behaviorSlice.flows.every(f => f.requiredEvidenceClaimIds.every(
  id => result.evidenceClaims.some(claim => claim.id === id),
)));
```

- [ ] **Step 2: Verify RED**

```powershell
node --import tsx --test tests/unit/providers/cartographer/adapter.test.ts
```

- [ ] **Step 3: Implement facade with no new semantics**

Exactly:

```text
readCartographerDocument(repositoryRoot)
-> decodeCartographerModel(document, repositoryRoot)
-> projectCartographerSlice(model, sliceId)
```

No automatic slice selection and no Cartographer MCP writes.

- [ ] **Step 4: Run deterministic verification**

```powershell
npm test
npm run typecheck
```

Required: PASS without a real `.cartographer/model.json` and without running Cartographer.

- [ ] **Step 5: Review checkpoint**

Verify tests mutate only temp repositories. No commit/push.

---

### Task 7: Verify compatibility against the actual Cartographer-generated Legora model

**Files:**
- Create: `tests/integration/providers/cartographer/real-model.test.ts`
- No production source change unless a real observed incompatibility first becomes a deterministic regression fixture/test.

**Interfaces:**
- Consumes `projectCartographerRepositorySlice(...)`.
- Verifies current `.cartographer/model.json`.

- [ ] **Step 1: Write explicit real-model integration test**

The integration script must fail rather than skip when `.cartographer/model.json` is absent, because this is an explicit compatibility gate.

Use known generated slice `slice:Lock enabled refresh deduplication` and assert its presence before projection.

Then assert:

```ts
assert.equal(result.behaviorSlice.owner, "LEGORA");
assert.equal(result.behaviorSlice.subject, "Lock enabled refresh deduplication");
assert.ok(result.behaviorSlice.participants.some(f => f.text === "expired request"));
assert.ok(result.behaviorSlice.flows.some(f => /in-flight refresh/i.test(f.text)));
assert.ok(result.evidenceClaims.length > 0);
assert.ok(result.evidenceClaims.every(c =>
  ["CONFIRMED", "INFERRED", "UNKNOWN"].includes(c.confidence)
));
```

Also verify every `requiredEvidenceClaimId` from every fact resolves to `result.evidenceClaims`.

- [ ] **Step 2: Run integration assessment**

```powershell
npm run test:integration:cartographer-real
```

If it fails because production code does not match the actual observed schema, do not loosen the decoder ad hoc. First add the observed case to the deterministic fixture, add a failing regression test to the responsible unit suite, then make the minimal production fix and rerun both unit and integration tests.

- [ ] **Step 3: Run final full verification**

```powershell
npm test
npm run typecheck
npm run test:integration:cartographer-real
git -c safe.directory=D:/Projects/Legora status --short
git -c safe.directory=D:/Projects/Legora diff -- . ':!.cartographer/**' ':!.chatgpt2codex/**'
```

Required result:

```text
unit tests: 0 failures
TypeScript: exit 0
real Cartographer integration: PASS
.cartographer runtime data: not staged/committed
production code: outside ignored spike directory
```

- [ ] **Step 4: Acceptance-criteria audit**

Check all approved criteria explicitly:

1. raw storage isolated behind decoder;
2. downstream contracts provider-neutral;
3. BehaviorSlice ephemeral/Legora-owned;
4. every BehaviorFact traceable;
5. confidence never strengthened;
6. only explicit slice + one-hop allowlist;
7. missing categories remain empty;
8. executable facts require all CONFIRMED claims;
9. unknown additions degrade safely;
10. structural ambiguity fails closed;
11. deterministic unit tests require no Cartographer runtime;
12. actual generated model integration passes.

Any unmet criterion is a blocker, not a completion claim.

- [ ] **Step 5: Final review checkpoint**

Present test counts, integration result, changed files, and blockers to the user. Do not commit or push unless separately approved.

---

## Execution Order and Gates

```text
Task 1  Canonical contracts
   ↓
Task 2  Provider source/errors
   ↓
Task 3  Decoder + evidence normalization
   ↓
Task 4  Explicit one-hop projector
   ↓
Task 5  Executable evidence gate
   ↓
Task 6  Public adapter facade + deterministic E2E
   ↓
Task 7  Actual .cartographer/model.json compatibility
```

Do not start downstream Prediction / Microworld / Transfer Verify integration until Task 7 and the acceptance-criteria audit pass.

## Execution Mode

Only **Inline Execution** is approved for this project. Use `superpowers:executing-plans`, execute in bounded batches with verification checkpoints, and never dispatch subagents.
