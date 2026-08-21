# Legora — Production Causal Scenario / Prediction / Microworld / Transfer Verify Design

## 0. Document Status

- Project: **Legora**
- Date: 2026-08-21
- Status: **Approved Design**
- Scope: Production bridge from evidence-addressable `BehaviorSlice` output to finite, evidence-bounded Prediction / Microworld / Transfer Verify behavior
- Depends on:
  - `docs/superpowers/specs/2026-08-21-cartographer-adapter-production-design.md`
  - production `src/core/contracts.ts`
  - production `src/core/executable-evidence-gate.ts`
  - production Cartographer adapter under `src/providers/cartographer/`
  - earlier throwaway E2E spike under `.chatgpt2codex/spikes/existence-value-e2e/` as behavioral evidence only
- Implementation status: **Implemented and verified in production core**

---

# 1. Purpose

The production Cartographer adapter now gives Legora an evidence-addressable `BehaviorSlice`. That is sufficient to explain behavior, but it is not sufficient to execute an educational Microworld.

A Microworld needs an explicit bounded statement of:

```text
condition
→ evidenced observation
```

The earlier E2E spike hard-coded domain-specific combinations such as `requestCount=2, lockEnabled=true → refreshCount=1`. Production Legora must not preserve that hard-coding pattern or infer arbitrary combinations from prose.

This design introduces an evidence-bounded intermediate contract:

```text
BehaviorSlice(s)
      ↓
CausalScenarioDraft
      ↓ deterministic validation
ValidatedCausalScenarioSet
      ↓
Prediction
      ↓
Finite Microworld
      ↓
Transfer Verify
```

The core rule is:

> **A Microworld may reveal only scenario cases whose constituent facts already exist and are executable under Legora's evidence gate.**

---

# 2. Non-Goals

This phase does **not** introduce:

- arbitrary simulation of repository behavior;
- sandbox execution of target repository code;
- LLM-created behavior that lacks existing `BehaviorFact` references;
- semantic NLP grading of free-form answers;
- automatic Cartesian expansion of controls such as all possible `requestCount × lockEnabled` combinations;
- automatic transfer claims when no distinct evidenced scenario exists;
- a generic browser/UI framework;
- UnderstandingAsset persistence or HTML rendering productionization;
- learner history, mastery scoring, or spaced repetition;
- a second persistent repository/world-model database.

Renderer and UnderstandingAsset productionization are separate later gates.

---

# 3. Architectural Decision

Use a **draft + deterministic validator** boundary.

```text
CartographerProjectionResult(s)
        ↓
BehaviorSlice + EvidenceClaim[]
        ↓
Scenario Drafting
(human / future LLM / deterministic caller)
        ↓
CausalScenarioDraft
        ↓
CausalScenarioValidator
        ↓
ValidatedCausalScenarioSet
        ↓
Prediction Builder
        ↓
Finite Microworld Projection
        ↓
Transfer Verification
```

Why this split exists:

- scenario drafting may decide which already-evidenced facts are educationally useful together;
- scenario validation decides only whether the proposed mapping is allowed;
- validation never asks an LLM whether a claim is true;
- the Microworld never consumes an unvalidated draft.

This preserves flexibility without moving epistemic authority from repository evidence to generation logic.

---

# 4. Required BehaviorFact Identity Upgrade

The current production `BehaviorFact` is traceable but has no stable Legora-owned identity:

```ts
interface BehaviorFact {
  text: string;
  providerRefs: string[];
  requiredEvidenceClaimIds: string[];
}
```

Scenario cases need to reference facts without relying on mutable array indexes or repeated text. Production therefore adds a deterministic `id`:

```ts
interface BehaviorFact {
  id: string;
  text: string;
  providerRefs: string[];
  requiredEvidenceClaimIds: string[];
}
```

## 4.1 Fact ID rule

The provider adapter/projector produces a deterministic Legora-local fact ID from the fact category plus canonical provider references.

Conceptually:

```text
fact:<category>:<stable digest of canonical providerRefs>
```

Requirements:

- same decoded provider model + same projected fact → same fact ID;
- different fact categories do not collide;
- no array index is part of identity;
- human-facing text is not the sole identity source;
- the ID is Legora-owned even though provider refs participate in derivation.

This is a compatibility migration to the already-created production adapter. It does not change the evidence confidence rules.

---

# 5. Causal Scenario Contracts

## 5.1 Draft contract

A draft proposes how already-existing facts should be grouped for understanding.

```ts
type BehaviorFactCategory =
  | "participants"
  | "states"
  | "events"
  | "flows"
  | "constraints"
  | "effects"
  | "failures";

interface BehaviorFactRef {
  sliceRef: string;
  factId: string;
}

interface CausalScenarioCaseDraft {
  id: string;
  label: string;
  conditionFactRefs: BehaviorFactRef[];
  observationFactRefs: BehaviorFactRef[];
}

interface CausalScenarioDraft {
  id: string;
  subject: string;
  learningGoal: string;
  cases: CausalScenarioCaseDraft[];
}
```

`sliceRef` refers to a Legora input projection identity supplied to the scenario builder, not a raw array position.

The draft may choose facts, labels, and educational ordering. It may not introduce a new behavioral statement that is not represented by referenced facts.

## 5.2 Validated contract

```ts
interface ValidatedScenarioStatement {
  factRef: BehaviorFactRef;
  text: string;
  evidenceClaimIds: string[];
}

interface ValidatedCausalScenarioCase {
  id: string;
  label: string;
  conditions: ValidatedScenarioStatement[];
  observations: ValidatedScenarioStatement[];
  evidenceClaimIds: string[];
}

interface ValidatedCausalScenarioSet {
  schemaVersion: "causal-scenario-v1";
  id: string;
  subject: string;
  learningGoal: string;
  cases: ValidatedCausalScenarioCase[];
}
```

A validated case is finite. It is not a formula and does not imply behavior for neighboring unlisted conditions.

---

# 6. Scenario Validation Rules

Validation is deterministic.

For every case:

1. every `sliceRef` must resolve to an explicitly supplied production projection;
2. every `factId` must resolve to exactly one `BehaviorFact` in that slice;
3. each referenced fact must pass `evaluateExecutableFact(...)`;
4. every required evidence claim must resolve;
5. every required evidence claim must remain `CONFIRMED` with a valid source anchor;
6. `conditionFactRefs` must be non-empty;
7. `observationFactRefs` must be non-empty;
8. case IDs must be unique;
9. duplicate condition/observation fact refs inside a case are rejected or deterministically deduplicated before output;
10. at least one validated case is required to create a Microworld.

Validation copies the text from the referenced production `BehaviorFact`. Draft-provided labels may be retained for presentation, but draft prose never replaces the fact text used as executable truth.

## 6.1 Fail closed

Expected failures include:

```text
SCENARIO_SLICE_NOT_FOUND
SCENARIO_FACT_NOT_FOUND
SCENARIO_FACT_AMBIGUOUS
SCENARIO_FACT_NOT_EXECUTABLE
SCENARIO_CONDITION_REQUIRED
SCENARIO_OBSERVATION_REQUIRED
SCENARIO_DUPLICATE_CASE_ID
SCENARIO_NO_VALID_CASES
```

No validation failure substitutes a guessed fact or neighboring scenario.

---

# 7. Finite Microworld Contract

The production v1 Microworld is a **finite evidenced scenario runner**, not a simulation engine.

```ts
interface MicroworldProjection {
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
```

Execution:

```ts
runMicroworldCase(projection, caseId)
```

returns only the already-validated observations and evidence references for that exact case.

Unknown case:

```text
MICROWORLD_CASE_NOT_EVIDENCED
```

There is no API such as:

```text
run({ requestCount: arbitraryNumber, lockEnabled: boolean })
```

in v1, because that shape suggests generalization to unseen combinations.

A future richer control model may be introduced only when its complete control/value semantics can be evidence-bounded.

---

# 8. Prediction Contract

Prediction must happen before observation reveal for causality learning.

The production v1 evaluator uses **choice IDs**, not free-form semantic grading.

```ts
interface PredictionChoice {
  id: string;
  label: string;
}

interface PredictionPrompt {
  id: string;
  scenarioSetId: string;
  caseId: string;
  status: "PENDING_USER_RESPONSE";
  question: string;
  choices: PredictionChoice[];
  evidenceClaimIds: string[];
}

interface PredictionChallenge {
  prompt: PredictionPrompt;
  expectedChoiceId: string;
}
```

`PredictionPrompt` is safe to hand to a renderer or user-facing transport. The expected answer is kept only in the internal `PredictionChallenge` so the answer key is not accidentally exposed before the user responds.

The expected choice is constructed from evidenced observation(s), not from an LLM-generated answer key.

Evaluation:

```ts
interface PredictionResult {
  result: "CORRECT" | "INCORRECT";
  expectedChoiceId: string;
  receivedChoiceId: string;
}
```

Unknown choice IDs are rejected rather than interpreted semantically.

Evaluation consumes the internal `PredictionChallenge`; rendering consumes only `challenge.prompt`.

The evaluator does not claim the user understands the concept merely because one prediction was correct.

---

# 9. Prediction Choice Construction

A generic system needs plausible alternatives without inventing executable behavior.

Production v1 therefore constructs choices only from **observations of other already-validated cases in the same scenario set**.

Example:

```text
Case A condition: lock ON
Observation A: requests share one in-flight refresh

Case B condition: lock OFF
Observation B: requests take independent refresh paths
```

Prediction for Case A may offer:

```text
A. requests share one in-flight refresh
B. requests take independent refresh paths
```

Both choices are evidence-backed statements. Only A is keyed to Case A.

Requirements:

- no fabricated distractor text;
- choice observations must come from validated cases;
- semantically identical duplicate labels are not automatically merged by NLP; exact duplicate fact IDs/labels may be deduplicated deterministically;
- if fewer than two distinct evidence-backed choices exist, the system may ask a prediction without machine grading or may omit the graded prediction step; it must not fabricate a distractor merely to enable grading.

---

# 10. Transfer Verify Contract

Transfer Verify checks a **different evidenced condition**, not an unseen hypothetical.

```ts
interface TransferVerification {
  mode: "PREDICTION";
  status: "PENDING_USER_RESPONSE";
  sourceCaseId: string;
  transferCaseId: string;
  challenge: PredictionChallenge;
}
```

Rules:

1. `transferCaseId !== sourceCaseId`;
2. transfer case must exist in the same validated scenario set;
3. transfer prompt is built from that case's evidenced observations;
4. transfer remains `PENDING_USER_RESPONSE` until the user answers;
5. result is `CORRECT` or `INCORRECT`; neither result is silently converted into a mastery claim.

If no distinct evidenced case exists:

```text
TRANSFER_CASE_NOT_EVIDENCED
```

The Understanding flow then stops at the least sufficient evidenced intervention rather than manufacturing a transfer case.

---

# 11. Understanding Router Interaction

Existing principle:

```text
causality gap
→ PREDICTION
→ MICROWORLD
→ TRANSFER_VERIFY
```

is retained as the preferred causal learning sequence.

However, the router expresses an **intervention intention**, while evidence gates determine which steps are actually available.

```text
causality requested
        ↓
validated scenario set has >= 1 case?
  no → Explain / evidence gap
  yes
        ↓
Prediction possible with grounded choices?
  yes → Predict first
  no  → non-graded prediction or Microworld only
        ↓
Finite Microworld
        ↓
>= 2 distinct evidenced cases?
  yes → Transfer Verify
  no  → stop
```

This implements Least Sufficient Intervention together with No Evidence, No Executable Behavior.

---

# 12. Example Using the Current Cartographer Model

The actual Cartographer model already contains separately evidenced behavior around refresh locking.

Conceptual production composition:

```text
Projection A
slice: Lock enabled refresh deduplication
  condition facts:
    concurrent handling with lock enabled
  observation facts:
    requests share one in-flight refresh

Projection B
slice: Lock disabled independent refresh
  condition facts:
    concurrent handling with lock disabled
  observation facts:
    independent refresh paths
```

These may become two cases in one `ValidatedCausalScenarioSet` only if every selected fact passes the production executable evidence gate.

The scenario set does **not** imply:

```text
100 requests + lock ON → exact numeric result
```

unless a separately selected evidenced fact/case supports that condition and observation.

---

# 13. Data Ownership

```text
Cartographer world model
  persistent provider truth

BehaviorSlice
  ephemeral Legora evidence projection

ValidatedCausalScenarioSet
  ephemeral understanding/execution projection

MicroworldProjection
  ephemeral finite executable presentation model
```

None of these new scenario/Microworld contracts becomes a second persistent repository knowledge graph.

A future UnderstandingAsset may persist snapshots of these objects for reopening, but persistence is outside this phase.

---

# 14. Testing Strategy

Implementation must use TDD.

## 14.1 BehaviorFact identity migration

Must prove:

- projector emits deterministic `BehaviorFact.id` values;
- same input produces same IDs;
- different categories/provider refs do not collide in fixture coverage;
- all existing Cartographer adapter tests remain green.

## 14.2 Scenario validator

Must prove:

- valid referenced facts produce a validated case;
- missing slice fails closed;
- missing/ambiguous fact fails closed;
- `INFERRED` fact is rejected for executable scenario use;
- `UNKNOWN` fact is rejected;
- confirmed claim with invalid anchor is rejected;
- empty conditions fail;
- empty observations fail;
- duplicate case IDs fail;
- validated statement text is copied from the production fact, not draft prose.

## 14.3 Finite Microworld

Must prove:

- only listed validated cases execute;
- unknown case IDs return `MICROWORLD_CASE_NOT_EVIDENCED`;
- execution reveals only the selected case observations/evidence;
- no arbitrary control combination API exists in the production public contract.

## 14.4 Prediction

Must prove:

- prompt is created before observation execution;
- expected choice comes from the target case observation;
- distractor choices come only from other validated cases;
- correct/incorrect grading uses choice IDs;
- unknown choices fail closed;
- no fabricated distractor is introduced when only one distinct observation exists.

## 14.5 Transfer Verify

Must prove:

- transfer uses a different evidenced case;
- absent second case fails with `TRANSFER_CASE_NOT_EVIDENCED`;
- status starts `PENDING_USER_RESPONSE`;
- answer evaluation never marks general mastery.

## 14.6 Production integration

Using the actual Cartographer-generated Legora model, explicitly select the lock-enabled and lock-disabled projections and prove:

```text
real .cartographer/model.json
→ production Cartographer adapter
→ evidence-addressable BehaviorSlices
→ validated scenario set
→ prediction prompt
→ finite Microworld run
→ transfer prompt
```

No Cartographer/Codex process is required at test time as long as the current provider model exists.

---

# 15. Migration From the Existing E2E Spike

Keep concepts, not code.

```text
routeUnderstandingGap
→ preserve sequence semantics

buildMicroworldProjection
→ replace hard-coded domain scenarios with validated finite cases

simulateProjection
→ replace arbitrary input matching with exact caseId execution

buildTransferVerification
→ generalize to a distinct evidenced case

evaluatePrediction
→ replace numeric/domain-specific answer with choice-ID grading
```

Do not import `.chatgpt2codex/spikes/...` into production.

The spike remains evidence that the interaction pattern is useful; it is not the production implementation source.

---

# 16. Repository Hygiene

- Production code lives under `src/core/` (provider-neutral contracts/logic) unless a provider adapter change is required for `BehaviorFact.id` generation.
- Cartographer-native types remain inside `src/providers/cartographer/`.
- `.cartographer/` remains provider runtime data and stays ignored.
- `.chatgpt2codex/spikes/` remains ignored throwaway evidence.
- No global Git configuration change.
- No commit/push without explicit user approval.

---

# 17. Acceptance Criteria

This design is satisfied only when:

1. every executable scenario statement references a real production `BehaviorFact`;
2. every referenced fact passes the existing executable evidence gate;
3. Microworld execution is finite and exact-case only;
4. unsupported combinations fail closed rather than extrapolate;
5. prediction happens before observation reveal when grounded grading is available;
6. prediction alternatives are themselves evidence-backed observations;
7. Transfer Verify uses a different evidenced case;
8. no second evidenced case means no fabricated transfer;
9. free-form NLP grading is not required in v1;
10. production core contains no Cartographer-native raw model types;
11. actual Cartographer-generated model passes the end-to-end production integration path;
12. existing production Cartographer adapter tests continue to pass.

---

# 18. Next Gate

After written-spec approval:

1. write the TDD implementation plan;
2. migrate `BehaviorFact` to deterministic Legora-owned IDs;
3. implement scenario draft/validation contracts;
4. implement finite Microworld projection/execution;
5. implement evidence-backed Prediction choices;
6. implement Transfer Verify;
7. run deterministic unit tests;
8. run actual Cartographer-model integration;
9. only then decide whether to productionize HTML renderer and UnderstandingAsset persistence.

No production implementation begins before this written spec is reviewed and approved.
