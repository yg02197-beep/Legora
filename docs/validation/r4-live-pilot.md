# R4 Live Coding-Agent Pilot

Status: R4_COMPLETE

## Pilot target

- repository: `<EXTERNAL_REPOSITORY_PATH>`
- question: `POP3 메일을 발견한 뒤 AI enrichment까지 어떤 순서로 처리되는가?`
- agent: `ChatGPT + asd2`
- Legora interface: packed standalone CLI plus root `SKILL.md` / `references/`

## Procedure

1. Capture target pre-run state without modifying the repository.
2. Run the installed standalone `legora entry <question>` as the first Legora command.
3. Follow `ACQUIRE_KNOWLEDGE` / `REFRESH_KNOWLEDGE` exactly if returned.
4. Explore only the code needed to answer the behavior-flow question.
5. Submit only candidate identity, vendor-neutral structure, and evidence locators to `legora knowledge acquire`.
6. Re-run Entry until `READY` before producing repository-grounded Explain / Explore / Verify output.
7. Record CLI statuses, published record IDs, active-evidence paths, user-visible intervention, and post-run repository state.
8. Do not collect or record private chain-of-thought.

## Pre-run repository state

- existing `.legora`: `false`
- existing `.git`: `false`
- source/control manifest (excluding `.venv`, caches, `.legora`): captured
- exact source/control manifest: captured outside the target repository for post-run byte comparison

## Observed evidence

- entry_first: `true`; the first Legora command returned exit `3`, `KNOWLEDGE_NOT_FOUND`, and `ACQUIRE_KNOWLEDGE`
- acquisition_handshake: `true`; bounded source discovery occurred only after that handshake, then `legora knowledge acquire` returned `ACQUIRED`
- ready_before_grounded_output: `true`; the second Entry returned exit `0`, `READY`, `nextAction: null`, and all selected Knowledge records were `CURRENT` before the grounded intervention was written
- published_record_ids:
  - `native:entity:watch-new-mail`
  - `native:entity:lexical-stage`
  - `native:entity:semantic-stage`
  - `native:entity:enrichment-stage`
  - `native:flow:pop3-to-ai-enrichment`
- source_files_in_active_evidence: `src/<MODULE>/cli.py` only
- pre_run_repository_state: CAPTURED
- post_run_repository_state: `PASS`; the captured source/control manifest remained byte-for-byte identical and the only `.legora` entry was `repository-knowledge.json`
- explain_acceptance: `PASS`
- explore_acceptance: `NOT_REQUIRED`
- verify_acceptance: `NOT_REQUIRED`
- result: `R4_COMPLETE`
- notes: no direct store edit was performed; the agent submitted evidence locators and Legora captured snippets/provenance itself

## Observed grounded Explain

쉽게 보면 이 흐름은 **새 메일을 저장한 뒤 정규화하고, R2에서 검색용 처리부터 끝낸 다음 준비된 AI 단계로 넘어가는 파이프라인**입니다.

```text
POP3 새 메일 감지
→ collect로 새 메일 저장
→ canonical parse
→ R2 work discover / lexical 처리
→ semantic 처리 (설정 + 모델/runtime 준비 시)
→ AI enrichment (AI enrichment가 enabled일 때)
```

`watch`의 새 메일 처리 함수는 먼저 collect를 실행하고, 실제로 새로 저장되거나 복구된 메일이 없으면 거기서 끝납니다. 새 메일이 있으면 parse를 실행하고, parse가 성공해야 `_r2_process`로 넘어갑니다. R2에서는 interrupted work 복구와 work discovery 후 lexical pending을 먼저 처리합니다. 그 다음 semantic은 활성화되어 있고 선택된 모델/runtime이 준비됐을 때만 실행됩니다. 마지막으로 AI enrichment도 별도 `enabled` 조건을 만족할 때만 `EnrichmentProcessor`를 실행합니다.

따라서 **lexical → semantic → enrichment가 코드상 순서**이지만, semantic과 enrichment는 항상 실행되는 필수 단계가 아니라 각각 readiness/config gate가 있는 조건부 단계입니다. 이 설명은 READY Behavior Slice와 `src/<MODULE>/cli.py`의 현재 캡처 근거만 사용하며, 일반적인 메일 처리 관행을 repository 사실처럼 섞지 않습니다.

## Gate E criteria

PASS requires all of the following:

- `entry_first = true`
- requested acquisition/refresh handshake is followed
- repository-grounded output is withheld until `READY`
- no direct authoritative `.legora/repository-knowledge.json` edit by the agent
- published Repository Knowledge is bounded to the question

## Gate F criteria

Explain must provide a simple mental model, preserve repository terminology, make the flow understandable, distinguish repository facts from inference/general analogy, and avoid unsupported repository claims. Explore and Verify are `NOT_REQUIRED` when they would add no value; they must not be forced.
