# Cartographer + learn-codebase Integration Spike Implementation Plan

> **For agentic workers:** Execute inline only. Do not dispatch subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove whether Legora can reuse Cartographer for evidence/world-model input and learn-codebase for prediction/verification behavior without making either project Legora's semantic source of truth.

**Architecture:** External projects are inspected and executed only under ignored `.chatgpt2codex/spikes/`. Legora owns a minimal adapter contract and maps external outputs/instructions into Legora-owned `EvidenceClaim`, `BehaviorSlice`, and `VerificationPolicy` shapes. The spike must fail closed if Cartographer requires target-repository mutation or if learn-codebase behavior cannot be separated from its persistent journal assumptions.

**Tech Stack:** TypeScript/Node.js for the adapter proof; upstream Cartographer Node/TypeScript; learn-codebase Agent Skill markdown; Node built-in test runner or a zero-dependency assertion script for the spike.

## Global Constraints

- Project: `Legora`, root `D:\Projects\Legora`.
- Do not modify any other registered project.
- Do not dispatch subagents or parallel agents.
- Do not commit or push.
- External clones/build products must stay under ignored `.chatgpt2codex/spikes/`.
- Do not vendor upstream source into tracked Legora files.
- Target repository mutation by upstream tools must be explicitly detected and reported.
- Legora contracts remain authoritative; upstream ontology or learning journal formats must not become canonical Legora storage formats.
- No React, desktop app, or browser renderer work in this spike.

---

### Task 1: Upstream Surface Proof

**Files:**
- Temporary: `.chatgpt2codex/spikes/cartographer/`
- Temporary: `.chatgpt2codex/spikes/learn-codebase/`
- Create: `docs/spikes/2026-08-14-cartographer-learn-codebase-integration-spike-results.md`

**Interfaces:**
- Consumes: upstream repositories at their current `main` revisions.
- Produces: exact observed install/runtime/tool/storage surfaces and source revisions.

- [ ] **Step 1:** Clone both upstream repositories into ignored temp paths and record exact HEAD revisions.
- [ ] **Step 2:** Inspect Cartographer package scripts, MCP tool definitions, model types, persistence path, and service entry points from source.
- [ ] **Step 3:** Install/build Cartographer if its documented local setup works in the current environment; record PASS/BLOCKED with exact command results.
- [ ] **Step 4:** Inspect learn-codebase `SKILL.md`, `QUESTION-PATTERNS.md`, journal template, and license; identify the smallest reusable prediction/verification protocol independent of journal persistence.

### Task 2: Legora Adapter Contract Proof

**Files:**
- Temporary: `.chatgpt2codex/spikes/adapter-proof/contracts.ts`
- Temporary: `.chatgpt2codex/spikes/adapter-proof/cartographer-adapter.ts`
- Temporary: `.chatgpt2codex/spikes/adapter-proof/learn-codebase-adapter.ts`
- Temporary: `.chatgpt2codex/spikes/adapter-proof/adapter-proof.test.ts`
- Temporary: `.chatgpt2codex/spikes/adapter-proof/tsconfig.json`
- Temporary: `.chatgpt2codex/spikes/adapter-proof/package.json`

**Interfaces:**
- Consumes: observed Cartographer entity/relationship/slice/evidence shapes and learn-codebase instructional protocol.
- Produces:
  - `normalizeCartographerEvidence(input): EvidenceClaim[]`
  - `buildBehaviorSliceFromCartographer(input): BehaviorSlice`
  - `deriveVerificationPolicy(input): VerificationPolicy`

- [ ] **Step 1:** Write failing adapter tests using small representative upstream-shaped fixtures, including confidence mapping and unsupported/ambiguous input rejection.
- [ ] **Step 2:** Run tests and verify RED.
- [ ] **Step 3:** Implement minimal Legora contracts and Cartographer normalization with evidence-preserving confidence mapping: `proven -> CONFIRMED`; `high|medium|low -> INFERRED`; `speculative -> UNKNOWN`; missing source anchors force `UNKNOWN` or rejection where executable behavior would be implied.
- [ ] **Step 4:** Implement learn-codebase policy adaptation limited to predict-before-reveal, partial-answer probing, and transfer prediction; exclude persistent mastery score/spaced-review requirements.
- [ ] **Step 5:** Run tests and verify GREEN.

### Task 3: Mutation and Product-Fit Decision

**Files:**
- Temporary: `.chatgpt2codex/spikes/fixture-target/`
- Modify: `docs/spikes/2026-08-14-cartographer-learn-codebase-integration-spike-results.md`

**Interfaces:**
- Consumes: upstream runtime behavior and adapter proof from Tasks 1-2.
- Produces: final `USE / ADAPT / FORK / REFERENCE ONLY / REIMPLEMENT` decision and exact next architecture boundary.

- [ ] **Step 1:** Exercise the smallest feasible Cartographer project-selection/storage path against a disposable fixture target and verify whether `.cartographer/` is created.
- [ ] **Step 2:** Verify the tracked Legora tree contains neither upstream vendored files nor adapter-proof implementation files; all executable spike material remains ignored.
- [ ] **Step 3:** Record whether external storage relocation is possible without fork; if not, identify the smallest fork seam from source.
- [ ] **Step 4:** Record final decisions for Cartographer and learn-codebase, including what Legora owns, what it adapts, and what must not be copied.
- [ ] **Step 5:** Run a final self-review for placeholders, unsupported claims, and scope leakage. Do not commit or push.
