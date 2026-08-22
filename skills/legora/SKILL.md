---
name: legora
description: Understand how a repository behaves using current source evidence. Use for questions about code flow, responsibilities, states, causality, failures, interactions, or when a user wants to understand why repository behavior occurs.
metadata:
  legora-managed: "true"
  legora-skill-schema: "1"
---
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

- Terminology, structure, role, flow, contrast, or walkthrough: read `references/explain.md`.
- Causality, changed conditions, state/event transitions, or scenario inspection: read `references/explore.md`.
- Explicit understanding check, explain-back, prediction, or transfer check: read `references/verify.md`.
- If the repository evidence is insufficient, acquire or refresh before capability output.
- If there is no remaining understanding gap, stop.

A safe explicit user preference overrides the default route. Do not force a fixed Explain -> Explore -> Verify sequence.

## Grounding boundary

Repository-specific claims must come from the current READY Behavior Slice and supporting evidence. Keep repository-grounded facts, evidence-based inference, general programming background/analogy, and unknown claims distinct. Never turn an analogy into repository truth.
