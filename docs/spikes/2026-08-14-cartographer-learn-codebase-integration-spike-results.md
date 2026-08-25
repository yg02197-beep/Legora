# Legora — Cartographer + learn-codebase Integration Spike Results

## 0. Status

- Project: **Legora**
- Date: 2026-08-14
- Spike: Cartographer + learn-codebase integration feasibility
- Result: **PARTIAL PASS — semantic adapter proof PASS, upstream local runtime acquisition BLOCKED by host environment safety policy**
- Production implementation: **not started**
- Commit / push: **not performed**

## 1. Question

Can Legora avoid rebuilding code-understanding and Socratic-learning infrastructure by reusing:

1. `miltonian/cartographer` as an evidence / behavior world-model provider, and
2. `ktaletsk/learn-codebase` as a prediction / verification learning provider,

while keeping Legora's own semantic contracts authoritative?

## 2. Sources Reviewed

### Cartographer

- Repository: `https://github.com/miltonian/cartographer`
- Architecture: `https://github.com/miltonian/cartographer/blob/main/docs/architecture.md`
- License: MIT, as exposed by the repository.

Observed public contract:

- behavior-first analysis
- entities / relationships / behavior slices
- source evidence anchors
- confidence levels: `proven`, `high`, `medium`, `low`, `speculative`
- MCP tools including project selection, entity/relationship/slice writes, query, entity lookup, summary, snapshot/restore, and map opening
- local Node service owns the persistent world model
- browser UI is a projection and does not own semantic truth
- model persistence is documented as `{project_root}/.cartographer/model.json`
- stale entity detection is documented as roadmap, not current capability

### learn-codebase

- Repository: `https://github.com/ktaletsk/learn-codebase`
- Skill: `https://raw.githubusercontent.com/ktaletsk/learn-codebase/main/SKILL.md`
- Question patterns: `https://raw.githubusercontent.com/ktaletsk/learn-codebase/main/QUESTION-PATTERNS.md`
- Journal template: `https://raw.githubusercontent.com/ktaletsk/learn-codebase/main/JOURNAL-TEMPLATE.md`
- License: MIT

Observed public contract:

- Ask before telling
- Predict before revealing
- partial answers are probed rather than collapsed to pass/fail
- graduated hints
- transfer / changed-condition questions
- read-only repository exploration during learning
- one concept per exchange
- persistent `.claude/learning-journal.md`
- concept mastery levels and spaced review

## 3. Environment Blocker

The spike attempted to acquire both upstream repositories into Legora's ignored `.chatgpt2codex/spikes/` area.

### Attempt 1 — `git clone` through generic local shell

Result:

`OPERATION_NOT_APPROVABLE`

Reason:

The host environment does not permit free-form network shell execution through the generic shell provider.

### Attempt 2 — approved network acquisition path, two ZIPs

Result:

`ACQUISITION_ATOMIC_PUBLISH_UNSUPPORTED`

Reason:

multi-item archive publication is not proven atomic.

### Attempt 3 — approved network acquisition path, Cartographer ZIP only

Result:

`ACQUISITION_FORMAT_UNSAFE`

Reason:

repository ZIP contains active-content file extensions.

Therefore the upstream repositories were **not copied into Legora**, were **not built locally**, and no claim is made that Cartographer's current `main` build was executed successfully on this machine.

This is an environment/policy blocker for the runtime portion of the spike, not evidence that either upstream project is broken.

## 4. Executed Adapter Proof

A zero-dependency TypeScript proof was created only under ignored:

`.chatgpt2codex/spikes/adapter-proof/`

Node environment:

- Node `v24.13.1`
- npm `11.8.0`
- standalone `tsc` not installed
- Node 24 executed the erasable TypeScript proof directly

The proof intentionally does **not** vendor or imitate the full upstream implementation. It tests the semantic boundary Legora would need.

### RED

Command:

`node --test .chatgpt2codex\\spikes\\adapter-proof\\adapter-proof.test.ts`

Result:

- tests: 5
- pass: 0
- fail: 5
- failure reason: adapter functions deliberately `not implemented`

### GREEN

After minimal adapter implementation:

- tests: 5
- pass: 5
- fail: 0

Passing contracts:

1. Cartographer confidence is normalized without strengthening evidence.
2. A Cartographer `proven` claim without a source anchor cannot become Legora `CONFIRMED`.
3. Legora `BehaviorSlice` remains a Legora-owned projection referencing normalized evidence IDs.
4. learn-codebase's predict / partial-probe / transfer behavior can be retained without persistent journal or spaced review.
5. explicit user preference can disable Socratic verification pressure, preserving Legora's `Explicit User Intent > Automatic Routing` rule.

## 5. Confidence Mapping Finding

The initial plan was too permissive for Cartographer `speculative` evidence.

Cartographer documents:

- `proven` — directly observed in source
- `high` — one inference step
- `medium` — synthesized inference
- `low` — educated guess
- `speculative` — hypothesis, not yet verified

Legora must not strengthen that scale.

Accepted spike mapping:

```text
Cartographer     Legora
--------------------------
proven        -> CONFIRMED   only when a source anchor exists
high          -> INFERRED
medium        -> INFERRED
low           -> INFERRED
speculative   -> UNKNOWN
missing anchor-> UNKNOWN
```

This is deliberately lossy in the conservative direction.

If Legora later needs to preserve Cartographer's five-level confidence internally, it should retain `sourceConfidence` alongside the coarser Legora confidence rather than inventing stronger claims.

## 6. Cartographer Decision

### Verdict

**ADAPT — runtime evidence/world-model backend candidate**

### Use directly

- behavior-first model
- evidence anchors
- confidence / provenance
- entity and relationship queries
- behavior slices
- MCP interface
- persistent provider cache

### Do not duplicate in Legora

- whole-repository persistent world model
- generic architecture map engine
- Cartographer ontology database
- React Flow architecture UI

### Legora boundary

Cartographer's world model should remain the provider model.

Legora should create only a question-scoped, ephemeral projection:

```text
Cartographer World Model
        ↓
Cartographer Adapter
        ↓
Legora BehaviorSlice
(question-scoped / ephemeral)
        ↓
Understanding Router
```

`BehaviorSlice` therefore should **not** become a second persistent repository knowledge graph.

### Storage conflict

Cartographer documents persistence at:

`{project_root}/.cartographer/model.json`

This violates the strongest version of the earlier Legora rule "target repository receives no writes at all."

However, it does not require changing tracked application source.

#### Recommended MVP policy

Relax the rule from:

> target repository is physically read-only

to:

> target repository source and tracked product files are not modified; provider-local caches are allowed when excluded from Git.

Under that policy Cartographer can be used substantially as-is.

Legora canonical Understanding Assets remain outside the target repository.

If a later product requirement demands literally zero writes under the target root, then Cartographer needs either:

- an upstream storage-path configuration feature, or
- a narrow fork/patch injecting an external model path.

The current spike did not prove whether an undocumented storage-path override already exists because the source archive could not be acquired and executed locally. Therefore **"fork required" is not yet confirmed**.

## 7. learn-codebase Decision

### Verdict

**ADAPT — policy source; do not make it a mandatory runtime dependency for default Legora mode**

### Reuse

- prediction before reveal
- one-step probing for partial answers
- graduated scaffolding ideas
- changed-condition / transfer prediction
- evidence questions
- explain-back instead of "does that make sense?"

### Do not inherit into default MVP

- mandatory `.claude/learning-journal.md`
- persistent mastery map
- automatic spaced-review queue
- rule that every interaction must ask before telling

These conflict with existing Legora decisions:

- explicit user intent can request an immediate answer
- MVP does not keep a persistent learner profile
- verification is used when justified rather than forced on every interaction

### Best integration shape

For default Legora:

```text
learn-codebase patterns
        ↓
Legora VerificationPolicy
        ↓
Router-controlled Verify
```

For a future explicit **Learner Mode**, the full upstream skill can be considered as a more direct integration because persistent journal / spaced review become desirable there.

## 8. Revised Legora Architecture

The spike argues against treating Legora as a large standalone analysis application.

Recommended structure:

```text
AI Coding Environment
        │
        ▼
    Legora Skill
        │
        ▼
Understanding Router
        │
        ├──────── Evidence Provider
        │              │
        │       Cartographer Adapter
        │              │
        │       Cartographer World Model
        │
        ▼
Question-scoped BehaviorSlice
        │
   ┌────┼─────────┐
   ▼    ▼         ▼
Explain Explore  Verify
                  │
          learn-codebase-derived
          VerificationPolicy
        │
        ▼
Understanding Asset Store
```

The key distinction is:

- Cartographer owns repository-scale behavior knowledge.
- Legora owns human-understanding orchestration.
- `BehaviorSlice` is an adapter/projection boundary, not a competing world-model database.
- learn-codebase supplies pedagogical policy patterns; Legora Router decides when they apply.

## 9. Understanding Asset Consequence

Because Cartographer stale detection is not currently a documented completed capability, Legora cannot delegate Understanding Asset freshness entirely to Cartographer.

When an Understanding Asset is saved, Legora should snapshot enough evidence metadata to re-check it independently:

- repository revision
- source paths
- source ranges / anchors where available
- evidence confidence
- provider evidence IDs where available
- preferably content/range hashes in a later implementation

This preserves the existing Legora asset rule:

> immutable original + explicit stale detection + explicit revalidation

Even if the provider model later changes.

## 10. Product Differentiation Check

The spike also weakens one proposed Legora differentiation claim.

Cartographer itself already explicitly frames understanding around behavior and prediction and already provides evidence-grounded behavior flows.

Therefore Legora should **not** claim these alone as its unique value:

- behavior-first code understanding
- evidence-grounded world model
- "understanding means prediction" as a philosophy

Legora's defensible product boundary is the layer Cartographer does not primarily implement:

```text
current human understanding gap
        ↓
Least Sufficient Intervention
        ↓
Explain / Explore / Verify routing
        ↓
optional causal interactive artifact
        ↓
human prediction / transfer evidence
        ↓
persistent Understanding Asset lifecycle
```

This is a narrower but stronger definition.

## 11. Final Decisions

| Component | Decision | Confidence | Notes |
|---|---|---:|---|
| Cartographer world model | ADAPT | High | Strong provider fit; runtime local build not executed due acquisition policy |
| Cartographer MCP transport | ADAPT | Medium-High | Public MCP surface is clear; exact response schema transport proof remains pending |
| Cartographer storage | USE AS LOCAL PROVIDER CACHE for MVP | Medium | Requires accepting `.cartographer/` under target root; strict zero-write mode remains unresolved |
| Legora persistent world model | DO NOT BUILD | High | Duplicate of provider capability |
| Legora BehaviorSlice | KEEP, but EPHEMERAL | High | Question-scoped normalization/projection boundary |
| learn-codebase full runtime skill | NOT DEFAULT DEPENDENCY | High | Journal and always-Socratic behavior conflict with MVP rules |
| learn-codebase prediction/verification patterns | ADAPT | High | MIT and cleanly separable at policy level |
| Legora persistent learner profile | DO NOT BUILD in MVP | High | Existing design decision remains valid |

## 12. Next Recommended Spike

Do **not** scaffold a full Legora app yet.

Next highest-value proof:

### `Cartographer → Legora → Understanding Asset` Vertical Spike

On one disposable target repository:

1. run Cartographer through its actual MCP/service surface,
2. query one confirmed behavior flow and evidence anchors,
3. normalize that into an ephemeral Legora `BehaviorSlice`,
4. route one causal question,
5. perform one prediction/partial-answer interaction using the adapted verification policy,
6. save one Understanding Asset outside the target repository,
7. change the fixture source and prove Legora marks the asset stale independently of Cartographer.

This is the first spike that would prove the full Legora-specific value instead of only adapter compatibility.

Current blocker for that exact runtime proof is that the host environment does not permit acquisition or execution of active-content repository archives through the approved network path.
