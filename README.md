# Legora

Legora는 실제 코드 근거를 바탕으로 사람이 복잡한 소프트웨어의 동작을 이해하고, 예측하고, 판단하도록 돕는 Human Understanding 시스템입니다.

## 핵심 구조

```text
Understanding Router
├─ Explain
├─ Explore
└─ Verify
```

Repository에서 필요한 근거만 조사해 Behavior Slice를 만들고, 사용자의 현재 이해에 충분한 가장 작은 개입을 선택합니다. Microworld는 인과관계를 직접 조작하고 관찰해야 할 때만 사용하는 Explore 수단입니다.

## MVP 원칙

- Human Understanding을 최상위 목적으로 둡니다.
- 설명과 실행 모델은 실제 코드 근거에 연결합니다.
- 가장 작은 충분한 개입을 선택합니다.
- 하나의 Microworld는 하나의 인과관계만 다룹니다.
- 근거가 부족하면 더 단순하고 안전한 설명으로 전환합니다.

## 상태

Repository Knowledge Native Acquisition R2가 구현되어 있습니다. coding agent는 `legora knowledge acquire`에 proposal JSON을 전달할 수 있고, Legora는 구조를 검증한 뒤 실제 repository source에서 evidence를 직접 캡처해 ACTIVE/HISTORY Knowledge를 원자적으로 저장합니다.

Entry는 질문에 필요한 Knowledge가 없으면 `ACQUIRE_KNOWLEDGE`, 선택된 Knowledge가 stale/unknown이면 `REFRESH_KNOWLEDGE`를 반환하며, 검증된 현재 Knowledge가 있을 때만 LEGORA-owned Behavior Slice를 제공합니다.

Standalone External Repository Validation R4를 통과했습니다. production package는 plain Node.js `dist` CLI로 실행되며 대상 repository에 Legora, `tsx`, TypeScript를 설치하지 않고도 acquire/READY/stale/refresh lifecycle, repository isolation, fail-closed 경계가 검증되었습니다. 실제 repository를 사용한 단일 coding-agent pilot에서도 Entry-first orchestration과 evidence-bounded Explain이 확인되었습니다. 이 결과는 multi-agent 호환성이나 remote repository 지원을 의미하지 않습니다.

R5의 portable Agent Skill과 user-scope bootstrap/doctor deterministic 경계가 구현되어 있습니다. canonical Skill은 `skills/legora/` 하나이며 `legora bootstrap`은 Codex/Gemini 공유 `$HOME/.agents/skills/legora`와 Claude Code `$HOME/.claude/skills/legora`에 Legora-managed copy만 설치·갱신합니다. `legora doctor`는 read-only 진단만 수행합니다. Codex CLI 0.147.0에서는 explicit `$legora`와 자연어 implicit trigger 모두 실제 `Entry → acquire → READY → grounded answer` workflow가 관찰되어 Gate C가 PASS했습니다. Claude Code와 Gemini CLI live gate는 아직 실행하지 않았으므로 전체 R5는 `R5_NOT_COMPLETE` 상태입니다.

Cartographer 지원은 Repository Knowledge로 가져오기 위한 legacy import compatibility 경계로만 유지합니다.

## Coding-agent usage

The canonical orchestration surface is `skills/legora/SKILL.md`. A coding agent starts a repository-understanding question with `legora entry <question>`, follows any acquire/refresh handshake until Entry is `READY`, then uses the colocated `references/explain.md`, `references/explore.md`, or `references/verify.md` for the smallest useful Explain / Explore / Verify intervention. The repository-root `SKILL.md` is only a compatibility pointer.

The public Skill is provider-neutral. Repository truth, evidence capture, freshness, and Behavior Slice ownership remain enforced by the Legora runtime rather than by prose in the Skill.
