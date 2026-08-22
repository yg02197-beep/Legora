---
name: legora
description: Use Legora first for repository-understanding questions about code flow, responsibilities, states, causality, failures, interactions, or why behavior occurs. Run Legora Entry before direct repository Grep/Read when existing Repository Knowledge may answer the question.
metadata:
  legora-managed: "true"
  legora-skill-schema: "1"
---
# Legora

Legora helps a coding agent answer repository-understanding questions by grounding repository-specific claims in current Repository Knowledge and a LEGORA-owned Behavior Slice.

## Mandatory procedure

1. For a repository-understanding question, run `legora entry <natural-language question>` before direct repository Grep/Read or a Legora-grounded repository explanation.
2. Inspect the returned `status` and `nextAction`.
3. If `status` is `KNOWLEDGE_CANDIDATES` and `nextAction.type` is `REVIEW_KNOWLEDGE_CANDIDATES`, review the returned candidate metadata before reading or searching the repository. Compare the question only with candidate identity, subject, structure, confidence, and match metadata; do not start repository investigation merely because the initial match was uncertain.
4. If one candidate covers the question, re-run `legora entry --candidate <record-id> <question>`. This confirms the reviewed candidate and lets Legora perform freshness checks before READY.
5. If none of the returned candidates cover the question, re-run `legora entry --reject-candidates <question>`. Do not inspect repository source for acquisition until this returns `KNOWLEDGE_NOT_FOUND` with `ACQUIRE_KNOWLEDGE`.
6. If `status` is `KNOWLEDGE_NOT_FOUND` and `nextAction.type` is `ACQUIRE_KNOWLEDGE`, treat acquisition as the last resort: inspect only the repository region needed for the current question, build a simple acquisition from source locators, submit it through `legora knowledge acquire`, and re-run `legora entry <question>`. Run `legora knowledge acquire --example` when the agent-facing input shape is needed.
7. If `status` is `KNOWLEDGE_STALE` or `KNOWLEDGE_UNKNOWN` and `nextAction.type` is `REFRESH_KNOWLEDGE`, refresh only `nextAction.recordIds` and directly required supporting code, submit through `legora knowledge acquire`, and re-run Entry.
8. Do not present repository-specific Explain / Explore / Verify output as Legora-grounded before READY.
9. When `status` is `READY`, choose the smallest useful intervention: Explain, Explore, Verify, or Stop.

## Acquisition boundary

Prefer the simple acquisition contract: `entity`, `flow`, or `relationship`, with a subject, human-readable names or steps, and `filePath` / `lineStart` / `lineEnd` locators. Submit it without internal record IDs, internal `kind` strings, or Legora-owned structure JSON; Legora generates those fields and captures source evidence itself. The legacy full proposal remains accepted for compatibility, but it is not the normal agent path.

If acquisition returns `EXISTING_KNOWLEDGE` / `EXISTING_KNOWLEDGE_CANDIDATE`, do not create another record or continue repository investigation. Return to Entry and recover the reported existing knowledge instead.

Do not author evidence snippets, history, timestamps, ACTIVE/HISTORY transitions, or CONFIRMED evidence status. Do not write `.legora/repository-knowledge.json` directly.

Do not perform mandatory whole-repository pre-analysis. Gather only what the current question and affected records require.

## Capability routing

- Terminology, structure, role, flow, contrast, or walkthrough: read `references/explain.md`.
- Causality, changed conditions, state/event transitions, or scenario inspection: read `references/explore.md`.
- Explicit understanding check, explain-back, prediction, or transfer check: read `references/verify.md`.
- If the repository evidence is insufficient, acquire or refresh before capability output.
- If there is no remaining understanding gap, stop.

A safe explicit user preference overrides the default route. Do not force a fixed Explain -> Explore -> Verify sequence.

## Grounding boundary

Repository-specific claims must come from the current READY Behavior Slice and supporting evidence. Keep repository-grounded facts, evidence-based inference, general programming background/analogy, and unknown claims distinct. Never turn an analogy into repository truth.
