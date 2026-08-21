# Legora Existence-Value E2E Spike Implementation Plan

**Goal:** Prove or reject Legora's product value by taking one real repository behavior from source evidence through a Legora-owned BehaviorSlice, causality routing, prediction, executable Microworld, transfer verification, and reopenable Understanding Asset.

**Architecture:** Use a disposable nested fixture repository under `.chatgpt2codex/spikes/` so no production project is modified. Because current QWE9 policy blocks installing the external Cartographer marketplace, the spike uses a Cartographer-compatible provider snapshot whose evidence anchors are read from the actual fixture source and tests; actual Cartographer runtime integration remains a separate gate and cannot be claimed as passed.

**Tech Stack:** Node.js 24 built-in test runner, ES modules, self-contained HTML/CSS/vanilla JS artifact, JSON asset records.

## Global Constraints

- No subagents.
- No commit or push.
- No global `git safe.directory` mutation; use command-local override only.
- Spike implementation remains ignored under `.chatgpt2codex/spikes/`.
- Tracked changes are documentation/results only.
- Executable Microworld behavior may only be derived from `CONFIRMED` source evidence.
- `speculative` provider confidence maps to `UNKNOWN`, never `INFERRED`.
- Actual Cartographer runtime remains `UNVERIFIED` unless the official provider is executed locally.

---

### Task 1: Real fixture behavior

Create a tiny nested repository modeling concurrent token refresh with a lock toggle and tests proving `lock ON -> one refresh` and `lock OFF -> two refreshes` for simultaneous requests. Follow RED -> GREEN.

### Task 2: Evidence-to-understanding pipeline

Create failing E2E tests first for:
- evidence normalization without confidence strengthening;
- BehaviorSlice projection owned by Legora;
- causality gap routing to prediction + Explore/Verify;
- Microworld projection restricted to confirmed evidence;
- transfer scenario for five simultaneous requests;
- persisted Understanding Asset contract.

Then implement the minimal pipeline to make those tests pass.

### Task 3: Artifact execution and asset persistence

Render a self-contained HTML Microworld, run a deterministic projection simulation for the teaching scenarios, save the asset directory, and verify its manifest/evidence/status/validations/projection/artifact records reopen consistently.

### Task 4: Product-value verdict

Record PASS only if Legora adds all of the following beyond provider output: human-gap routing, prediction-before-reveal, evidence-bounded executable projection, transfer verification, and persistent understanding lineage. Record the Cartographer runtime gate separately as `BLOCKED_BY_ENVIRONMENT_POLICY` if it still cannot be installed/executed.
