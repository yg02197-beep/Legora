# R4 External Repository Validation Design

Date: 2026-08-22
Status: Implemented and validated as R4_COMPLETE

## 1. Purpose

R4 proves that the R2 Repository Knowledge runtime and the R3 Skill orchestration work as a real product boundary against repositories that do not contain Legora source code.

R4 is a validation phase, not a feature-expansion phase. Its goal is to separate three questions that were previously mixed together:

1. Can a standalone Legora executable run with an unrelated repository as its current working directory?
2. Does the public CLI preserve the acquire -> READY -> stale -> refresh -> READY lifecycle outside the Legora repository?
3. Can a coding agent follow `SKILL.md` to produce useful, evidence-grounded human-understanding output without bypassing Legora runtime authority?

R4 is complete only when deterministic external-repository gates and one live coding-agent pilot both pass.

## 2. Existing contracts R4 must preserve

R4 does not redesign R2 or R3.

The existing public procedure remains:

```text
user question
  -> coding agent
  -> SKILL.md
  -> legora entry <question>
  -> acquire/refresh handshake when required
  -> READY
  -> smallest useful Explain / Explore / Verify intervention
```

The authority split remains:

```text
Repository truth and evidence authority    -> Legora runtime
Semantic interpretation and proposal       -> Coding agent
Human-understanding intervention           -> Skill + coding agent
```

R4 must not weaken the following R2/R3 invariants:

- Entry is the first Legora-grounded repository-understanding step.
- `KNOWLEDGE_NOT_FOUND` returns `ACQUIRE_KNOWLEDGE`.
- `KNOWLEDGE_STALE` / `KNOWLEDGE_UNKNOWN` return `REFRESH_KNOWLEDGE`.
- Repository-specific Explain / Explore / Verify output is not authoritative before READY.
- Acquisition proposals contain candidate structure and evidence locators, not authoritative snippets, timestamps, history, or CONFIRMED evidence.
- Legora captures repository evidence itself.
- Behavior Slice ownership remains LEGORA.
- Native Repository Knowledge does not depend on Cartographer control-plane concepts.
- Public Skill remains provider-neutral and coding-agent-neutral.

## 3. Recommended validation architecture

R4 uses two validation layers.

### Layer 1 — deterministic external black-box validation

A temporary target repository is created outside the Legora source tree. Legora is invoked only through its public executable boundary with the target repository as `cwd`.

This layer answers runtime and safety questions without depending on LLM behavior.

### Layer 2 — live coding-agent pilot

After all deterministic gates pass, one coding agent is asked a real repository-understanding question against a real non-Legora repository and is expected to follow the public Skill.

This layer evaluates orchestration quality and human-understanding usefulness.

The layers must remain separate. A live-agent pass cannot compensate for a deterministic runtime failure, and deterministic tests cannot by themselves prove the user-facing understanding experience.

## 4. R4 gate model

R4 consists of seven gates.

```text
Gate 0  Standalone Packaging / Invocation
Gate A  External Native CLI Lifecycle
Gate B  Target Repository Isolation
Gate C  Bounded Knowledge Publication
Gate D  External Fail-Closed Boundaries
Gate E  Live Coding-Agent Pilot
Gate F  Human Understanding Acceptance
```

All gates are required for R4 completion.

A failed gate results in `R4_NOT_COMPLETE` and must identify the owning boundary rather than being hidden by later gates.

## 5. Gate 0 — Standalone Packaging / Invocation

### 5.1 Goal

Prove that Legora can execute outside its own source repository without borrowing Legora's development environment from the target repository.

### 5.2 Required topology

The validation environment must keep tool installation and target repository separate.

```text
validation-root/
  legora-install/
    <installed or packed Legora runtime>

  target-repository/
    package.json
    src/
    ...
```

The target repository must not contain or gain:

- Legora source code
- `node_modules/legora`
- `tsx`
- `typescript`
- Cartographer runtime files
- MCP configuration
- agent-vendor configuration created by R4

### 5.3 Invocation rule

The command is run with:

```text
executable = standalone Legora executable from legora-install
cwd        = target-repository
```

The proof must not use an internal import such as `runLegoraEntry(...)`.

The proof must not rely on `node D:/Projects/Legora/src/cli/bin.mjs` as the final standalone acceptance path.

A source-tree invocation may be used only as a diagnostic comparison if the standalone path fails.

### 5.4 Packaging risk explicitly under test

The current CLI entry imports `tsx/esm/api`, while `tsx` is currently a development dependency. Therefore R4 must treat packaging as an unresolved product boundary until an actual packed/installed invocation succeeds.

R4 does not assume that current package metadata is already publishable.

### 5.5 Pass criteria

Gate 0 passes when:

- the standalone installation is created without installing Legora dependencies into the target repository;
- `legora entry <question>` launches from the target repository;
- the process emits one machine-readable result;
- the result uses the target repository as repository root;
- no target source or project manifest is modified by installation or invocation.

## 6. Gate A — External Native CLI Lifecycle

### 6.1 Controlled target repository

The deterministic fixture must be a small repository that is structurally unrelated to Legora.

Minimum contents:

```text
target-repository/
  package.json
  src/
    router.ts
    auth.ts
    billing.ts
    decoy.ts
```

Roles:

- `router.ts`: evidence needed for the canonical question.
- `auth.ts`: optional directly supporting context when the fixture behavior requires it.
- `billing.ts`: unrelated behavior.
- `decoy.ts`: unrelated code containing overlapping terminology such as `routing` to test over-acquisition resistance.

### 6.2 Canonical question

The deterministic lifecycle uses one behavior question, for example:

```text
How does request routing work?
```

The wording may be frozen in the implementation spec, but the question must have one small, objectively evidencable flow.

### 6.3 Required lifecycle

#### Step A1 — empty repository knowledge

Run:

```text
legora entry "How does request routing work?"
```

Expected:

```text
status = KNOWLEDGE_NOT_FOUND
nextAction.type = ACQUIRE_KNOWLEDGE
```

#### Step A2 — public acquisition

Submit a proposal through stdin to:

```text
legora knowledge acquire
```

The proposal contains only the minimum related candidates and evidence locators.

Expected:

```text
status = ACQUIRED
```

#### Step A3 — READY

Re-run Entry.

Expected:

- `status = READY`
- `behaviorSlice.owner = LEGORA`
- `nextAction = null`
- evidence claims exist
- native acquired evidence remains `INFERRED`

#### Step A4 — source mutation

Modify only the evidence-bearing target source file.

Re-run Entry.

Expected:

```text
status = KNOWLEDGE_STALE
nextAction.type = REFRESH_KNOWLEDGE
```

The returned record IDs must be the affected selected knowledge, not every record in the store.

#### Step A5 — refresh and READY

Refresh through `legora knowledge acquire`, then run Entry again.

Expected:

- changed ACTIVE evidence is promoted to HISTORY;
- newly captured source becomes ACTIVE;
- `createdAt` remains stable;
- Entry returns READY again.

### 6.4 Black-box requirement

All lifecycle assertions must use public process output and repository artifacts. R4 acceptance must not call R2 service functions directly for the canonical external proof.

Internal calls may remain in lower-level regression tests but are not sufficient for Gate A.

## 7. Gate B — Target Repository Isolation

### 7.1 Goal

Prove that using Legora does not install itself into or rewrite the target project.

### 7.2 Allowed target-repository mutation

The only expected Legora-owned persistent runtime artifact is:

```text
.legora/repository-knowledge.json
```

Temporary lock or temp publication files may exist during an operation but must not remain after successful completion.

### 7.3 Forbidden mutation

R4 must fail if normal Legora use creates or modifies any of the following without an explicit separate product decision:

- target `package.json`
- target lockfile
- target source code
- target tests
- target `node_modules`
- target `AGENTS.md`
- target agent-specific instruction files
- Cartographer model/runtime files
- MCP configuration
- `.gitignore`

R4 deliberately does not decide whether `.legora` should be committed or ignored. That is a later distribution policy decision.

### 7.4 Pass criteria

Compare target repository inventory and tracked content before and after the lifecycle. Differences must be limited to the intended `.legora` Repository Knowledge artifact and the source mutation explicitly performed by the test itself.

## 8. Gate C — Bounded Knowledge Publication

### 8.1 Goal

Test the strongest deterministic version of the R3 bounded-acquisition promise without pretending that Legora can observe every file an AI agent reads.

### 8.2 Deliberate boundary

R4 must not claim:

```text
"the coding agent never inspected an unrelated file"
```

unless the selected agent environment provides authoritative read telemetry that R4 explicitly validates.

The vendor-neutral invariant is instead:

```text
unrelated material must not become authoritative persisted Repository Knowledge
```

### 8.3 Fixture assertion

For the canonical routing question, persisted Repository Knowledge may include:

- router entity
- routing flow
- directly required supporting entity/relationship

It must not include unrelated `billing` or `decoy` knowledge merely because those files exist or share vocabulary.

### 8.4 Pass criteria

After acquisition and refresh:

- every persisted native record is relevant to the canonical question or a directly required reference;
- no unrelated fixture subject is promoted;
- the proposal is smaller than a mandatory whole-repository representation.

The test does not set an arbitrary file-count quota because repository structure varies; relevance is the contract.

## 9. Gate D — External Fail-Closed Boundaries

### 9.1 Goal

Prove that safety properties added during R2 hardening remain enforced through the public external CLI, not only through unit tests.

### 9.2 Minimum adversarial cases

The black-box external suite must cover:

- malformed stdin JSON -> usage failure / exit code 2;
- semantically invalid proposal -> rejection / exit code 6;
- empty candidate batch -> rejection;
- absolute evidence locator -> rejection;
- `../` repository escape -> rejection;
- junction/symlink realpath escape -> rejection where supported by the host filesystem;
- invalid line coordinate, including non-positive, fractional, or reversed range -> rejection;
- dangling relationship or behavior-flow entity reference -> rejection;
- update that would invalidate existing relationship/flow references -> rejection;
- failed batch must not partially publish Knowledge.

### 9.3 Cross-platform treatment

A platform capability that cannot create the relevant filesystem link must produce an explicit skipped-capability result rather than silently treating the boundary as passed.

The primary Windows environment must exercise junction/symlink escape using a mechanism available without changing machine-wide security settings.

## 10. Gate E — Live Coding-Agent Pilot

### 10.1 Goal

Validate that a real coding agent can use the R3 Skill correctly without Legora-specific hidden orchestration in the host.

### 10.2 Scope

R4 uses exactly one canonical agent pilot.

Additional agent vendors are explicitly deferred to a later compatibility matrix.

The Legora product surface remains vendor-neutral even if the first pilot uses Codex or another selected agent.

### 10.3 Pilot repository

Use a real repository that:

- is not the Legora repository;
- has non-trivial behavior to understand;
- can safely receive a `.legora` runtime directory;
- has a clean or explicitly recorded working state before the pilot;
- is not modified by R4 except for normal Repository Knowledge artifacts.

### 10.4 Pilot question

Use one concrete behavior question whose answer can be checked against repository evidence, such as a multi-step request, ingestion, routing, or processing flow.

The pilot question must not be chosen because the agent already has a prewritten answer.

### 10.5 Observable orchestration acceptance

The pilot must demonstrate:

- Entry-first behavior;
- handling of acquire or refresh handshake when returned;
- no direct write to `.legora/repository-knowledge.json`;
- no authoritative repository explanation before READY;
- acquisition proposal with locators rather than agent-authored evidence authority;
- final repository-specific claims grounded in READY output and current evidence;
- smallest useful capability rather than a forced Explain -> Explore -> Verify sequence.

### 10.6 Telemetry boundary

R4 records only evidence available from the selected agent session and Legora process/artifacts. It must not invent hidden-agent telemetry.

If a behavioral criterion cannot be observed reliably, it is reported as `NOT_OBSERVABLE` and cannot be used as a deterministic PASS condition.

## 11. Gate F — Human Understanding Acceptance

### 11.1 Goal

Evaluate whether the final intervention is useful to a human, rather than merely structurally valid JSON.

### 11.2 Explain acceptance

When Explain is the selected intervention, the output should:

1. lead with a simple mental model;
2. preserve the connection to formal repository/code terminology;
3. make the relevant execution or structural flow clear;
4. separate confirmed repository facts, evidence-based inference, general programming background, and unknowns;
5. avoid unsupported repository claims;
6. avoid dumping unrelated implementation details.

### 11.3 Explore acceptance

When Explore is useful:

- it should be tied to a causal, state, event, scenario, or changed-condition question;
- it must not imply that every Explore action requires a Microworld;
- Prediction/Microworld execution must remain gated by executable evidence;
- insufficient executable evidence must fall back to evidence-bounded inspection/explanation rather than fabricated simulation.

### 11.4 Verify acceptance

Verify should be used only when explicitly requested or genuinely useful for the current understanding gap.

It must not:

- claim permanent mastery;
- reduce ambiguous understanding to a binary pass/fail judgment;
- force a quiz after every explanation.

### 11.5 Review result shape

Human-understanding review records:

```text
confirmed strengths
partial issues
uncertain observations
misconceptions introduced, if any
insufficient evidence
next gap, if any
```

The live acceptance report may use `PASS`, `CONDITIONAL_PASS`, or `FAIL` as the overall gate result, but the underlying human-understanding observations must not be reduced to a single correctness bit.

## 12. R4 result artifact

R4 should produce one versioned validation report summarizing deterministic and live evidence.

Recommended location:

```text
docs/validation/r4-external-repository-validation.md
```

The report is an evidence artifact, not a mutable product database.

Minimum structure:

```text
R4 External Repository Validation

Gate 0  Standalone Packaging / Invocation
Gate A  External Native CLI Lifecycle
Gate B  Target Repository Isolation
Gate C  Bounded Knowledge Publication
Gate D  External Fail-Closed Boundaries
Gate E  Live Coding-Agent Pilot
Gate F  Human Understanding Acceptance

Overall: R4_COMPLETE | R4_NOT_COMPLETE
```

Every gate includes:

- environment or fixture identity;
- command or observable procedure;
- expected result;
- actual evidence;
- result;
- failure ownership when not passed.

## 13. Failure ownership

R4 failures must be classified so implementation work targets the correct layer.

### Packaging failure

Examples:

- packed runtime cannot resolve a dependency;
- executable works only from Legora source tree.

Owner: distribution / packaging boundary.

### Runtime lifecycle failure

Examples:

- external Entry does not use target `cwd`;
- acquire does not persist correctly;
- stale/refresh lifecycle differs from R2 contract.

Owner: CLI / Repository Knowledge runtime.

### Safety/isolation failure

Examples:

- target project manifest modified;
- repository escape accepted;
- unrelated Knowledge is persisted as authoritative.

Owner: runtime safety boundary.

### Agent orchestration failure

Examples:

- agent bypasses Entry;
- agent answers authoritatively before READY;
- agent authors evidence authority rather than locators.

Owner: Skill clarity or agent compatibility, after verifying runtime output was correct.

### Human-understanding failure

Examples:

- grounded answer is technically correct but too implementation-heavy;
- terminology is not bridged;
- unsupported inference is presented as repository fact.

Owner: Explain / Explore / Verify guidance or live-agent interpretation.

## 14. Test and implementation strategy

Implementation planning should preserve a strict sequence:

1. make standalone package/install proof executable;
2. build deterministic external target fixture;
3. prove public CLI lifecycle;
4. prove repository isolation;
5. prove adversarial public CLI boundaries;
6. prove bounded Knowledge publication;
7. run all existing R1-R3 regressions;
8. only then execute one live coding-agent pilot;
9. write the R4 validation report.

The deterministic suite should be repeatable without an LLM.

The live pilot should not be placed inside the normal deterministic unit-test command because its purpose and reproducibility are different.

## 15. R4 non-goals

R4 must not add the following unless a deterministic gate proves that a minimal change is required specifically to make the existing public contract operable:

- MCP server
- built-in LLM runtime
- vendor-specific agent API
- background daemon
- whole-repository pre-indexer
- remote repository service
- web UI
- editor extension
- persistent learner profile
- multi-agent benchmark matrix
- automatic `.gitignore` policy
- new Cartographer dependency

A packaging fix, CLI fix, safety fix, or Skill clarification discovered by an R4 gate is in scope because it repairs the already-approved product boundary. New product capabilities are not.

## 16. Completion criteria

R4 is `R4_COMPLETE` only when all of the following are true:

- Gate 0 passes using a standalone installed/packed Legora runtime.
- Gate A passes entirely through public process boundaries against an external repository.
- Gate B proves target-project isolation.
- Gate C proves unrelated fixture material is not promoted into authoritative Repository Knowledge.
- Gate D proves the required fail-closed cases through the external CLI.
- All existing typecheck, unit, legacy real integrations, and Repository Knowledge real integrations remain green.
- Gate E completes one observable live coding-agent pilot.
- Gate F receives an explicit human-understanding acceptance result.
- The final validation report records evidence for every gate.

If a gate is skipped because of a missing capability, R4 remains incomplete unless the gate specification explicitly defines that capability as optional. The junction/symlink variant may record a platform-specific skip only on platforms that cannot create such a link; the primary Windows validation environment is expected to exercise it.

## 17. Design decision summary

R4 adopts a two-layer validation model: deterministic black-box external repository proof first, live coding-agent proof second.

It intentionally does not create a new AI runtime or orchestration subsystem. The existing R2 runtime and R3 Skill remain the product. R4's job is to expose packaging, isolation, lifecycle, safety, agent-usage, and human-understanding failures that internal repository tests cannot prove away.
