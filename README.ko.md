# Legora

[English](README.md) | **한국어**

**사람과 코딩 에이전트를 위한 근거 기반 코드 이해 — Explain, Explore, Verify.**

Legora는 에이전트가 산문만으로 멘탈 모델을 지어내도록 시키지 않고도, 사람이
코드베이스가 실제로 무엇을 하는지 이해하도록 돕습니다. 저장소 근거를 최신
Repository Knowledge로 바꾸고, 경계가 정해진 Behavior Slice를 투영한 다음,
가장 작고 유용한 이해 개입인 Explain, Explore, Verify를 사용합니다.

```text
Repository Evidence
        ↓
Repository Knowledge
        ↓
freshness validation
        ↓
Behavior Slice
        ↓
Explain / Explore / Verify
```

## 왜 Legora인가?

코딩 에이전트는 코드를 잘 읽지만, 유용한 설명이 되려면 여전히 세 가지 보장이
필요합니다:

1. **근거(Grounding)** — 주장은 저장소 근거로 거슬러 올라갈 수 있어야 합니다.
2. **신선도(Freshness)** — 캐시된 지식이 소스 변경에도 조용히 살아남아서는 안 됩니다.
3. **경계(Boundaries)** — 그럴듯한 답을 지어내는 대신, 시스템은 모를 때 모른다고
   말해야 합니다.

Legora는 이러한 보장을 프롬프트 지시에만 의존하지 않고 런타임의 일부로 만듭니다.

## 현재 상태

Legora는 초기 공개 소스 릴리스 `v0.1.0`입니다.

| 대상 | 상태 |
| --- | --- |
| 독립 실행형 CLI / 외부 저장소 라이프사이클 (R4) | 검증됨 |
| Codex CLI 이식형 Skill 워크플로 | 라이브 검증됨 |
| Claude Code bootstrap / doctor | 구현됨; 라이브 게이트 아직 미실행 |
| Gemini CLI bootstrap / doctor | 구현됨; 라이브 게이트 아직 미실행 |
| OpenCode bootstrap / doctor | 구현됨; 라이브 게이트 아직 미실행 |
| 원격 저장소 지원 | 현재 지원 주장 안 함 |
| 멀티 에이전트 지원 | 현재 지원 주장 안 함 |

npm 패키지는 아직 **배포되지 않았습니다**. `package.json`은 여전히 private이므로,
현재 지원되는 설치 경로는 소스에서 설치하는 방식입니다.

## 요구 사항

- Node.js **22 이상**
- npm
- Git
- 이해하고자 하는 로컬 저장소
- 선택 사항: 이식형 Agent Skill 사용을 위한 Codex CLI, Claude Code, Gemini CLI, 또는 OpenCode

## 소스에서 설치

```powershell
git clone https://github.com/yg02197-beep/Legora.git
cd Legora
npm ci
npm run build
npm link
```

CLI가 사용 가능한지 확인합니다:

```powershell
legora
```

이 명령은 의도적으로 서브커맨드 없이 호출되면 사용법 정보를 반환합니다. 도움말을
명시적으로 요청할 수도 있습니다:

```powershell
legora --help
```

`legora`, `legora --help`, `legora -h`, `legora help`는 모두 사람이 읽을 수 있는
명령 목록을 출력하고 `0`으로 종료합니다. 알 수 없거나 잘못 입력된 명령은 여전히
0이 아닌 종료 코드와 함께 사용법 오류를 반환하므로, 명시적인 도움말 요청이 실수와
혼동되는 일은 없습니다.

## 코딩 에이전트 설정

Legora는 `skills/legora/`에 하나의 표준 이식형 Agent Skill을 제공합니다. bootstrap
명령은 선택한 코딩 에이전트에 대해 지원되는 사용자 범위 위치에 Legora가 관리하는
복사본을 설치합니다.

### Codex CLI

```powershell
legora bootstrap --agent codex
legora doctor --agent codex
```

Codex는 현재 라이브 검증된 통합입니다.

### Claude Code

```powershell
legora bootstrap --agent claude
legora doctor --agent claude
```

Bootstrap과 Doctor는 구현되어 있지만, 라이브 워크플로 게이트는 아직 실행되지
않았습니다.

### Gemini CLI

```powershell
legora bootstrap --agent gemini
legora doctor --agent gemini
```

Bootstrap과 Doctor는 구현되어 있지만, 라이브 워크플로 게이트는 아직 실행되지
않았습니다.

### OpenCode

```powershell
legora bootstrap --agent opencode
legora doctor --agent opencode
```

OpenCode는 Codex 및 Gemini와 이식형 `~/.agents/skills/legora` 대상을 공유합니다.
Bootstrap과 Doctor는 구현되어 있지만, 라이브 워크플로 게이트는 아직 실행되지
않았습니다.

`legora doctor`는 읽기 전용입니다. Bootstrap은 Legora가 소유한 대상만 관리하며,
소유되지 않았거나 로컬에서 수정된 Skill 콘텐츠를 덮어쓰기를 거부합니다.

## 30초 만에 첫 사용

이해하고자 하는 저장소에서, 실제 질문으로 시작하세요:

```powershell
legora entry "Where is authentication enforced and what happens when it fails?"
```

`legora entry`는 이제 기본적으로 사람이 읽을 수 있는 텍스트를 출력하므로, 사람이
터미널에서 결과를 직접 읽을 수 있습니다. 구조화된 출력이 필요한 코딩 에이전트는
`--json`을 추가할 수 있습니다:

```powershell
legora entry "Where is authentication enforced and what happens when it fails?" --json
```

`--json` 출력은 이전의 구조화된 계약이며 변경되지 않았으므로, 에이전트를 향한
동작은 하위 호환성을 유지합니다.

Entry는 게이트이지 답변 생성기가 아닙니다. 그 라이프사이클은 다음과 같습니다:

```text
question
  ↓
lexical + structural + terminology-normalized retrieval
  ↓
strong existing match ───────────────→ freshness check → READY
  ↓ no strong match
KNOWLEDGE_CANDIDATES
  ↓
agent reviews returned knowledge metadata only
  ├─ candidate covers question
  │    ↓
  │  legora entry --candidate <record-id> <question>
  │    ↓
  │  freshness check → READY
  │
  └─ no candidate covers question
       ↓
     legora entry --reject-candidates <question>
       ↓
     KNOWLEDGE_NOT_FOUND
       ↓
     ACQUIRE_KNOWLEDGE
       ↓
     coding agent inspects only the required repository region
       ↓
     Legora captures source evidence itself → READY
```

Candidate 출력에는 레코드 식별자, 주제, 구조, 매치 신뢰도, 매치된 개념이
포함됩니다. lexical 또는 terminology-normalized 검색의 겹침이 전혀 없지만
Repository Knowledge에 이미 behavior flow가 포함되어 있다면, Entry는 지식이
없다고 즉시 선언하는 대신 그 flow 메타데이터를 복구 후보로 반환합니다. 이는
저장소 Grep/Read와 acquisition을 후보 복구 게이트 뒤에 유지합니다.

선택된 지식이 이미 존재하지만 그 active evidence가 변경되었거나 확인할 수 없는
경우:

```text
KNOWLEDGE_STALE / KNOWLEDGE_UNKNOWN
        ↓
REFRESH_KNOWLEDGE
        ↓
READY
```

`READY` 상태만이 Legora 근거 기반 Behavior Slice 출력을 허용합니다.

이식형 Skill을 통해 사용할 때, 코딩 에이전트는 당신을 위해 이 핸드셰이크를
따릅니다: Entry로 시작하고, 저장소 소스보다 먼저 기존 지식을 검토하며, 요청이
있을 때만 acquisition 또는 refresh 제안을 제공하고, pre-READY 추측을 권위 있는
Legora 답변으로 취급하지 않습니다.

## Explain / Explore / Verify

Legora는 이해 작업을 세 가지 기능으로 라우팅합니다:

- **Explain**은 확인되었거나 경계가 정해진 근거로부터 가장 작고 유용한 멘탈
  모델을 구축합니다.
- **Explore**는 근거 기반 사례를 사용해 동작을 검사합니다. Microworld는 기본
  답변 형식이 아니라 Explore 기능입니다.
- **Verify**는 멘탈 모델이 예측이나 관련 사례로 전이된다는 관찰 가능한 근거를
  요구합니다. 영구적인 숙달을 주장하지 않습니다.

표준 동작 지침은 다음 위치에 있습니다:

```text
skills/legora/SKILL.md
skills/legora/references/explain.md
skills/legora/references/explore.md
skills/legora/references/verify.md
```

저장소 루트의 `SKILL.md`는 워크플로 진실의 두 번째 소스가 아니라 호환성
포인터입니다.

### Verify

`legora verify`는 근거 기반 Prediction 인프라를 CLI 퀴즈로 노출합니다. 이는
Verify 기능의 Prediction 형태입니다: `READY` 상태의 behavior-flow 지식
레코드로부터 근거에서 파생된 예측 챌린지를 구축하며, 질문과 선택지는 지어낸
것이 아니라 그 레코드의 근거에서 파생됩니다.

```powershell
legora verify <flow-record-id>
legora verify --answer <choice-id> <flow-record-id>
```

전체 플래그 표면은 `legora verify <flow-record-id> [--json]`와
`legora verify --answer <choice-id> <flow-record-id> [--json]`입니다. `--answer`가
없으면 Legora는 챌린지를 출력하고, `--answer <choice-id>`는 선택한 옵션을 근거에
대해 채점합니다. `--json`은 코딩 에이전트를 위한 구조화된 출력을 생성합니다.

Verify는 fail-closed입니다. 대상 레코드가 behavior flow가 아니거나, `READY`가
아니거나(신선도가 stale하거나 unknown), 서로 구별되는 선택지로 챌린지를 구축할
만큼 충분한 근거를 담고 있지 않으면, Legora는 퀴즈를 지어내는 대신 만들기를
거부합니다. Legora의 나머지 부분과 마찬가지로, 예측은 포착된 근거에 기반할 때만
제공됩니다.

## 저장소 스캔

`legora scan`은 구조적 Repository Inventory(`git ls-files`를 통해 발견된 파일과
모듈)를 구축한 다음, 현재 Repository Knowledge가 그것을 얼마나 커버하는지
매핑하는 얕은 패스입니다. 이는 완전한 분석이나 답변 생성이 아니라 Repository
Inventory + Knowledge Coverage입니다.

```powershell
legora scan
legora scan --depth file
legora scan --json
```

전체 플래그 표면은 `legora scan [--depth file|module] [--json]`입니다. 기본
깊이는 `module`이고, `--depth file`은 파일별 커버리지를 보고하며, `--json`은
코딩 에이전트를 위한 구조화된 출력을 생성합니다.

커버리지는 정확히 세 가지 상태 — `covered`, `stale`, `uncovered` — 로 보고됩니다.
참조되지 않은 상태는 다른 곳에서 사용되는 신선도 `UNKNOWN` 상태와 혼동되지
않도록 의도적으로 `unknown`이 아니라 `uncovered`라고 부릅니다. 이 매핑은
fail-closed입니다:

- 신선도가 `CURRENT`인 지식 레코드의 active evidence가 참조하는 저장소 파일은
  `covered`입니다;
- 신선도가 `STALE` 또는 `UNKNOWN`인 레코드가 참조하는 파일은 `stale`입니다
  (fail-closed — 오래되었거나 검증할 수 없는 근거는 절대 covered로 간주되지
  않습니다);
- 어떤 지식 레코드도 참조하지 않는 파일은 `uncovered`입니다.

사람이 읽을 수 있는 출력은 다음과 같습니다(기본 `module` 깊이):

```text
Legora scan: 1 files (0 covered, 0 stale, 1 uncovered)
  src  total=1  covered=0  stale=0  uncovered=1
```

## Repository Knowledge

Legora는 저장소 로컬 지식을 다음 위치에 저장합니다:

```text
.legora/repository-knowledge.json
```

Repository Knowledge는 active evidence와 historical evidence 개정본을
분리합니다. 신선도 검사는 active evidence를 읽고, 소스 자료가 제거되거나
변경되거나 검증할 수 없을 때 fail closed합니다.

코딩 에이전트는 근거가 *어디에* 포착되어야 하는지 제안할 수 있지만, Legora는 그
제안을 검증하고 소스 스니펫을 직접 포착합니다. 권위 있는 근거 필드는 단지
에이전트가 작성했다는 이유만으로 받아들여지지 않습니다.

일반적인 에이전트 대상 acquisition 입력은 저장되는 Knowledge Record 계약보다
의도적으로 더 작습니다. 에이전트는 `entity`, `flow`, 또는 `relationship`과 함께
주제, 사람이 읽을 수 있는 참여자, 소스 로케이터를 제출하고, Legora는 내부 ID,
kind, 구조 필드를 직접 생성합니다.

```powershell
legora knowledge acquire --example
```

레거시 전체 제안 JSON도 호환성을 위해 계속 허용됩니다. 새 레코드가 발행되기
전에, Legora는 근거 포착 전과 원자적 store 트랜잭션 내부에서 다시 한 번 기존
Knowledge를 확인합니다. 중복 가능성이 있으면 또 다른 레코드를 쓰는 대신
`EXISTING_KNOWLEDGE`를 반환합니다.

### `.legora`에 대한 버전 관리 정책

`.legora/repository-knowledge.json`은 소스에서 파생된 근거 스니펫을 포함할 수
있습니다.

권장 기본값:

- 실험 중이거나 비공개 코드로 작업할 때는 `.legora`를 로컬에 유지하세요;
- 모든 커밋 전에 그 내용을 검사하세요;
- 비공개 코드베이스에서 생성된 `.legora`를 공개 저장소로 절대 복사하지 마세요;
- 팀이 의도적으로 Repository Knowledge를 검토되고 공유되는 지식 자산으로 삼고자
  할 때만 커밋하세요.

Legora는 전역 무시 규칙을 강제하지 않는데, 의도적으로 팀이 소유하는 Knowledge
자산은 지원되는 저장소 정책 선택지이기 때문입니다.

## 근거 경계

근거 포착은 절대 경로 로케이터를 거부하고 저장소 포함 여부를 두 번 검증합니다:

```text
relative locator
        ↓
lexical repository containment
        ↓
realpath resolution
        ↓
realpath containment re-check
```

이 두 번째 포함 검사는 저장소 로컬 심볼릭 링크나 정션이 대상 저장소 밖의 근거를
읽는 데 사용되는 것을 방지합니다.

동일한 fail-closed 원칙이 신선도 검사와 Repository Knowledge 투영에도
적용됩니다.

## 이식형 Agent Skill

Bootstrap은 파일을 무작정 복사하는 대신 관리형 복사 트랜잭션을 사용합니다. 그
경계에는 다음이 포함됩니다:

- 소유권 매니페스트;
- SHA-256 페이로드 검증;
- 소유되지 않은 유사 콘텐츠 채택 거부;
- 로컬에서 수정된 관리형 콘텐츠 덮어쓰기 거부;
- 단계적 발행;
- 백업과 검증;
- 실패 시 롤백.

Codex와 Gemini는 공유된 Agent Skills 사용자 범위를 사용합니다. Claude Code는
자체 사용자 범위 Skill 위치를 사용합니다. 변경 없이 설치를 검사하려면 `doctor`를
실행하세요.

## Cartographer

Legora는 MIT 라이선스의 behavior-first 코드 이해 프로젝트인
[`miltonian/cartographer`](https://github.com/miltonian/cartographer)에서 영향을
받았습니다.

Legora는 독립적인 구현입니다. Cartographer는 런타임 의존성이 **아닙니다**. 남아
있는 Cartographer 대상 코드는, 기존의 호환 가능한 모델을 Legora 소유의 근거 및
Behavior Slice 구조로 투영할 수 있는 레거시 import 호환성 경계입니다.

귀속 및 추가 참고 자료는 `THIRD_PARTY_NOTICES.md`와 `docs/references/` 아래의
디자인 참조 레지스트리를 참고하세요.

## 개발과 테스트

의존성을 설치합니다:

```powershell
npm ci
```

공개 CI에 상응하는 검증을 실행합니다:

```powershell
npm run typecheck
npm test
npm run build
npm run test:integration:r4
npm run test:integration:r5
```

개발을 위한 추가적인 저장소 특화 통합 및 라이브 프로바이더 스크립트가 존재하지만,
라이브 프로바이더 게이트는 의도적으로 기본 CI에서 제외됩니다.

## 라이선스

Legora는 MIT License로 배포됩니다. `LICENSE`를 참고하세요.

서드파티 프로젝트와 참고 자료는 각각의 라이선스를 따릅니다.
`THIRD_PARTY_NOTICES.md`를 참고하세요.
