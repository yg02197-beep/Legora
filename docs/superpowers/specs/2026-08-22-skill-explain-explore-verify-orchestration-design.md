# Legora R3 — Skill + Explain / Explore / Verify Orchestration Design

Date: 2026-08-22
Status: Design approved in chat; implementation not started
Scope: Coding-agent-neutral orchestration layer over the R2 Repository Knowledge Entry/acquisition loop

## 1. Goal

R3 makes Legora usable as a coding-agent skill without introducing a new AI runtime or moving semantic judgment into deterministic core code.

The target interaction is:

```text
User question
    ↓
Coding agent
    ↓
Legora SKILL.md
    ↓
legora entry <question>
    ↓
Repository Knowledge state
    ↓
Acquire / Refresh / READY
    ↓
Explain / Explore / Verify
```

R3 does not replace the Repository Knowledge runtime built in R1/R2. It teaches a coding agent how to use that runtime safely and how to choose the smallest useful human-understanding intervention once a fresh LEGORA-owned Behavior Slice is available.

## 2. Architectural Decision

Use **Skill-first orchestration**.

Responsibilities are divided as follows:

```text
Coding agent + SKILL.md
├─ interpret the user's understanding goal
├─ call Legora Entry first
├─ obey acquisition/refresh handshakes
├─ inspect only the repository region needed by the question
├─ construct evidence-locator proposals when acquisition is requested
└─ choose Explain / Explore / Verify after READY

Legora deterministic Core / CLI
├─ select persisted Repository Knowledge
├─ validate acquisition proposals
├─ capture source evidence itself
├─ enforce repository boundaries
├─ maintain ACTIVE / HISTORY evidence
├─ check freshness
├─ project LEGORA-owned Behavior Slice
└─ fail closed when evidence is insufficient
```

The core principle is:

> Semantic interpretation belongs to the coding agent; repository truth and safety boundaries belong to Legora.

R3 therefore does **not** implement a deterministic NLP Understanding Router that pretends to know user intent from free text.

## 3. Public Skill Layout

R3 adds the following public skill surface at repository root:

```text
SKILL.md
references/
├─ explain.md
├─ explore.md
└─ verify.md
```

`SKILL.md` is the short operational procedure. Detailed mode behavior lives in the three reference files so agents do not need to load every rule for every question.

The public skill must remain vendor-neutral. It may describe shell-level `legora` commands, but must not require Codex-, Claude-, Gemini-, MCP-, or Cartographer-specific control APIs.

## 4. Mandatory Entry-First Protocol

Every repository-understanding question handled through Legora begins with:

```text
legora entry <natural-language question>
```

The coding agent must not bypass Entry and present a repository claim as Legora-grounded merely because it can read source files itself.

The Entry result controls the next action.

### 4.1 READY

```text
status = READY
nextAction = null
```

The agent may use the returned Behavior Slice and evidence claims to perform Explain, Explore, or Verify.

### 4.2 KNOWLEDGE_NOT_FOUND

```text
status = KNOWLEDGE_NOT_FOUND
nextAction.type = ACQUIRE_KNOWLEDGE
```

The agent must:

1. inspect only the repository region necessary to answer the current question;
2. identify candidate Entity / Relationship / Behavior Flow knowledge;
3. provide file and line evidence locators, never authoritative snippets;
4. submit the proposal through `legora knowledge acquire`;
5. call `legora entry <question>` again.

The agent must not treat `KNOWLEDGE_NOT_FOUND` as permission to perform a whole-repository pre-analysis.

### 4.3 KNOWLEDGE_STALE / KNOWLEDGE_UNKNOWN

```text
nextAction.type = REFRESH_KNOWLEDGE
nextAction.recordIds = [...]
```

The agent refreshes only the affected records and the directly required supporting region. It then submits an acquisition proposal and re-runs Entry.

The existing ACTIVE evidence may move to HISTORY only through Legora's acquisition service. The agent does not edit Repository Knowledge persistence directly.

### 4.4 No READY, No Authoritative Capability Output

Before READY, the agent may report the acquisition/freshness problem and what evidence it needs to inspect. It must not present Explain/Explore/Verify output as a current Legora-grounded repository explanation.

## 5. Acquisition Proposal Rules for the Skill

The Skill treats an acquisition proposal as a hypothesis plus evidence locations, not as repository truth.

The agent may supply:

```text
candidate id
kind
subject
vendor-neutral structure
filePath / lineStart / lineEnd evidence locators
```

The agent must not author:

```text
snippet
history
createdAt
updatedAt
ACTIVE/HISTORY transitions
CONFIRMED evidence status
```

Legora captures snippets from the repository and stores native acquisition semantics as INFERRED unless a separate deterministic evidence path establishes stronger confidence.

If acquisition is rejected, the agent fixes the proposal or gathers better evidence. It must not bypass validation by writing `.legora/repository-knowledge.json` directly.

## 6. Capability Routing

The Skill chooses one smallest useful intervention after READY.

The routing rules are guidance for the coding agent, not deterministic source-code classification.

### 6.1 Explain

Prefer Explain when the user's gap is primarily:

- terminology;
- structure;
- role/responsibility;
- request or state flow;
- contrast between two evidenced parts;
- a request for a walkthrough.

Explain uses only the selected Behavior Slice and its supporting evidence for repository-specific claims.

The default explanation grammar is:

```text
plain-language mental model
→ canonical technical term
→ how it appears in this repository
→ evidence-backed flow / contrast / example
```

The agent should use the easiest correct wording first without disconnecting the user from the formal term.

### 6.2 Explore

Prefer Explore when the user wants to inspect causality or behavior under conditions, such as:

- why an outcome happens;
- what changes when a condition changes;
- how state/event transitions produce an effect;
- comparing evidenced scenarios;
- observing a causal path directly.

Explore is broader than Microworld. Code navigation, state inspection, timeline explanation, and scenario comparison are valid Explore modes.

Microworld or Prediction is allowed only when the existing executable-evidence path can build a finite evidence-bounded scenario. If that gate cannot be satisfied, Explore degrades to non-executable evidence-bounded inspection rather than inventing transitions or outcomes.

### 6.3 Verify

Prefer Verify when the user asks to check their understanding, or when confirming a specific understanding gap is useful before continuing.

Verify evaluates observable evidence of understanding, not the user's mind or permanent ability.

Preferred MVP forms are:

- explain-back;
- prediction over an evidenced case;
- transfer verification over a different evidenced case when available.

Verify must not reduce ambiguous responses to binary PASS/FAIL only. It may classify observed understanding as:

```text
confirmed
partial
uncertain
misconception
insufficient_evidence
```

The next intervention remains controlled by the Skill/agent orchestration layer, not by the Verify capability itself.

## 7. Minimal Intervention Rule

Legora is not a quiz engine and does not force a fixed Explain → Explore → Verify sequence.

The agent chooses the smallest action likely to improve understanding:

```text
terminology / structure → usually Explain
causality → usually Explore
explicit understanding check → usually Verify
insufficient repository evidence → Acquire / Refresh first
no remaining gap → Stop
```

A user preference overrides the default route when safe. For example, "just explain it" should not trigger a quiz merely because Verify exists.

## 8. Evidence and Fidelity Boundaries

All repository-specific claims in Explain / Explore / Verify must trace back to the current READY Behavior Slice/evidence set or be clearly marked as general programming background.

The Skill must preserve these distinctions:

```text
repository-grounded fact
inference from current evidence
general concept / analogy
unknown or unsupported claim
```

The agent must not turn an analogy into a repository fact.

Explore must not invent system states, transitions, effects, or failure paths outside the evidenced slice.

Verify must not create a supposedly correct answer from unsupported hypothetical behavior.

## 9. Public-Surface Isolation

The R3 public skill surface must not require or expose:

- Cartographer;
- Cartographer model paths;
- provider `sliceId`;
- MCP;
- Codex-specific commands;
- Claude-specific commands;
- Gemini-specific commands;
- internal provider refresh hooks.

Cartographer remains only a legacy import compatibility boundary inside the repository-knowledge implementation.

## 10. Failure Behavior

The Skill must fail closed and communicate the real blocking state.

Examples:

```text
Entry KNOWLEDGE_NOT_FOUND
→ gather bounded evidence and acquire; do not fabricate a Behavior Slice

Entry KNOWLEDGE_STALE
→ refresh affected records; do not reuse historical evidence as current truth

Entry KNOWLEDGE_UNKNOWN
→ refresh or report uncheckable evidence; do not silently treat it as current

acquisition REJECTED
→ fix locator/structure/reference issue; do not edit store directly

causal executable evidence insufficient
→ explain/inspect evidence; do not fabricate Microworld behavior
```

## 11. Contract Tests

R3 adds automated tests for the public skill surface.

Required assertions:

### 11.1 Presence

- root `SKILL.md` exists;
- `references/explain.md` exists;
- `references/explore.md` exists;
- `references/verify.md` exists.

### 11.2 Entry / Acquisition Protocol

`SKILL.md` must encode:

- `legora entry` as the first Legora repository-understanding operation;
- `ACQUIRE_KNOWLEDGE` handling;
- `REFRESH_KNOWLEDGE` handling;
- `legora knowledge acquire` usage;
- Entry re-run after acquisition/refresh;
- no authoritative capability output before READY.

### 11.3 Provider Neutrality

Public Skill/reference files must not expose:

- `Cartographer`;
- `sliceId`;
- `refreshCartographer`;
- MCP as a requirement;
- vendor-specific execution commands.

### 11.4 Capability Contracts

`references/explain.md` must require evidence-bounded repository claims and terminology bridge behavior.

`references/explore.md` must distinguish Explore from Microworld and require executable evidence before finite causal simulation/prediction.

`references/verify.md` must define observable-understanding semantics and forbid PASS/FAIL-only grading as the general result model.

## 12. Integration Test

Add a native skill-boundary integration proving that the runtime surface the Skill depends on remains valid:

```text
empty temporary repository
→ Entry returns ACQUIRE_KNOWLEDGE
→ native acquisition creates required knowledge
→ Entry returns READY
→ Behavior Slice is LEGORA-owned
→ source change produces REFRESH_KNOWLEDGE
→ native re-acquisition refreshes ACTIVE/HISTORY
→ Entry returns READY again
```

This test remains provider-neutral and must not require a Cartographer model.

The existing R2 native acquisition integration may be reused or strengthened rather than duplicating identical coverage.

## 13. Files Expected in R3

Primary additions:

```text
SKILL.md
references/explain.md
references/explore.md
references/verify.md
tests/unit/skill-contract.test.ts
```

Possible targeted updates:

```text
README.md
tests/integration/repository-knowledge/native-acquisition-loop.test.ts
```

R3 should not add a new production `UnderstandingRouter` module unless implementation discovers a deterministic responsibility that cannot correctly live in the Skill. Any such discovery is an architectural change requiring separate review.

## 14. Out of Scope

R3 explicitly excludes:

- a new LLM runtime inside Legora;
- MCP server implementation;
- coding-agent-specific SDK integration;
- whole-repository mandatory indexing;
- persistent learner/personality profile;
- free-form NLP grading in deterministic core;
- automatic promotion of agent interpretation to CONFIRMED evidence;
- renderer/UI implementation;
- package publication/installer work;
- legacy provider deletion beyond what is necessary for public-surface isolation.

## 15. Acceptance Criteria

R3 is complete when all of the following hold:

1. A coding agent can discover one canonical `SKILL.md` and three capability references.
2. The Skill always enters through R2 Entry and follows Entry's acquire/refresh handshake.
3. Repository-specific Explain / Explore / Verify work is gated on READY.
4. Native acquisition remains question-bounded, evidence-locator-based, and fail-closed.
5. Explain follows evidence-bounded mental-model and terminology-bridge rules.
6. Explore never implies that every exploration is a Microworld and never fabricates executable behavior.
7. Verify evaluates observable understanding without general PASS/FAIL-only semantics or permanent mastery claims.
8. Public skill files contain no Cartographer/MCP/vendor-specific runtime dependency.
9. Existing R2 native acquisition, Entry, causal, and legacy compatibility regressions remain green.
10. `git diff --check` passes.
11. No commit or push occurs without explicit user approval.
