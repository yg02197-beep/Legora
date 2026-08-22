# Skill + Explain / Explore / Verify Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Project constraint: do not use subagents; execute inline in the current session with review checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a coding-agent-neutral Legora skill surface that always enters through the R2 Repository Knowledge protocol and routes READY behavior into evidence-bounded Explain / Explore / Verify guidance.

**Architecture:** Keep semantic orchestration in `SKILL.md` and capability-specific rules in `references/*.md`. Keep repository truth, acquisition validation, freshness, ACTIVE/HISTORY promotion, Behavior Slice projection, and executable-evidence gates in the existing deterministic TypeScript runtime; R3 does not add a production Understanding Router or another AI runtime.

**Tech Stack:** Markdown skill/reference files, TypeScript, Node.js `node:test`, existing `tsx` test loader, existing Legora CLI/Entry runtime.

**Spec:** `docs/superpowers/specs/2026-08-22-skill-explain-explore-verify-orchestration-design.md`

## Global Constraints

- Every repository-understanding workflow begins with `legora entry <question>`.
- `KNOWLEDGE_NOT_FOUND` follows `ACQUIRE_KNOWLEDGE`; `KNOWLEDGE_STALE` / `KNOWLEDGE_UNKNOWN` follow `REFRESH_KNOWLEDGE`.
- No repository-specific Explain / Explore / Verify output is presented as Legora-grounded before `READY`.
- Native acquisition remains question-bounded and evidence-locator-based; the skill must not author snippets, history, timestamps, ACTIVE/HISTORY transitions, or `CONFIRMED` evidence status.
- Public skill files must not require or expose Cartographer, provider `sliceId`, MCP, vendor-specific execution commands, or provider refresh hooks.
- Explain uses evidence-bounded repository claims and terminology-bridge behavior.
- Explore is broader than Microworld and may use executable Prediction/Microworld behavior only when the existing executable-evidence path supports it.
- Verify evaluates observable understanding, does not claim permanent mastery, and does not reduce ambiguous responses to general PASS/FAIL-only grading.
- Do not add a new LLM runtime, MCP server, vendor SDK integration, persistent learner profile, renderer/UI, mandatory full-repository indexing, or deterministic free-form NLP grading.
- Preserve all current R2 uncommitted work. Do not stage, commit, push, or alter global Git configuration without separate explicit user approval.
- Do not use subagents or parallel agents.

## File Structure

- `SKILL.md` — canonical short operational procedure: Entry-first protocol, acquisition/refresh handshake, READY gate, minimal intervention routing, reference loading.
- `references/explain.md` — detailed Explain contract: mental model, terminology bridge, repository/general-knowledge separation, evidence discipline.
- `references/explore.md` — detailed Explore contract: causal inspection, non-Microworld modes, executable-evidence gate, fallback behavior.
- `references/verify.md` — detailed Verify contract: observable understanding, explain-back/prediction/transfer forms, non-binary result semantics.
- `tests/unit/skill-contract.test.ts` — public-surface contract tests covering presence, required protocol text, forbidden provider/vendor terms, and capability-specific invariants.
- `tests/integration/repository-knowledge/native-acquisition-loop.test.ts` — existing provider-neutral runtime proof reused unchanged; it already covers the full acquire → READY → stale → refresh → HISTORY → READY loop required by R3.
- `README.md` — brief public status/usage update after the skill files are green.

---

### Task 1: Add the Entry-first public Skill contract

**Files:**
- Create: `tests/unit/skill-contract.test.ts`
- Create: `SKILL.md`

**Interfaces:**
- Consumes: CLI contract `legora entry <question>` and R2 Entry result fields `status` and `nextAction`.
- Produces: canonical root `SKILL.md` that later capability reference tasks extend via links to `references/explain.md`, `references/explore.md`, and `references/verify.md`.

- [ ] **Step 1: Write the failing Skill presence/protocol tests**

Create `tests/unit/skill-contract.test.ts` with the following initial test harness and assertions:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function read(relativePath: string): Promise<string> {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

test("root SKILL.md encodes the R2 Entry-first acquire-refresh handshake", async () => {
  const skill = await read("SKILL.md");

  assert.match(skill, /legora entry/i);
  assert.match(skill, /KNOWLEDGE_NOT_FOUND/);
  assert.match(skill, /ACQUIRE_KNOWLEDGE/);
  assert.match(skill, /KNOWLEDGE_STALE/);
  assert.match(skill, /KNOWLEDGE_UNKNOWN/);
  assert.match(skill, /REFRESH_KNOWLEDGE/);
  assert.match(skill, /legora knowledge acquire/i);
  assert.match(skill, /READY/);
  assert.match(skill, /entry.*again|re-run.*entry|rerun.*entry/i);
});

test("root SKILL.md gates authoritative capability output on READY", async () => {
  const skill = await read("SKILL.md");

  assert.match(skill, /before READY|until READY|READY.*before/i);
  assert.match(skill, /Explain/);
  assert.match(skill, /Explore/);
  assert.match(skill, /Verify/);
});

test("root SKILL.md points to the three capability references", async () => {
  const skill = await read("SKILL.md");

  assert.match(skill, /references\/explain\.md/);
  assert.match(skill, /references\/explore\.md/);
  assert.match(skill, /references\/verify\.md/);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --import tsx --test tests/unit/skill-contract.test.ts
```

Expected: FAIL because root `SKILL.md` does not exist.

- [ ] **Step 3: Create the minimal canonical `SKILL.md`**

Create `SKILL.md` with these exact sections and operational content:

```markdown
# Legora

Legora helps a coding agent answer repository-understanding questions by grounding repository-specific claims in current Repository Knowledge and a LEGORA-owned Behavior Slice.

## Mandatory procedure

1. Run `legora entry <natural-language question>` before making a Legora-grounded repository explanation.
2. Inspect the returned `status` and `nextAction`.
3. If `status` is `KNOWLEDGE_NOT_FOUND` and `nextAction.type` is `ACQUIRE_KNOWLEDGE`, inspect only the repository region needed for the current question, build an evidence-locator proposal, submit it through `legora knowledge acquire`, and re-run `legora entry <question>`.
4. If `status` is `KNOWLEDGE_STALE` or `KNOWLEDGE_UNKNOWN` and `nextAction.type` is `REFRESH_KNOWLEDGE`, refresh only `nextAction.recordIds` and directly required supporting code, submit through `legora knowledge acquire`, and re-run Entry.
5. Do not present repository-specific Explain / Explore / Verify output as Legora-grounded before READY.
6. When `status` is `READY`, choose the smallest useful intervention: Explain, Explore, Verify, or Stop.

## Acquisition boundary

Treat an acquisition proposal as a hypothesis plus source locations. Supply candidate identity, vendor-neutral structure, and `filePath` / `lineStart` / `lineEnd` locators. Do not author evidence snippets, history, timestamps, ACTIVE/HISTORY transitions, or CONFIRMED evidence status. Do not write `.legora/repository-knowledge.json` directly.

Do not perform mandatory whole-repository pre-analysis. Gather only what the current question and affected records require.

## Capability routing

- Terminology, structure, role, flow, contrast, or walkthrough → read `references/explain.md`.
- Causality, changed conditions, state/event transitions, or scenario inspection → read `references/explore.md`.
- Explicit understanding check, explain-back, prediction, or transfer check → read `references/verify.md`.
- If the repository evidence is insufficient, acquire or refresh before capability output.
- If there is no remaining understanding gap, stop.

A safe explicit user preference overrides the default route. Do not force a fixed Explain → Explore → Verify sequence.

## Grounding boundary

Repository-specific claims must come from the current READY Behavior Slice and supporting evidence. Keep repository-grounded facts, evidence-based inference, general programming background/analogy, and unknown claims distinct. Never turn an analogy into repository truth.
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```bash
node --import tsx --test tests/unit/skill-contract.test.ts
```

Expected: all three Task 1 tests PASS.

- [ ] **Step 5: Check the task diff without committing**

Run:

```bash
git -c safe.directory=D:/Projects/Legora diff --check
git -c safe.directory=D:/Projects/Legora status --short
```

Expected: no whitespace errors; `SKILL.md` and `tests/unit/skill-contract.test.ts` appear as intended R3 additions alongside preserved R2 work. Do not stage or commit.

---

### Task 2: Add evidence-bounded Explain guidance

**Files:**
- Modify: `tests/unit/skill-contract.test.ts`
- Create: `references/explain.md`

**Interfaces:**
- Consumes: READY Behavior Slice/evidence boundary established by `SKILL.md`.
- Produces: Explain guidance for terminology, structure, flow, contrast, example, and walkthrough responses.

- [ ] **Step 1: Add the failing Explain reference test**

Append to `tests/unit/skill-contract.test.ts`:

```ts
test("Explain reference builds a simple mental model while preserving repository evidence boundaries", async () => {
  const explain = await read("references/explain.md");

  assert.match(explain, /mental model/i);
  assert.match(explain, /terminology bridge/i);
  assert.match(explain, /plain|easy|쉬운/i);
  assert.match(explain, /technical term|canonical term|정식 용어/i);
  assert.match(explain, /Behavior Slice/);
  assert.match(explain, /evidence/i);
  assert.match(explain, /general programming|analogy|general concept/i);
  assert.match(explain, /unsupported|unknown|do not invent|must not invent/i);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --import tsx --test tests/unit/skill-contract.test.ts
```

Expected: the new Explain test FAILS because `references/explain.md` does not exist.

- [ ] **Step 3: Create `references/explain.md`**

Create the file with this operational contract:

```markdown
# Explain

Use Explain after Entry is READY when the user's main gap is terminology, structure, responsibility, flow, contrast, or a walkthrough.

## Goal

Build the smallest useful mental model without disconnecting easy language from the canonical technical term.

Default explanation grammar:

1. Plain-language mental model.
2. Canonical technical term.
3. How that concept appears in the current repository.
4. Evidence-backed flow, contrast, or example only when useful.

This is the Terminology Bridge: easy wording first, formal terminology kept attached.

## Repository grounding

Repository-specific statements must be supported by the current READY Behavior Slice and its evidence. Do not silently add repository entities, states, events, constraints, effects, or failures that are outside the slice.

Keep these categories explicit when needed:

- repository-grounded fact;
- inference from current evidence;
- general programming concept or analogy;
- unknown / unsupported repository claim.

General programming background may clarify a concept, but an analogy is not repository evidence and must not be presented as repository truth.

## Preferred forms

Choose only what improves understanding:

- short explanation;
- terminology bridge;
- example grounded in the current slice;
- contrast between evidenced parts;
- flow walkthrough;
- concise text diagram when it accurately represents the evidenced structure.

Do not add a quiz merely because Verify exists. Do not expand into causal simulation merely because Explore exists.
```

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run:

```bash
node --import tsx --test tests/unit/skill-contract.test.ts
```

Expected: all Task 1 + Task 2 tests PASS.

- [ ] **Step 5: Run `git diff --check` without committing**

Run:

```bash
git -c safe.directory=D:/Projects/Legora diff --check
```

Expected: PASS. Do not stage or commit.

---

### Task 3: Add Explore guidance with the executable-evidence gate

**Files:**
- Modify: `tests/unit/skill-contract.test.ts`
- Create: `references/explore.md`

**Interfaces:**
- Consumes: READY Behavior Slice and the existing executable evidence / causal scenario path in `src/core/`.
- Produces: guidance for causal inspection, scenario comparison, Prediction/Microworld eligibility, and evidence-bounded fallback.

- [ ] **Step 1: Add the failing Explore reference test**

Append:

```ts
test("Explore reference distinguishes inspection from executable Microworld behavior", async () => {
  const explore = await read("references/explore.md");

  assert.match(explore, /Explore.*Microworld|Microworld.*Explore/is);
  assert.match(explore, /not every|not all|broader than/i);
  assert.match(explore, /code navigation|state inspection|timeline|scenario comparison/i);
  assert.match(explore, /executable evidence|evidence gate|evidence-bounded/i);
  assert.match(explore, /Prediction/);
  assert.match(explore, /Microworld/);
  assert.match(explore, /do not invent|must not invent|never invent/i);
  assert.match(explore, /fallback|degrade|inspection|explanation/i);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --import tsx --test tests/unit/skill-contract.test.ts
```

Expected: Explore test FAILS because `references/explore.md` does not exist.

- [ ] **Step 3: Create `references/explore.md`**

Create:

```markdown
# Explore

Use Explore after Entry is READY when the user wants to inspect causality, changed conditions, state/event transitions, scenario differences, or why an evidenced outcome occurs.

## Explore is broader than Microworld

Not every Explore interaction is a Microworld. Prefer the cheapest useful form:

- code navigation through the evidenced slice;
- state inspection;
- timeline or event sequence;
- scenario comparison;
- causal walkthrough;
- Prediction or Microworld only when executable evidence supports a finite scenario.

## Executable evidence boundary

Prediction and Microworld behavior must come through the existing evidence-bounded causal path. A repository claim being plausible is not enough.

Before finite executable behavior, require the existing executable evidence gate to support the needed facts and a validated finite scenario. Never invent missing states, events, guards, transitions, effects, failure paths, observations, or alternative cases.

If executable evidence is insufficient, degrade to evidence-bounded inspection or explanation. State what is known, what is inferred, and what cannot currently be simulated.

## Microworld rule

One Microworld should express one evidence-supported causal lesson. It is not a replica of the whole repository and must not imply coverage beyond the validated scenario.

## User-facing flow

1. Identify the causal question within the READY Behavior Slice.
2. Prefer navigation/inspection when that already answers it.
3. Use Prediction/Microworld only if the executable-evidence path supports it.
4. If the gate fails, explain the evidence gap rather than fabricating behavior.
```

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run:

```bash
node --import tsx --test tests/unit/skill-contract.test.ts
```

Expected: all current Skill contract tests PASS.

- [ ] **Step 5: Re-run the existing causal focused regression**

Run:

```bash
node --import tsx --test tests/unit/core/causal-understanding-flow.test.ts tests/unit/core/causal-scenario.test.ts tests/unit/core/microworld.test.ts tests/unit/core/prediction.test.ts tests/unit/core/transfer-verify.test.ts
```

Expected: existing causal/executable behavior remains PASS; these exact test files are present in the current repository and no production TypeScript change should be needed.

- [ ] **Step 6: Run `git diff --check` without committing**

Run:

```bash
git -c safe.directory=D:/Projects/Legora diff --check
```

Expected: PASS. Do not stage or commit.

---

### Task 4: Add observable-understanding Verify guidance

**Files:**
- Modify: `tests/unit/skill-contract.test.ts`
- Create: `references/verify.md`

**Interfaces:**
- Consumes: READY evidence and existing Prediction / Transfer Verify behavior when evidence supports it.
- Produces: human-understanding verification guidance that avoids permanent mastery claims and general binary-only grading.

- [ ] **Step 1: Add the failing Verify reference test**

Append:

```ts
test("Verify reference evaluates observable understanding without permanent or binary-only claims", async () => {
  const verify = await read("references/verify.md");

  assert.match(verify, /observable/i);
  assert.match(verify, /explain-back/i);
  assert.match(verify, /Prediction/);
  assert.match(verify, /transfer/i);
  assert.match(verify, /confirmed/);
  assert.match(verify, /partial/);
  assert.match(verify, /uncertain/);
  assert.match(verify, /misconception/);
  assert.match(verify, /insufficient_evidence/);
  assert.match(verify, /PASS.*FAIL|binary/is);
  assert.match(verify, /mastery|permanent ability|permanent/i);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```bash
node --import tsx --test tests/unit/skill-contract.test.ts
```

Expected: Verify test FAILS because `references/verify.md` does not exist.

- [ ] **Step 3: Create `references/verify.md`**

Create:

```markdown
# Verify

Use Verify after Entry is READY when the user explicitly wants to check understanding or when a small understanding check is useful before continuing.

Verify evaluates observable evidence in the current interaction. It does not claim access to the user's mind, permanent ability, or permanent mastery.

## Preferred forms

Use the smallest suitable form:

- explain-back: ask the user to restate the relevant mechanism briefly;
- Prediction: ask what happens in an evidenced case;
- transfer verification: when available, use a different evidenced case rather than an unsupported hypothetical;
- concise contrast/debugging question when it targets the current gap.

Do not force Verify when the user asked only for an explanation.

## Result semantics

Do not reduce ambiguous understanding to a general PASS / FAIL binary. Classify only what the response supports:

- `confirmed` — the required idea is clearly present;
- `partial` — a useful part is present but an important piece is missing;
- `uncertain` — the response does not support a confident judgment;
- `misconception` — the response contains a specific contradiction with the evidence;
- `insufficient_evidence` — the interaction does not provide enough evidence to judge the target point.

A result applies to the current observed understanding evidence, not a permanent learner profile.

## Evidence boundary

Prediction or transfer questions must be grounded in evidenced cases. Do not manufacture a supposedly correct answer from unsupported repository behavior. If a second evidenced transfer case does not exist, do not fabricate one.

The Verify capability reports observed understanding evidence; it does not decide the next capability by itself. The Skill/agent chooses the next smallest useful intervention.
```

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run:

```bash
node --import tsx --test tests/unit/skill-contract.test.ts
```

Expected: all Skill contract tests PASS.

- [ ] **Step 5: Run Prediction / Transfer Verify focused regressions**

Run:

```bash
node --import tsx --test tests/unit/core/prediction.test.ts tests/unit/core/transfer-verify.test.ts
```

Expected: PASS. No production TypeScript change should be necessary.

- [ ] **Step 6: Run `git diff --check` without committing**

Run:

```bash
git -c safe.directory=D:/Projects/Legora diff --check
```

Expected: PASS. Do not stage or commit.

---

### Task 5: Enforce public-surface provider/vendor neutrality

**Files:**
- Modify: `tests/unit/skill-contract.test.ts`
- Verify unchanged by this task: `SKILL.md`, `references/explain.md`, `references/explore.md`, `references/verify.md`

**Interfaces:**
- Consumes: four public Skill/reference files from Tasks 1-4.
- Produces: automated boundary that prevents future reintroduction of provider/MCP/vendor-specific public coupling.

- [ ] **Step 1: Add the neutrality test**

Append:

```ts
test("public Skill surface stays provider- and coding-agent-neutral", async () => {
  const files = [
    "SKILL.md",
    "references/explain.md",
    "references/explore.md",
    "references/verify.md",
  ];

  const publicText = (await Promise.all(files.map(read))).join("\n");
  const forbidden = [
    /Cartographer/i,
    /sliceId/,
    /refreshCartographer/,
    /\bMCP\b/,
    /codex\s+(exec|cli|app)/i,
    /claude\s+(code|cli)/i,
    /gemini\s+cli/i,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(publicText, pattern);
  }
});
```

- [ ] **Step 2: Run the focused test**

Run:

```bash
node --import tsx --test tests/unit/skill-contract.test.ts
```

Expected: PASS. Tasks 1-4 define no forbidden provider/vendor terms. If this test is RED, stop and report a plan/spec implementation mismatch rather than weakening the forbidden patterns.

- [ ] **Step 3: Add an acquisition-authority boundary assertion**

Append:

```ts
test("SKILL.md keeps authoritative evidence fields out of agent-authored acquisition proposals", async () => {
  const skill = await read("SKILL.md");

  assert.match(skill, /do not author/i);
  assert.match(skill, /snippet/i);
  assert.match(skill, /history/i);
  assert.match(skill, /timestamps?/i);
  assert.match(skill, /CONFIRMED/i);
  assert.match(skill, /do not write.*repository-knowledge\.json/i);
});
```

- [ ] **Step 4: Run the complete Skill contract suite**

Run:

```bash
node --import tsx --test tests/unit/skill-contract.test.ts
```

Expected: all Skill contract tests PASS.

- [ ] **Step 5: Run `git diff --check` without committing**

Run:

```bash
git -c safe.directory=D:/Projects/Legora diff --check
```

Expected: PASS. Do not stage or commit.

---

### Task 6: Confirm the Skill depends on the real native acquire/refresh loop

**Files:**
- Verify unchanged: `tests/integration/repository-knowledge/native-acquisition-loop.test.ts`

**Interfaces:**
- Consumes: `runLegoraEntry()`, `acquireRepositoryKnowledge()`, R2 ACTIVE/HISTORY behavior, LEGORA-owned `BehaviorSlice`.
- Produces: runtime proof that the public Skill's Entry/acquire/refresh assumptions are true without a provider model.

- [ ] **Step 1: Confirm the existing native acquisition loop remains the canonical runtime proof**

The current test already explicitly proves all of these transitions and should remain unchanged:

```text
empty repository
→ KNOWLEDGE_NOT_FOUND
→ nextAction.type = ACQUIRE_KNOWLEDGE
→ native acquisition
→ READY
→ behaviorSlice.owner = LEGORA
→ source mutation
→ KNOWLEDGE_STALE or KNOWLEDGE_UNKNOWN as appropriate
→ nextAction.type = REFRESH_KNOWLEDGE
→ nextAction.recordIds identifies affected records
→ re-acquisition
→ previous ACTIVE evidence retained in HISTORY when changed
→ READY again
```

- [ ] **Step 2: Run the native integration test**

Run:

```bash
node --import tsx --test tests/integration/repository-knowledge/native-acquisition-loop.test.ts
```

Expected: PASS without any Cartographer model, MCP runtime, network access, or vendor-specific command.

- [ ] **Step 3: Re-run the public Skill contract test**

Run:

```bash
node --import tsx --test tests/unit/skill-contract.test.ts
```

Expected: PASS.

- [ ] **Step 4: Confirm Task 6 made no integration-file edit and check the diff**

Run:

```bash
git -c safe.directory=D:/Projects/Legora diff -- tests/integration/repository-knowledge/native-acquisition-loop.test.ts
git -c safe.directory=D:/Projects/Legora diff --check
git -c safe.directory=D:/Projects/Legora status --short
```

Expected: the first command shows no new R3 modification to the native integration file beyond the already-preserved R2 work; `diff --check` passes; only intended R2/R3 changes remain. Do not stage or commit.

---

### Task 7: Update README with the canonical R3 usage boundary

**Files:**
- Modify: `README.md`
- Modify: `tests/unit/skill-contract.test.ts`

**Interfaces:**
- Consumes: completed `SKILL.md` and references.
- Produces: concise user/developer discovery path without exposing legacy provider internals.

- [ ] **Step 1: Add the failing README discovery assertion**

Append:

```ts
test("README points coding agents to the canonical Skill surface", async () => {
  const readme = await read("README.md");

  assert.match(readme, /SKILL\.md/);
  assert.match(readme, /legora entry/i);
  assert.match(readme, /Explain/);
  assert.match(readme, /Explore/);
  assert.match(readme, /Verify/);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --import tsx --test tests/unit/skill-contract.test.ts
```

Expected: FAIL because the current README documents R2 acquisition and Explain / Explore / Verify concepts but does not yet mention the canonical root `SKILL.md` or `legora entry` usage procedure.

- [ ] **Step 3: Add a concise README R3 usage section**

Under the current status section, add text equivalent to:

```markdown
## Coding-agent usage

The canonical orchestration surface is `SKILL.md`. A coding agent starts a repository-understanding question with `legora entry <question>`, follows any acquire/refresh handshake until Entry is `READY`, then uses `references/explain.md`, `references/explore.md`, or `references/verify.md` for the smallest useful intervention.

The public Skill is provider-neutral. Repository truth, evidence capture, freshness, and Behavior Slice ownership remain enforced by the Legora runtime rather than by prose in the Skill.
```

Do not add provider installation instructions or vendor-specific commands.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run:

```bash
node --import tsx --test tests/unit/skill-contract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run `git diff --check` without committing**

Run:

```bash
git -c safe.directory=D:/Projects/Legora diff --check
```

Expected: PASS. Do not stage or commit.

---

### Task 8: Full R3 closure and regression gate

**Files:**
- Verify all R2/R3 changed files; make no unrelated refactors.

**Interfaces:**
- Consumes: all prior R3 tasks plus existing R2 implementation.
- Produces: evidence that R3 meets the spec without regressing native acquisition, causal behavior, or legacy compatibility.

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run all unit tests**

Run:

```bash
npm test
```

Expected: all tests PASS, including `tests/unit/skill-contract.test.ts`.

- [ ] **Step 3: Run legacy real-model integrations**

Run:

```bash
npm run test:integration:cartographer-real
npm run test:integration:causal-real
```

Expected: both PASS. These are compatibility regressions only; public R3 files remain provider-neutral.

- [ ] **Step 4: Run all Repository Knowledge integrations including the native loop**

Run:

```bash
node --import tsx --test tests/integration/repository-knowledge/*.test.ts
```

Expected: all Repository Knowledge integration tests PASS, including the provider-neutral native acquisition loop.

- [ ] **Step 5: Audit the public Skill surface for forbidden coupling**

Run:

```powershell
$files = @('SKILL.md','references/explain.md','references/explore.md','references/verify.md')
Select-String -Path $files -Pattern 'Cartographer|sliceId|refreshCartographer|\bMCP\b|Codex CLI|Claude Code|Gemini CLI' -CaseSensitive:$false
```

Expected: no matches.

- [ ] **Step 6: Scan plan deliverables for accidental placeholders**

Run:

```powershell
Select-String -Path SKILL.md,references\*.md -Pattern 'T[B]D|T[O]DO|F[I]XME|implement[ ]later' -CaseSensitive:$false
```

Expected: no matches.

- [ ] **Step 7: Run final diff/status checks**

Run:

```bash
git -c safe.directory=D:/Projects/Legora diff --check
git -c safe.directory=D:/Projects/Legora status --short
git -c safe.directory=D:/Projects/Legora diff --stat
```

Expected: `diff --check` PASS; status contains only preserved R2 changes plus intended R3 spec/plan/Skill/reference/test/README changes. Do not stage, commit, or push.

- [ ] **Step 8: Report closure using fresh evidence**

Report these exact categories:

```text
R3 Skill contract tests       PASS / FAIL
Typecheck                     PASS / FAIL
All unit tests                <passed>/<total>
Legacy Cartographer real      PASS / FAIL
Legacy causal real            PASS / FAIL
Repository Knowledge real     <passed>/<total>
Public provider neutrality    PASS / FAIL
Placeholder scan              PASS / FAIL
diff --check                  PASS / FAIL
Git state                     uncommitted; no commit/push
```

Do not claim R3 complete if any mandatory gate fails.
