# Legora Existence-Value E2E Spike Results

Date: 2026-08-21

## Verdict

**CORE PRODUCT-VALUE SPIKE: PASS**

**ACTUAL CARTOGRAPHER RUNTIME INTEGRATION: BLOCKED_BY_ENVIRONMENT_POLICY**

**HUMAN UNDERSTANDING VERIFICATION: PENDING_USER_RESPONSE**

The spike proves that a Legora-owned layer can add behavior beyond a provider's repository model: it can normalize evidence conservatively, form a question-specific BehaviorSlice, route a causality gap into prediction-first exploration, generate an evidence-bounded executable Microworld, reject unsupported extrapolation, prepare transfer verification, and persist/reopen the result as an Understanding Asset.

It does **not** prove that the official Cartographer runtime is integrated, and it does **not** claim that a human has demonstrated understanding yet.

---

## 1. Fixture Behavior

A disposable fixture under `.chatgpt2codex/spikes/existence-value-e2e/fixture/` models simultaneous expired-token requests.

Verified behavior:

- 2 simultaneous requests + lock ON -> 1 refresh, max active refreshes 1
- 2 simultaneous requests + lock OFF -> 2 refreshes, max active refreshes 2
- 5 simultaneous requests + lock ON -> 1 refresh, max active refreshes 1

TDD cycle:

- RED: implementation module missing
- GREEN: 3/3 fixture tests pass

The fixture is intentionally small: one causal lesson only.

---

## 2. Provider Boundary

The official Cartographer runtime could not be installed from this execution environment. Claude Code 2.1.45 is locally installed, but Cartographer is not installed and the generic shell provider rejects network-enabled marketplace installation.

Therefore this spike uses a **Cartographer-compatible provider snapshot**, not Cartographer itself.

The snapshot is not invented independently of the fixture. Its `proven` claims carry line-anchored evidence read from the actual fixture source and tests.

Confidence normalization is Legora-owned:

```text
provider proven + source anchor -> CONFIRMED
provider high/medium/low + anchor -> INFERRED
provider speculative -> UNKNOWN
provider proven without anchor -> UNKNOWN
```

This prevents a provider confidence label from strengthening unsupported behavior.

Current Cartographer source/reference reviewed for the adapter contract:

- https://github.com/miltonian/cartographer
- behavior-first world model
- evidence with `proven/high/medium/low/speculative`
- MCP surfaces including set-project/query/get-entity/write-slice

---

## 3. Legora-Owned BehaviorSlice

The provider snapshot is projected into a Legora-owned, question-specific slice:

```text
subject
participants
states
events
flows
constraints
effects
failures
evidenceRefs
executableEvidenceRefs
```

`executableEvidenceRefs` contains only normalized `CONFIRMED` evidence.

This is intentionally an ephemeral understanding projection, not a second persistent world-model database.

---

## 4. Understanding Routing

Input gap:

```text
causality
```

Legora route:

```text
PREDICTION
-> MICROWORLD
-> TRANSFER_VERIFY
```

This is the first product-value boundary that is not supplied by the repository-model provider: the system decides what the human needs next rather than merely returning facts about the code.

---

## 5. Evidence-Bounded Microworld

The generated projection contains only three executable scenarios because only three scenarios are confirmed by repository evidence:

```text
two-lock-on
two-lock-off
five-lock-on
```

The combination:

```text
5 requests + lock OFF
```

is deliberately **not** extrapolated, even though a generic simulation could easily guess the result. `simulateProjection()` rejects it with `NOT_EVIDENCED`, and the HTML artifact renders `Not evidenced` instead of an invented result.

This is the strongest positive result of the spike: executable teaching behavior is bounded by evidence rather than by what the renderer/LLM can plausibly imagine.

---

## 6. Transfer Verification

A transfer prediction is generated from the separately confirmed five-request scenario:

> Five expired requests arrive simultaneously while the refresh lock is ON. How many refresh operations occur?

Expected answer: `1`

The evaluator correctly distinguishes correct vs. incorrect responses, but no real user response was collected in this spike.

Therefore:

```text
human_understanding.status = PENDING_USER_RESPONSE
```

No mastery or understanding claim is made.

---

## 7. Understanding Asset

Generated live asset:

```text
.chatgpt2codex/spikes/existence-value-e2e/assets/ua-d929d842ebe8/
```

Contains:

```text
manifest.json
evidence.json
status.json
validations.json
behavior-slice.json
route.json
projection.json
verification.json
artifact.html
```

Repository revision for the disposable fixture is represented by a SHA-256 digest over fixture source + tests because the spike intentionally makes no Git commit.

The asset is reopenable and retains:

- evidence
- BehaviorSlice
- route decision
- Microworld projection
- verification prompt
- freshness state
- validation state
- self-contained HTML artifact

---

## 8. Browser Runtime Proof

The live `artifact.html` was served locally and executed with installed Google Chrome in headless mode.

Observed DOM results:

```text
2 requests + lock ON
-> Refresh count: 1 | Max active refreshes: 1

2 requests + lock OFF
-> Refresh count: 2 | Max active refreshes: 2

5 requests + lock OFF
-> Not evidenced: this combination is outside confirmed repository evidence.
```

Artifact runtime validation was therefore updated to `PASS`.

The available browser-region screenshot helper is currently macOS-only, so Windows screenshot capture was unavailable; Chrome headless DOM execution was used instead.

---

## 9. Automated Verification

Fresh combined run after test isolation fix:

```text
fixture tests: 3 PASS
pipeline tests: 7 PASS
total: 10 PASS / 0 FAIL
```

Pipeline coverage includes:

1. actual source/test evidence anchoring
2. confidence non-strengthening
3. Legora-owned BehaviorSlice
4. prediction-first causality routing
5. evidence-bounded Microworld execution
6. transfer verification without false mastery claims
7. Understanding Asset persistence/reopen

---

## 10. Product-Value Criterion

The spike's product-value criterion was:

> Legora must add something materially different from `provider output -> explain this`.

Observed additions:

1. **Human-gap routing** — PASS
2. **Prediction before reveal** — PASS
3. **Evidence-bounded executable projection** — PASS
4. **Transfer verification capability** — PASS
5. **Persistent Understanding Asset** — PASS

Therefore the **core existence-value criterion passes at prototype/spike level**.

However, this is not yet a production MVP result because the most important external integration gate remains unresolved:

```text
Official Cartographer runtime
-> actual MCP/provider output
-> Legora adapter
```

That gate must pass before Cartographer can be treated as the default backend.

---

## 11. Next Gate

The next gate is intentionally narrow:

```text
Official Cartographer runtime on a disposable target
-> one real behavior slice from Cartographer MCP/service
-> same Legora normalization contract
-> compare with this provider-contract spike
```

If the real Cartographer output fits the Legora boundary without substantial duplication, proceed with the thin orchestration architecture.

If integration requires rebuilding most of Cartographer's semantics or Legora merely reformats Cartographer output, reconsider the product boundary before production implementation.

---

## 12. Repository Hygiene

- Spike implementation lives only under ignored `.chatgpt2codex/spikes/`.
- No upstream Cartographer code is vendored.
- No production scaffold was added.
- No commit or push was performed.
- Global Git `safe.directory` was not modified.
