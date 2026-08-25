# R5 Live Compatibility Validation — 2026-08-22

Status: PARTIAL_VALIDATION

## Scope

This validation intentionally closes the Codex live gate only. Claude Code and Gemini CLI live compatibility remain incomplete by user decision and are not treated as PASS.

## Versions

- Legora package: `0.1.0`
- Codex CLI: `codex-cli 0.147.0`
- Claude Code: not live-tested in this validation
- Gemini CLI: not live-tested in this validation

## Managed Skill

Codex user-scope target:

`<HOME>\.agents\skills\legora`

`legora doctor --agent codex --json` reported:

- status: `READY`
- cliRuntime: `PASS`
- canonicalSkillFormat: `PASS`
- executable: `PASS`
- installTarget: `PASS`
- managedDigest: `PASS`
- nativeDiscovery: `NOT_PROBED` by Doctor; activation is proven by the live Codex traces below.

## Controlled Question

`How does request routing work in this repository, and what makes the routing decision?`

Each run used a fresh disposable copy of the R4 external fixture and the packed Legora CLI on PATH. The target repository did not contain Legora, TypeScript, `tsx`, an agent-specific instruction file, or a pre-existing `.legora` store.

## Codex Explicit Activation

Prompt explicitly invoked `$legora`.

Result: PASS

Observed invariant:

1. first Legora runtime command: `legora entry <question>`
2. Entry returned `KNOWLEDGE_NOT_FOUND` with `ACQUIRE_KNOWLEDGE`
3. Codex inspected the bounded routing source area
4. Codex invoked `legora knowledge acquire`
5. Codex invoked `legora entry <question>` again
6. Entry reached `READY`
7. grounded repository answer followed READY

Post-run Repository Knowledge:

- `.legora/repository-knowledge.json`: present
- active records: 4

## Codex Implicit Trigger

Prompt contained only the natural repository question and did not name Legora.

Result: PASS

The same Entry-first / acquire / READY ordering was observed. The final answer was grounded in `src/router.ts` and explained that routing is decided by `path.startsWith("/auth")`, with unmatched paths falling through to billing.

Post-run Repository Knowledge:

- `.legora/repository-knowledge.json`: present
- active records: 4

## Authority / Safety Review

Codex used the public Legora CLI for acquisition and re-entry. No Legora source path was found that writes `.cartographer/port`, and the authoritative Repository Knowledge store was produced through the normal `legora knowledge acquire` path rather than by direct store editing.

The disposable runtime also contained `.cartographer/port` with the same 4-byte port value in both Codex runs. This is recorded as a host/runtime artifact, not as a Legora-managed repository artifact. It does not change the Codex semantic compatibility verdict, but it is excluded from claims that the full host environment leaves only `.legora` behind.

## Gate Verdicts

- Gate C — Codex Discovery & Compatibility: PASS
  - explicit activation: PASS
  - implicit trigger: PASS
  - Entry-first: PASS
  - acquire handshake: PASS
  - READY-before-grounded-answer: PASS
  - Repository Knowledge creation: PASS

- Gate D — Claude Code Discovery & Compatibility: INCOMPLETE / NOT_RUN
- Gate E — Gemini CLI Discovery & Compatibility: INCOMPLETE / NOT_RUN
- Gate F — Cross-Agent Semantic Parity: INCOMPLETE because Claude and Gemini live gates are not run

## Overall R5 Verdict

`R5_NOT_COMPLETE`

Deterministic R5 implementation and Codex live compatibility are validated. R5 completion remains intentionally withheld until the remaining live gates are executed and pass. This document must not be interpreted as three-agent compatibility evidence.
