# Production Causal Scenario / Prediction / Microworld / Transfer Verify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Subagent-driven execution is intentionally disabled for this project. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect production evidence-addressable `BehaviorSlice` outputs to a finite, evidence-bounded causal learning flow: validated scenarios, prediction-before-reveal, exact-case Microworld execution, and transfer verification.

**Architecture:** Keep all new learning/execution logic provider-neutral under `src/core/`. Upgrade `BehaviorFact` with a deterministic Legora-owned ID, validate educational scenario drafts only against executable production facts, project only validated finite cases into Microworld execution, and construct prediction/transfer choices only from observations already present in validated cases. Cartographer remains only an upstream evidence provider.

**Tech Stack:** Node.js, TypeScript, ESM, built-in `node:test`, `tsx`, `tsc --noEmit`, Node `crypto` for deterministic fact IDs. No new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-08-21-causal-scenario-microworld-production-design.md`

## Global Constraints

- No subagents or parallel-agent execution.
- Do not import production code from `.chatgpt2codex/spikes/`; spikes are evidence only.
- Do not add an arbitrary-input simulation API. Production Microworld v1 executes exact validated `caseId` values only.
- Every executable scenario statement must reference a real production `BehaviorFact` and pass `evaluateExecutableFact(...)`.
- `INFERRED`, `UNKNOWN`, missing-claim, or invalid-anchor facts are not executable.
- Prediction choices may contain only evidence-backed observation text from validated cases; never fabricate a distractor.
- User-facing `PredictionPrompt` must not contain `expectedChoiceId`; the answer key exists only in internal `PredictionChallenge`.
- Transfer Verify uses a different evidenced case and never implies general mastery.
- `BehaviorSlice`, `ValidatedCausalScenarioSet`, and `MicroworldProjection` remain ephemeral; no persistent knowledge store is added.
- Cartographer-native raw model types remain inside `src/providers/cartographer/`.
- `.cartographer/` and `.chatgpt2codex/` remain ignored runtime/spike data.
- Do not modify global Git configuration; use command-local `git -c safe.directory=D:/Projects/Legora ...` if Git inspection is needed.
- Do not commit or push unless the user explicitly approves that action.

---

## File Structure

```text
src/core/contracts.ts
  add BehaviorFact.id and shared BehaviorFactCategory

src/core/fact-id.ts
  deterministic provider-neutral Legora fact-ID derivation

src/core/causal-scenario.ts
  scenario draft/validated contracts and deterministic validator

src/core/causal-scenario-errors.ts
  typed fail-closed scenario-validation failures

src/core/microworld.ts
  finite validated-case projection and exact case execution

src/core/prediction.ts
  grounded choice construction, prompt/challenge separation, choice-ID grading

src/core/transfer-verify.ts
  distinct evidenced-case transfer challenge

src/core/causal-understanding-flow.ts
  least-sufficient intervention availability for a validated scenario set

src/providers/cartographer/projector.ts
  assign deterministic Legora-owned BehaviorFact IDs during projection

tests/unit/core/fact-id.test.ts
tests/unit/core/causal-scenario.test.ts
tests/unit/core/microworld.test.ts
tests/unit/core/prediction.test.ts
tests/unit/core/transfer-verify.test.ts
tests/unit/core/causal-understanding-flow.test.ts

tests/unit/providers/cartographer/projector.test.ts
  regression coverage for deterministic fact IDs

tests/helpers/causal-fixtures.ts
  provider-neutral executable projection fixtures shared by core tests

tests/integration/core/causal-real-model.test.ts
  actual .cartographer/model.json -> adapter -> scenarios -> prediction -> Microworld -> transfer

package.json
  add explicit causal real-model integration script
```

This phase deliberately does **not** productionize the HTML renderer or UnderstandingAsset persistence. Those are the next gate after the core learning path is proven.

---

### Task 1: Migrate BehaviorFact to deterministic Legora-owned IDs

**Files:**
- Modify: `src/core/contracts.ts`
- Create: `src/core/fact-id.ts`
- Modify: `src/providers/cartographer/projector.ts`
- Create: `tests/unit/core/fact-id.test.ts`
- Modify: `tests/unit/core/contracts.test.ts`
- Modify: `tests/unit/core/executable-evidence-gate.test.ts`
- Modify: `tests/unit/providers/cartographer/projector.test.ts`
- Existing regression: `tests/integration/providers/cartographer/real-model.test.ts`

**Interfaces:**
- Produces:

```ts
export type BehaviorFactCategory =
  | "participants"
  | "states"
  | "events"
  | "flows"
  | "constraints"
  | "effects"
  | "failures";

export interface BehaviorFact {
  id: string;
  text: string;
  providerRefs: string[];
  requiredEvidenceClaimIds: string[];
}

export function createBehaviorFactId(
  category: BehaviorFactCategory,
  providerRefs: readonly string[],
): string;
```

ID format is exactly:

```text
fact:<category>:<64-character lowercase sha256 hex>
```

Digest input is `JSON.stringify({ category, providerRefs: [...providerRefs] })`. Human-facing text and array indexes are never part of identity.

- [ ] **Step 1: Write fact-ID RED tests**

Create `tests/unit/core/fact-id.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createBehaviorFactId } from "../../../src/core/fact-id.ts";

test("same category and provider refs produce the same stable fact id", () => {
  const first = createBehaviorFactId("flows", ["slice:main", "capability:refresh"]);
  const second = createBehaviorFactId("flows", ["slice:main", "capability:refresh"]);
  assert.equal(first, second);
  assert.match(first, /^fact:flows:[a-f0-9]{64}$/);
});

test("different categories cannot collide for the same provider refs", () => {
  const refs = ["entity:request"];
  assert.notEqual(
    createBehaviorFactId("participants", refs),
    createBehaviorFactId("events", refs),
  );
});

test("provider refs participate in identity", () => {
  assert.notEqual(
    createBehaviorFactId("flows", ["slice:a", "entity:x"]),
    createBehaviorFactId("flows", ["slice:b", "entity:x"]),
  );
});
```

Update `tests/unit/core/contracts.test.ts` so every constructed `BehaviorFact` includes an `id` and asserts it is present.

Update the `fact(...)` helper in `tests/unit/core/executable-evidence-gate.test.ts` so its existing typed fixture also supplies a stable ID, for example:

```ts
return {
  id: createBehaviorFactId("flows", ["provider:1"]),
  text: "candidate",
  providerRefs: ["provider:1"],
  requiredEvidenceClaimIds: ids,
};
```

Import `createBehaviorFactId` from `src/core/fact-id.ts`. Do not weaken `BehaviorFact.id` to optional merely to preserve old fixtures.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
node --import tsx --test tests/unit/core/fact-id.test.ts tests/unit/core/contracts.test.ts
```

Expected: FAIL because `src/core/fact-id.ts` does not exist and `BehaviorFact.id` is not yet required by the contract.

- [ ] **Step 3: Implement the minimal provider-neutral ID helper**

Create `src/core/fact-id.ts`:

```ts
import { createHash } from "node:crypto";
import type { BehaviorFactCategory } from "./contracts.ts";

export function createBehaviorFactId(
  category: BehaviorFactCategory,
  providerRefs: readonly string[],
): string {
  const canonical = JSON.stringify({ category, providerRefs: [...providerRefs] });
  const digest = createHash("sha256").update(canonical, "utf8").digest("hex");
  return `fact:${category}:${digest}`;
}
```

Modify `src/core/contracts.ts` to add `BehaviorFactCategory` and required `BehaviorFact.id` exactly as defined above.

- [ ] **Step 4: Add projector ID regression tests before changing projector code**

In `tests/unit/providers/cartographer/projector.test.ts`, add:

```ts
test("projected facts receive deterministic Legora-owned ids", async () => {
  const first = projectCartographerSlice(await model(), "slice:main");
  const second = projectCartographerSlice(await model(), "slice:main");

  assert.deepEqual(
    first.behaviorSlice.flows.map((fact) => fact.id),
    second.behaviorSlice.flows.map((fact) => fact.id),
  );
  assert.ok(first.behaviorSlice.flows.every((fact) => /^fact:flows:[a-f0-9]{64}$/.test(fact.id)));
});

test("fact identity does not depend on human-facing text", async () => {
  const decoded = await model();
  const before = projectCartographerSlice(decoded, "slice:main");
  const entity = decoded.entities.find((item) => item.id === "capability:refresh");
  assert.ok(entity);
  const originalId = before.behaviorSlice.flows.find((fact) => fact.text === "Refresh token")!.id;

  const step = decoded.slices.find((item) => item.id === "slice:main")!.steps.find(
    (item) => item.entityId === "capability:refresh",
  )!;
  step.label = "Human wording changed only";

  const after = projectCartographerSlice(decoded, "slice:main");
  const changed = after.behaviorSlice.flows.find((fact) => fact.text === "Human wording changed only")!;
  assert.equal(changed.id, originalId);
});
```

Run the projector test and verify RED because the projector still omits IDs.

- [ ] **Step 5: Update projector fact construction**

In `src/providers/cartographer/projector.ts`:

```ts
import { createBehaviorFactId } from "../../core/fact-id.ts";
import type { BehaviorFactCategory } from "../../core/contracts.ts";
```

Change direct/semantic fact helpers so category is explicit. Every fact is created through this shape:

```ts
function makeFact(
  category: BehaviorFactCategory,
  text: string,
  providerRefs: string[],
  requiredEvidenceClaimIds: string[],
): BehaviorFact {
  return {
    id: createBehaviorFactId(category, providerRefs),
    text,
    providerRefs,
    requiredEvidenceClaimIds,
  };
}
```

Required mappings:

```text
actor direct fact -> participants
state direct fact -> states
event direct fact -> events
slice step label -> flows
invariant guards step -> constraints
step triggers side-effect -> effects
step triggers failure-point -> failures
```

Replace `appendUniqueFact` identity comparison with `candidate.id === fact.id`.

- [ ] **Step 6: Run Task 1 GREEN and full adapter regression**

Run:

```powershell
npm test
npm run typecheck
npm run test:integration:cartographer-real
```

Required: all existing adapter tests remain green, and the actual Cartographer-generated model still projects successfully.

- [ ] **Step 7: Review checkpoint**

Verify:

```text
BehaviorFact.id is required everywhere
IDs do not depend on text or array index
core fact-id helper imports no Cartographer types
no spike import exists
no commit/push performed
```

---

### Task 2: Add provider-neutral CausalScenario contracts and deterministic validator

**Files:**
- Create: `src/core/causal-scenario-errors.ts`
- Create: `src/core/causal-scenario.ts`
- Create: `tests/helpers/causal-fixtures.ts`
- Create: `tests/unit/core/causal-scenario.test.ts`

**Interfaces:**

```ts
export interface BehaviorFactRef {
  sliceRef: string;
  factId: string;
}

export interface CausalScenarioCaseDraft {
  id: string;
  label: string;
  conditionFactRefs: BehaviorFactRef[];
  observationFactRefs: BehaviorFactRef[];
}

export interface CausalScenarioDraft {
  id: string;
  subject: string;
  learningGoal: string;
  cases: CausalScenarioCaseDraft[];
}

export interface ScenarioInputProjection {
  sliceRef: string;
  behaviorSlice: BehaviorSlice;
  evidenceClaims: EvidenceClaim[];
}

export interface ValidatedScenarioStatement {
  factRef: BehaviorFactRef;
  text: string;
  evidenceClaimIds: string[];
}

export interface ValidatedCausalScenarioCase {
  id: string;
  label: string;
  conditions: ValidatedScenarioStatement[];
  observations: ValidatedScenarioStatement[];
  evidenceClaimIds: string[];
}

export interface ValidatedCausalScenarioSet {
  schemaVersion: "causal-scenario-v1";
  id: string;
  subject: string;
  learningGoal: string;
  cases: ValidatedCausalScenarioCase[];
}

export function validateCausalScenarioDraft(
  draft: CausalScenarioDraft,
  projections: readonly ScenarioInputProjection[],
): ValidatedCausalScenarioSet;
```

`ScenarioInputProjection` is intentionally provider-neutral. Cartographer integration later adapts `CartographerProjectionResult` into this tiny boundary without importing Cartographer types into core.

Typed error:

```ts
export type CausalScenarioErrorCode =
  | "SCENARIO_SLICE_NOT_FOUND"
  | "SCENARIO_FACT_NOT_FOUND"
  | "SCENARIO_FACT_AMBIGUOUS"
  | "SCENARIO_FACT_NOT_EXECUTABLE"
  | "SCENARIO_CONDITION_REQUIRED"
  | "SCENARIO_OBSERVATION_REQUIRED"
  | "SCENARIO_DUPLICATE_CASE_ID"
  | "SCENARIO_NO_VALID_CASES";

export class CausalScenarioError extends Error {
  constructor(public readonly code: CausalScenarioErrorCode, message: string) {
    super(message);
    this.name = "CausalScenarioError";
  }
}
```

- [ ] **Step 1: Create a reusable provider-neutral executable fixture**

Create `tests/helpers/causal-fixtures.ts` with two projections and confirmed evidence. Use production types and `createBehaviorFactId` rather than Cartographer types.

Required exported helper:

```ts
export function createCausalFixture(): {
  projections: ScenarioInputProjection[];
  draft: CausalScenarioDraft;
  refs: {
    lockOnCondition: BehaviorFactRef;
    lockOnObservation: BehaviorFactRef;
    lockOffCondition: BehaviorFactRef;
    lockOffObservation: BehaviorFactRef;
  };
};
```

Use these exact evidenced facts:

```text
sliceRef: lock-on
condition: "Concurrent handlers run with lockEnabled true"
observation: "Requests share one in-flight refresh promise"

sliceRef: lock-off
condition: "Concurrent handlers run with lockEnabled false"
observation: "Each request invokes refreshToken directly"
```

Each fact gets one `CONFIRMED` claim with a valid anchor such as `fixture/refresh.ts:10`, `:20`, `:30`, `:40`.

- [ ] **Step 2: Write validator RED tests**

Create `tests/unit/core/causal-scenario.test.ts` covering:

```ts
test("valid referenced executable facts produce a finite validated scenario set");
test("validated statement text is copied from BehaviorFact, not draft prose");
test("missing slice fails SCENARIO_SLICE_NOT_FOUND");
test("missing fact fails SCENARIO_FACT_NOT_FOUND");
test("duplicate matching fact id inside one slice fails SCENARIO_FACT_AMBIGUOUS");
test("INFERRED referenced fact fails SCENARIO_FACT_NOT_EXECUTABLE");
test("UNKNOWN referenced fact fails SCENARIO_FACT_NOT_EXECUTABLE");
test("CONFIRMED claim without a valid source anchor fails SCENARIO_FACT_NOT_EXECUTABLE");
test("empty conditions fail SCENARIO_CONDITION_REQUIRED");
test("empty observations fail SCENARIO_OBSERVATION_REQUIRED");
test("duplicate case ids fail SCENARIO_DUPLICATE_CASE_ID");
test("empty case list fails SCENARIO_NO_VALID_CASES");
test("duplicate fact refs inside one case are deterministically deduplicated");
```

The successful assertion must prove evidence aggregation:

```ts
assert.equal(validated.schemaVersion, "causal-scenario-v1");
assert.equal(validated.cases.length, 2);
assert.deepEqual(validated.cases[0]!.conditions.map((item) => item.text), [
  "Concurrent handlers run with lockEnabled true",
]);
assert.deepEqual(validated.cases[0]!.observations.map((item) => item.text), [
  "Requests share one in-flight refresh promise",
]);
assert.ok(validated.cases[0]!.evidenceClaimIds.length >= 2);
```

- [ ] **Step 3: Run validator tests and verify RED**

```powershell
node --import tsx --test tests/unit/core/causal-scenario.test.ts
```

Expected: FAIL because scenario files do not exist.

- [ ] **Step 4: Implement deterministic fact resolution and fail-closed validation**

In `src/core/causal-scenario.ts`, flatten facts by category only for lookup; do not infer meaning from text:

```ts
function allFacts(slice: BehaviorSlice): BehaviorFact[] {
  return [
    ...slice.participants,
    ...slice.states,
    ...slice.events,
    ...slice.flows,
    ...slice.constraints,
    ...slice.effects,
    ...slice.failures,
  ];
}
```

Resolution algorithm for each `BehaviorFactRef`:

```text
find projection by exact sliceRef
  0 -> SCENARIO_SLICE_NOT_FOUND
find facts in that projection with exact fact.id
  0 -> SCENARIO_FACT_NOT_FOUND
  >1 -> SCENARIO_FACT_AMBIGUOUS
run evaluateExecutableFact(fact, projection.evidenceClaims)
  eligible=false -> SCENARIO_FACT_NOT_EXECUTABLE
copy fact.text and fact.requiredEvidenceClaimIds into ValidatedScenarioStatement
```

Deduplicate repeated refs by exact key `${sliceRef}\u0000${factId}` while preserving first occurrence order.

Case validation order:

```text
reject duplicate case IDs before resolving facts
reject empty draft.cases -> SCENARIO_NO_VALID_CASES
for each case:
  empty conditionFactRefs -> SCENARIO_CONDITION_REQUIRED
  empty observationFactRefs -> SCENARIO_OBSERVATION_REQUIRED
  resolve/dedupe conditions
  resolve/dedupe observations
  evidenceClaimIds = unique union of statement evidence IDs
return causal-scenario-v1
```

No validation path may substitute neighboring facts.

- [ ] **Step 5: Run Task 2 GREEN and typecheck**

```powershell
node --import tsx --test tests/unit/core/causal-scenario.test.ts
npm run typecheck
```

- [ ] **Step 6: Review checkpoint**

Verify `src/core/causal-scenario.ts` imports only provider-neutral core contracts and `evaluateExecutableFact`; it must not import from `src/providers/cartographer/`.

---

### Task 3: Build the finite evidenced Microworld projection and exact-case runner

**Files:**
- Create: `src/core/microworld.ts`
- Create: `tests/unit/core/microworld.test.ts`

**Interfaces:**

```ts
export interface MicroworldProjection {
  projectionVersion: "finite-evidenced-microworld-v1";
  scenarioSetId: string;
  subject: string;
  learningGoal: string;
  fidelity: "F2_CAUSAL";
  supportedCases: Array<{
    caseId: string;
    label: string;
    conditions: ValidatedScenarioStatement[];
    observations: ValidatedScenarioStatement[];
    evidenceClaimIds: string[];
  }>;
}

export interface MicroworldRunResult {
  caseId: string;
  observations: ValidatedScenarioStatement[];
  evidenceClaimIds: string[];
}

export class MicroworldError extends Error {
  constructor(
    public readonly code: "MICROWORLD_CASE_NOT_EVIDENCED",
    message: string,
  ) {
    super(message);
    this.name = "MicroworldError";
  }
}

export function buildMicroworldProjection(
  scenarioSet: ValidatedCausalScenarioSet,
): MicroworldProjection;

export function runMicroworldCase(
  projection: MicroworldProjection,
  caseId: string,
): MicroworldRunResult;
```

- [ ] **Step 1: Write all finite-Microworld RED tests**

Create `tests/unit/core/microworld.test.ts`:

```ts
test("validated scenario cases become the only supported Microworld cases");
test("running a known case reveals only that case observations and evidence");
test("unknown case id fails MICROWORLD_CASE_NOT_EVIDENCED");
test("projection exposes no arbitrary input-control execution surface");
```

For the public-contract test, assert exact top-level keys:

```ts
assert.deepEqual(Object.keys(projection).sort(), [
  "fidelity",
  "learningGoal",
  "projectionVersion",
  "scenarioSetId",
  "subject",
  "supportedCases",
]);
```

For exact execution:

```ts
const result = runMicroworldCase(projection, "lock-on");
assert.equal(result.caseId, "lock-on");
assert.deepEqual(result.observations.map((item) => item.text), [
  "Requests share one in-flight refresh promise",
]);
assert.ok(!result.observations.some((item) => /directly/.test(item.text)));
```

- [ ] **Step 2: Verify RED**

```powershell
node --import tsx --test tests/unit/core/microworld.test.ts
```

- [ ] **Step 3: Implement projection as a copy of validated finite cases**

`buildMicroworldProjection` performs no new interpretation:

```ts
return {
  projectionVersion: "finite-evidenced-microworld-v1",
  scenarioSetId: scenarioSet.id,
  subject: scenarioSet.subject,
  learningGoal: scenarioSet.learningGoal,
  fidelity: "F2_CAUSAL",
  supportedCases: scenarioSet.cases.map((item) => ({
    caseId: item.id,
    label: item.label,
    conditions: item.conditions.map((entry) => ({ ...entry, factRef: { ...entry.factRef }, evidenceClaimIds: [...entry.evidenceClaimIds] })),
    observations: item.observations.map((entry) => ({ ...entry, factRef: { ...entry.factRef }, evidenceClaimIds: [...entry.evidenceClaimIds] })),
    evidenceClaimIds: [...item.evidenceClaimIds],
  })),
};
```

`runMicroworldCase` uses exact `caseId` lookup only. It returns cloned observations/evidence and throws `MicroworldError("MICROWORLD_CASE_NOT_EVIDENCED", ...)` when not found.

- [ ] **Step 4: Run Task 3 GREEN plus scenario regression**

```powershell
node --import tsx --test tests/unit/core/causal-scenario.test.ts tests/unit/core/microworld.test.ts
npm run typecheck
```

- [ ] **Step 5: Review checkpoint**

Search `src/core/microworld.ts` for APIs accepting arbitrary condition objects. There must be none. The only execution selector is `caseId`.

---

### Task 4: Add evidence-backed Prediction challenge construction and choice-ID grading

**Files:**
- Create: `src/core/prediction.ts`
- Create: `tests/unit/core/prediction.test.ts`

**Interfaces:**

```ts
export interface PredictionChoice {
  id: string;
  label: string;
}

export interface PredictionPrompt {
  id: string;
  scenarioSetId: string;
  caseId: string;
  status: "PENDING_USER_RESPONSE";
  question: string;
  choices: PredictionChoice[];
  evidenceClaimIds: string[];
}

export interface PredictionChallenge {
  prompt: PredictionPrompt;
  expectedChoiceId: string;
}

export interface PredictionResult {
  result: "CORRECT" | "INCORRECT";
  expectedChoiceId: string;
  receivedChoiceId: string;
}

export class PredictionError extends Error {
  constructor(
    public readonly code: "PREDICTION_CASE_NOT_FOUND" | "PREDICTION_CHOICE_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "PredictionError";
  }
}

export function buildPredictionChallenge(
  scenarioSet: ValidatedCausalScenarioSet,
  caseId: string,
): PredictionChallenge | null;

export function evaluatePrediction(
  challenge: PredictionChallenge,
  receivedChoiceId: string,
): PredictionResult;
```

`null` means there are fewer than two distinct evidence-backed observation labels, so a machine-graded prediction must not be fabricated.

- [ ] **Step 1: Write prediction RED tests**

Create `tests/unit/core/prediction.test.ts` covering:

```ts
test("prompt contains conditions but does not reveal target observations or answer key");
test("expected choice label comes from the target evidenced observation");
test("distractor labels come only from other validated case observations");
test("user-facing prompt has no expectedChoiceId property");
test("correct and incorrect answers are graded by choice id");
test("unknown choice id fails PREDICTION_CHOICE_NOT_FOUND");
test("unknown target case fails PREDICTION_CASE_NOT_FOUND");
test("one distinct evidenced observation returns null instead of fabricating a distractor");
```

Required answer-key leakage assertion:

```ts
const challenge = buildPredictionChallenge(validated, "lock-on")!;
assert.equal("expectedChoiceId" in challenge.prompt, false);
assert.ok(challenge.expectedChoiceId.length > 0);
assert.ok(!challenge.prompt.question.includes("Requests share one in-flight refresh promise"));
```

Required grounded-choice assertion:

```ts
assert.deepEqual(
  new Set(challenge.prompt.choices.map((choice) => choice.label)),
  new Set([
    "Requests share one in-flight refresh promise",
    "Each request invokes refreshToken directly",
  ]),
);
```

- [ ] **Step 2: Verify RED**

```powershell
node --import tsx --test tests/unit/core/prediction.test.ts
```

- [ ] **Step 3: Implement deterministic grounded choices**

For each case define its observation label as exact validated text joined with `" + "`:

```ts
function observationLabel(item: ValidatedCausalScenarioCase): string {
  return item.observations.map((statement) => statement.text).join(" + ");
}
```

Choice construction algorithm:

```text
find target case by exact caseId, else PREDICTION_CASE_NOT_FOUND
candidate order = target case first, then remaining scenarioSet.cases in existing order
for each case:
  label = observationLabel(case)
  dedupe by exact label, preserving first occurrence
  choice id = `choice:${case.id}`
if distinct choice count < 2 -> return null
expectedChoiceId = choice generated from target case
question = `Predict the outcome when: ${target.conditions.map(text).join("; ")}`
prompt evidenceClaimIds = unique union of target condition evidence IDs only
```

This ordering guarantees a duplicate observation cannot remove the target answer key in favor of another case.

Do not include target observation text or `expectedChoiceId` in `PredictionPrompt`.

`evaluatePrediction` first verifies that `receivedChoiceId` is present in `challenge.prompt.choices`; otherwise throw `PREDICTION_CHOICE_NOT_FOUND`. Then return only `CORRECT`/`INCORRECT`, expected ID, and received ID. Do not add mastery status.

- [ ] **Step 4: Run Task 4 GREEN**

```powershell
node --import tsx --test tests/unit/core/prediction.test.ts
npm run typecheck
```

- [ ] **Step 5: Review checkpoint**

Verify renderer-safe boundary by searching `PredictionPrompt` construction: `expectedChoiceId` must only appear in the enclosing `PredictionChallenge`, never in `prompt`.

---

### Task 5: Add Transfer Verify over a different evidenced case

**Files:**
- Create: `src/core/transfer-verify.ts`
- Create: `tests/unit/core/transfer-verify.test.ts`

**Interfaces:**

```ts
export interface TransferVerification {
  mode: "PREDICTION";
  status: "PENDING_USER_RESPONSE";
  sourceCaseId: string;
  transferCaseId: string;
  challenge: PredictionChallenge;
}

export class TransferVerificationError extends Error {
  constructor(
    public readonly code: "TRANSFER_CASE_NOT_EVIDENCED",
    message: string,
  ) {
    super(message);
    this.name = "TransferVerificationError";
  }
}

export function buildTransferVerification(
  scenarioSet: ValidatedCausalScenarioSet,
  sourceCaseId: string,
): TransferVerification;
```

Selection is deterministic: choose the first case in `scenarioSet.cases` whose ID differs from `sourceCaseId` and for which `buildPredictionChallenge(...)` returns a grounded challenge. If none exists, throw `TRANSFER_CASE_NOT_EVIDENCED`.

- [ ] **Step 1: Write transfer RED tests**

Create `tests/unit/core/transfer-verify.test.ts`:

```ts
test("transfer chooses a different evidenced case in scenario order");
test("transfer begins PENDING_USER_RESPONSE");
test("transfer challenge is grounded in the transfer case conditions and observations");
test("single-case scenario fails TRANSFER_CASE_NOT_EVIDENCED");
test("second case without a distinct grounded choice also fails TRANSFER_CASE_NOT_EVIDENCED");
test("prediction evaluation of transfer answer returns only correctness, never mastery");
```

Key assertions:

```ts
const transfer = buildTransferVerification(validated, "lock-on");
assert.equal(transfer.sourceCaseId, "lock-on");
assert.equal(transfer.transferCaseId, "lock-off");
assert.equal(transfer.status, "PENDING_USER_RESPONSE");
assert.equal(transfer.challenge.prompt.caseId, "lock-off");

const graded = evaluatePrediction(transfer.challenge, transfer.challenge.expectedChoiceId);
assert.equal(graded.result, "CORRECT");
assert.equal("mastery" in graded, false);
```

- [ ] **Step 2: Verify RED**

```powershell
node --import tsx --test tests/unit/core/transfer-verify.test.ts
```

- [ ] **Step 3: Implement deterministic distinct-case selection**

Algorithm:

```text
verify sourceCaseId exists; if not, TRANSFER_CASE_NOT_EVIDENCED
for each case in scenarioSet.cases in order:
  skip source case
  challenge = buildPredictionChallenge(scenarioSet, case.id)
  if challenge != null:
    return PENDING_USER_RESPONSE transfer object
throw TRANSFER_CASE_NOT_EVIDENCED
```

No unseen hypothetical is generated and no case condition is edited.

- [ ] **Step 4: Run Task 5 GREEN plus prediction regression**

```powershell
node --import tsx --test tests/unit/core/prediction.test.ts tests/unit/core/transfer-verify.test.ts
npm run typecheck
```

- [ ] **Step 5: Review checkpoint**

Confirm Transfer Verify contains no free-form NLP grading, no mastery field, and no fallback that fabricates a second case.

---

### Task 6: Encode Least Sufficient Intervention availability for causal learning

**Files:**
- Create: `src/core/causal-understanding-flow.ts`
- Create: `tests/unit/core/causal-understanding-flow.test.ts`

**Interfaces:**

```ts
export type CausalIntervention =
  | "EXPLAIN"
  | "PREDICTION"
  | "MICROWORLD"
  | "TRANSFER_VERIFY";

export interface CausalUnderstandingPlan {
  interventions: CausalIntervention[];
  predictionChallenge: PredictionChallenge | null;
  microworld: MicroworldProjection | null;
  transferVerification: TransferVerification | null;
}

export class CausalUnderstandingFlowError extends Error {
  constructor(
    public readonly code: "CAUSAL_SOURCE_CASE_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "CausalUnderstandingFlowError";
  }
}

export function buildCausalUnderstandingPlan(
  scenarioSet: ValidatedCausalScenarioSet | null,
  sourceCaseId: string | null,
): CausalUnderstandingPlan;
```

`CausalUnderstandingPlan` is an **internal orchestration object**, not a renderer-safe payload. Before the user answers the initial prediction, a renderer/user-facing transport may receive only `predictionChallenge.prompt`. It must not receive `microworld.supportedCases`, `predictionChallenge.expectedChoiceId`, or `transferVerification.challenge.expectedChoiceId`, because those objects contain unrevealed observations/answer keys.

This function expresses availability only. It does not render UI, persist an asset, or execute a case automatically.

- [ ] **Step 1: Write causal-flow RED tests**

Create `tests/unit/core/causal-understanding-flow.test.ts`:

```ts
test("no validated scenario set falls back to EXPLAIN only");
test("one evidenced case enables finite Microworld without fabricated graded prediction or transfer");
test("two distinct evidenced cases prefer PREDICTION then MICROWORLD then TRANSFER_VERIFY");
test("plan creation does not execute or reveal Microworld observations");
test("explicit unknown source case fails CAUSAL_SOURCE_CASE_NOT_FOUND");
```

Required sequences:

```ts
assert.deepEqual(noScenario.interventions, ["EXPLAIN"]);
assert.deepEqual(oneCase.interventions, ["MICROWORLD"]);
assert.deepEqual(twoCases.interventions, ["PREDICTION", "MICROWORLD", "TRANSFER_VERIFY"]);
```

For one case, `predictionChallenge === null` and `transferVerification === null`.

For two cases, the plan contains a challenge but does not call `runMicroworldCase`; no observation result object is part of `CausalUnderstandingPlan`.

- [ ] **Step 2: Verify RED**

```powershell
node --import tsx --test tests/unit/core/causal-understanding-flow.test.ts
```

- [ ] **Step 3: Implement evidence-gated availability**

Algorithm:

```text
if scenarioSet is null or scenarioSet.cases is empty:
  EXPLAIN only
else:
  microworld = buildMicroworldProjection(scenarioSet)
  choose source case:
    if sourceCaseId is supplied and absent -> CAUSAL_SOURCE_CASE_NOT_FOUND
    exact sourceCaseId if supplied and present
    first scenarioSet case only when sourceCaseId is null
  predictionChallenge = buildPredictionChallenge(set, chosenSource)
  transferVerification = try buildTransferVerification(set, chosenSource); on TRANSFER_CASE_NOT_EVIDENCED use null
  interventions:
    add PREDICTION iff predictionChallenge != null
    always add MICROWORLD
    add TRANSFER_VERIFY iff transferVerification != null
```

Do not swallow any error except the specific expected `TRANSFER_CASE_NOT_EVIDENCED` capability absence.

- [ ] **Step 4: Run Task 6 GREEN plus full unit suite**

```powershell
npm test
npm run typecheck
```

- [ ] **Step 5: Review checkpoint**

Verify the flow is provider-neutral and contains no renderer, filesystem, Cartographer, or UnderstandingAsset dependency.

---

### Task 7: Prove the full path against the actual Cartographer-generated Legora model

**Files:**
- Create: `tests/integration/core/causal-real-model.test.ts`
- Modify: `package.json`
- No production source change unless an actual incompatibility is first reproduced as a deterministic unit regression.

**Interfaces consumed:**

```ts
projectCartographerRepositorySlice(...)
validateCausalScenarioDraft(...)
buildCausalUnderstandingPlan(...)
runMicroworldCase(...)
evaluatePrediction(...)
```

Use the exact current provider slice IDs:

```text
slice:Lock enabled refresh deduplication
slice:Lock disabled concurrent refresh
```

Use the exact current flow texts:

```text
Lock ON condition:
  Concurrent handlers run with lockEnabled true
Lock ON observation:
  Requests share one in-flight refresh promise

Lock OFF condition:
  Concurrent handlers run with lockEnabled false
Lock OFF observation:
  Each request invokes refreshToken directly
```

- [ ] **Step 1: Write the actual-model integration test**

Create `tests/integration/core/causal-real-model.test.ts`.

Test flow:

```ts
const lockOn = await projectCartographerRepositorySlice({
  repositoryRoot,
  sliceId: "slice:Lock enabled refresh deduplication",
});
const lockOff = await projectCartographerRepositorySlice({
  repositoryRoot,
  sliceId: "slice:Lock disabled concurrent refresh",
});
```

Find exact facts by `text`, assert they exist, then construct the draft using their production `.id` values:

```ts
const onCondition = lockOn.behaviorSlice.flows.find(
  (fact) => fact.text === "Concurrent handlers run with lockEnabled true",
)!;
const onObservation = lockOn.behaviorSlice.flows.find(
  (fact) => fact.text === "Requests share one in-flight refresh promise",
)!;
const offCondition = lockOff.behaviorSlice.flows.find(
  (fact) => fact.text === "Concurrent handlers run with lockEnabled false",
)!;
const offObservation = lockOff.behaviorSlice.flows.find(
  (fact) => fact.text === "Each request invokes refreshToken directly",
)!;
```

Create two `ScenarioInputProjection` values with `sliceRef` equal to each provider slice ID, then validate this exact draft:

```ts
const draft: CausalScenarioDraft = {
  id: "refresh-lock-causality",
  subject: "Refresh lock concurrency behavior",
  learningGoal: "Predict how refresh locking changes concurrent expired-request behavior.",
  cases: [
    {
      id: "lock-on",
      label: "Refresh lock enabled",
      conditionFactRefs: [{
        sliceRef: lockOn.provider.sliceId,
        factId: onCondition.id,
      }],
      observationFactRefs: [{
        sliceRef: lockOn.provider.sliceId,
        factId: onObservation.id,
      }],
    },
    {
      id: "lock-off",
      label: "Refresh lock disabled",
      conditionFactRefs: [{
        sliceRef: lockOff.provider.sliceId,
        factId: offCondition.id,
      }],
      observationFactRefs: [{
        sliceRef: lockOff.provider.sliceId,
        factId: offObservation.id,
      }],
    },
  ],
};
```

Then assert the full production chain:

```ts
const validated = validateCausalScenarioDraft(draft, projections);
const plan = buildCausalUnderstandingPlan(validated, "lock-on");

assert.deepEqual(plan.interventions, ["PREDICTION", "MICROWORLD", "TRANSFER_VERIFY"]);
assert.ok(plan.predictionChallenge);
assert.ok(plan.microworld);
assert.ok(plan.transferVerification);

const prompt = plan.predictionChallenge.prompt;
assert.equal("expectedChoiceId" in prompt, false);
assert.ok(prompt.question.includes("lockEnabled true"));

const observed = runMicroworldCase(plan.microworld, "lock-on");
assert.deepEqual(observed.observations.map((item) => item.text), [
  "Requests share one in-flight refresh promise",
]);

const initialGrade = evaluatePrediction(
  plan.predictionChallenge,
  plan.predictionChallenge.expectedChoiceId,
);
assert.equal(initialGrade.result, "CORRECT");

assert.equal(plan.transferVerification.transferCaseId, "lock-off");
const transferGrade = evaluatePrediction(
  plan.transferVerification.challenge,
  plan.transferVerification.challenge.expectedChoiceId,
);
assert.equal(transferGrade.result, "CORRECT");
assert.equal("mastery" in transferGrade, false);
```

The test must call `fs.access(.cartographer/model.json)` and **fail rather than skip** if the provider model is missing.

- [ ] **Step 2: Add an explicit integration script**

Modify `package.json` scripts to include:

```json
"test:integration:causal-real": "node --import tsx --test tests/integration/core/causal-real-model.test.ts"
```

Do not remove the existing `test:integration:cartographer-real` script.

- [ ] **Step 3: Run the new integration test and diagnose any actual-model incompatibility**

```powershell
npm run test:integration:causal-real
```

If it fails because the observed provider model differs from assumptions, first convert that observed incompatibility into a deterministic unit fixture/regression test. Do not patch production code directly from the mutable live model failure.

- [ ] **Step 4: Run final fresh verification**

Run all of:

```powershell
npm test
npm run typecheck
npm run test:integration:cartographer-real
npm run test:integration:causal-real
```

Required results:

```text
all deterministic unit tests PASS
strict typecheck PASS
existing actual Cartographer adapter integration PASS
new actual causal learning integration PASS
```

- [ ] **Step 5: Repository-hygiene verification**

Run:

```powershell
git -c safe.directory=D:/Projects/Legora status --short
git -c safe.directory=D:/Projects/Legora diff --check
Get-ChildItem -Recurse src,tests | Select-String -Pattern '\.chatgpt2codex/spikes|from .*providers/cartographer.*model-view' | Select-Object Path,LineNumber,Line
```

Expected:

```text
no whitespace errors
no production import from ignored spike code
no Cartographer raw model-view import under src/core
.cartographer runtime data not staged/tracked
no commit/push performed
```

- [ ] **Step 6: Acceptance checklist**

Verify every approved spec acceptance item explicitly:

```text
1. executable statements reference real production BehaviorFacts
2. every selected fact passes executable evidence gate
3. Microworld is finite exact-case only
4. unsupported cases fail closed
5. grounded prediction precedes reveal
6. alternatives are evidence-backed validated observations
7. transfer uses a different evidenced case
8. absent second grounded case creates no fabricated transfer
9. no free-form NLP grading
10. src/core has no Cartographer-native raw model types
11. actual Cartographer-generated model passes full causal E2E
12. existing Cartographer adapter tests remain green
```

No HTML renderer or UnderstandingAsset production work begins in this plan.

---

## Execution Order Summary

```text
Task 1  Stable BehaviorFact identity
  ↓
Task 2  CausalScenario validator
  ↓
Task 3  Finite exact-case Microworld
  ↓
Task 4  Evidence-backed Prediction
  ↓
Task 5  Transfer Verify
  ↓
Task 6  Least Sufficient causal-flow availability
  ↓
Task 7  Actual Cartographer-model E2E
```

## Completion Boundary

This plan is complete only when the new actual-model integration proves:

```text
real .cartographer/model.json
→ production Cartographer adapter
→ evidence-addressable BehaviorSlices with stable fact IDs
→ validated finite CausalScenarioSet
→ prediction prompt without answer leakage
→ exact-case Microworld observation reveal
→ different evidenced-case Transfer Verify
```

The next architectural decision after this plan is whether to productionize the self-contained HTML renderer and UnderstandingAsset persistence. That decision is explicitly outside this implementation plan.
