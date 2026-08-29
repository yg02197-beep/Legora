# Legora

[English](README.md) | **한국어**

**사람과 코딩 에이전트를 위한 근거 기반 코드 이해 — Explain, Explore, Verify.**

Legora는 코드베이스가 실제로 어떻게 동작하는지 사람이 직접 이해할 수 있도록
돕습니다. 에이전트가 글만 보고 머릿속 모델을 지어내게 하지 않습니다. 저장소
근거를 최신 Repository Knowledge로 정리하고, 범위가 한정된 Behavior Slice를
뽑아낸 다음, 꼭 필요한 최소한의 개입인 Explain, Explore, Verify로 이해를
돕습니다.

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

코딩 에이전트는 코드를 잘 읽습니다. 하지만 쓸모 있는 설명이 되려면 다음 세 가지가
갖춰져야 합니다:

1. **근거(Grounding)** — 모든 주장은 저장소 근거까지 되짚어 확인할 수 있어야 합니다.
2. **최신성(Freshness)** — 소스가 바뀌었는데도 캐시된 지식이 슬그머니 남아 있어서는 안 됩니다.
3. **경계(Boundaries)** — 모를 때는 그럴듯한 답을 지어내지 말고, 모른다고 분명히
   말해야 합니다.

Legora는 이 세 가지를 프롬프트 지시에만 맡기지 않고 런타임에 직접 녹여 냅니다.

## 현재 상태

Legora는 이제 막 공개된 초기 소스 릴리스 `v0.1.0`입니다.

| 항목 | 상태 |
| --- | --- |
| 독립 실행형 CLI / 외부 저장소 라이프사이클 (R4) | 검증 완료 |
| Codex CLI 이식형 Skill 워크플로 | 라이브 검증 완료 |
| Claude Code bootstrap / doctor | 구현 완료, 라이브 게이트는 아직 미실행 |
| Gemini CLI bootstrap / doctor | 구현 완료, 라이브 게이트는 아직 미실행 |
| OpenCode bootstrap / doctor | 구현 완료, 라이브 게이트는 아직 미실행 |
| 원격 저장소 지원 | 아직 지원하지 않음 |
| 멀티 에이전트 지원 | 아직 지원하지 않음 |

npm 패키지는 아직 **배포되지 않았습니다**. `package.json`이 여전히 private이라,
지금 지원하는 설치 방법은 소스에서 직접 설치하는 것뿐입니다.

## 요구 사항

- Node.js **22 이상**
- npm
- Git
- 이해하려는 로컬 저장소
- 선택 사항: 이식형 Agent Skill을 쓰려면 Codex CLI, Claude Code, Gemini CLI, OpenCode 중 하나

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

서브커맨드 없이 실행하면 일부러 사용법 정보를 보여 줍니다. 도움말을 직접 요청할
수도 있습니다:

```powershell
legora --help
```

`legora`, `legora --help`, `legora -h`, `legora help`는 모두 읽기 좋은 명령 목록을
출력하고 `0`으로 종료합니다. 반면 알 수 없거나 잘못 입력한 명령은 0이 아닌 종료
코드와 함께 사용법 오류를 반환하므로, 일부러 요청한 도움말과 단순 실수를 혼동할
일이 없습니다.

## 코딩 에이전트 설정

Legora는 `skills/legora/`에 표준 이식형 Agent Skill 하나를 담고 있습니다. bootstrap
명령은 선택한 코딩 에이전트가 지원하는 사용자 범위 위치에 Legora가 직접 관리하는
복사본을 설치합니다.

### Codex CLI

```powershell
legora bootstrap --agent codex
legora doctor --agent codex
```

Codex는 현재 라이브 검증까지 마친 통합입니다.

### Claude Code

```powershell
legora bootstrap --agent claude
legora doctor --agent claude
```

Bootstrap과 Doctor는 구현되어 있지만, 라이브 워크플로 게이트는 아직 실행하지
않았습니다.

### Gemini CLI

```powershell
legora bootstrap --agent gemini
legora doctor --agent gemini
```

Bootstrap과 Doctor는 구현되어 있지만, 라이브 워크플로 게이트는 아직 실행하지
않았습니다.

### OpenCode

```powershell
legora bootstrap --agent opencode
legora doctor --agent opencode
```

OpenCode는 Codex, Gemini와 이식형 `~/.agents/skills/legora` 대상을 함께 씁니다.
Bootstrap과 Doctor는 구현되어 있지만, 라이브 워크플로 게이트는 아직 실행하지
않았습니다.

`legora doctor`는 읽기 전용입니다. Bootstrap은 Legora가 소유한 대상만 관리하며,
소유하지 않았거나 로컬에서 수정된 Skill 콘텐츠는 덮어쓰지 않습니다.

## 30초 만에 첫 사용

이해하려는 저장소에서 실제 궁금한 질문으로 시작하세요:

```powershell
legora entry "Where is authentication enforced and what happens when it fails?"
```

`legora entry`는 이제 기본적으로 읽기 좋은 텍스트를 출력해, 터미널에서 결과를
바로 확인할 수 있습니다. 구조화된 출력이 필요한 코딩 에이전트라면 `--json`을
붙이면 됩니다:

```powershell
legora entry "Where is authentication enforced and what happens when it fails?" --json
```

`--json` 출력은 기존의 구조화된 계약 그대로이고 바뀐 부분이 없어, 에이전트가
보는 동작은 하위 호환을 유지합니다.

Entry는 답변을 만들어 내는 도구가 아니라 하나의 게이트입니다. 라이프사이클은
다음과 같습니다:

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

Candidate 출력에는 레코드 식별자, 주제, 구조, 매치 신뢰도, 매치된 개념이 담깁니다.
lexical 검색이나 terminology-normalized 검색에서 겹치는 부분이 하나도 없더라도
Repository Knowledge에 이미 behavior flow가 있다면, Entry는 곧바로 지식이 없다고
단정하지 않고 해당 flow 메타데이터를 복구 후보로 돌려줍니다. 덕분에 저장소
Grep/Read와 acquisition은 후보 복구 게이트 뒤에 그대로 머무릅니다.

선택한 지식이 이미 있더라도 그 active evidence가 바뀌었거나 확인할 수 없는
경우에는:

```text
KNOWLEDGE_STALE / KNOWLEDGE_UNKNOWN
        ↓
REFRESH_KNOWLEDGE
        ↓
READY
```

오직 `READY` 상태에서만 Legora가 근거로 뒷받침하는 Behavior Slice 출력을 낼 수
있습니다.

이식형 Skill로 사용하면 코딩 에이전트가 이 핸드셰이크를 대신 밟아 줍니다. Entry로
시작하고, 저장소 소스를 보기 전에 기존 지식부터 검토하며, 요청이 있을 때만
acquisition이나 refresh를 제안하고, pre-READY 단계의 추측을 Legora의 확정된
답변처럼 취급하지 않습니다.

## Explain / Explore / Verify

Legora는 이해 작업을 세 가지 기능으로 나눠 처리합니다:

- **Explain**은 확인된 근거나 범위가 정해진 근거를 바탕으로 꼭 필요한 만큼의
  멘탈 모델을 세웁니다.
- **Explore**는 근거에 기반한 사례로 동작을 살펴봅니다. Microworld는 기본 답변
  형식이 아니라 Explore 기능의 하나입니다.
- **Verify**는 멘탈 모델이 예측이나 비슷한 사례로 이어진다는 것을 눈으로 확인할
  수 있는 근거를 요구합니다. 그렇다고 완전한 숙달을 보장하지는 않습니다.

표준 동작 지침은 다음 위치에 있습니다:

```text
skills/legora/SKILL.md
skills/legora/references/explain.md
skills/legora/references/explore.md
skills/legora/references/verify.md
```

저장소 루트의 `SKILL.md`는 워크플로의 또 다른 기준이 아니라 호환성을 위한
포인터일 뿐입니다.

### Verify

`legora verify`는 근거 기반 Prediction 인프라를 CLI 퀴즈 형태로 보여 줍니다.
Verify 기능을 Prediction 방식으로 구현한 것으로, `READY` 상태의 behavior-flow
지식 레코드에서 근거를 뽑아 예측 챌린지를 만듭니다. 질문과 선택지 역시 지어낸
것이 아니라 그 레코드의 근거에서 나옵니다.

```powershell
legora verify <flow-record-id>
legora verify --answer <choice-id> <flow-record-id>
```

사용할 수 있는 플래그는 `legora verify <flow-record-id> [--json]`와
`legora verify --answer <choice-id> <flow-record-id> [--json]`입니다. `--answer`를
빼면 Legora가 챌린지를 출력하고, `--answer <choice-id>`를 주면 고른 선택지를
근거에 비추어 채점합니다. `--json`은 코딩 에이전트를 위한 구조화된 출력을
만들어 줍니다.

Verify는 fail-closed로 동작합니다. 대상 레코드가 behavior flow가 아니거나, `READY`
상태가 아니거나(최신성이 stale이거나 unknown), 서로 구별되는 선택지로 챌린지를
만들 만큼 근거가 충분하지 않으면, Legora는 퀴즈를 억지로 지어내지 않고 만들기를
거부합니다. Legora의 다른 기능과 마찬가지로, 예측은 포착된 근거에 뒷받침될 때만
내놓습니다.

## 저장소 스캔

`legora scan`은 저장소를 가볍게 훑어보는 단계입니다. 먼저 구조적 Repository
Inventory(`git ls-files`로 찾은 파일과 모듈)를 만든 다음, 지금의 Repository
Knowledge가 이를 얼마나 커버하는지 짚어 줍니다. 저장소를 샅샅이 분석하거나 답을
만들어 내는 것이 아니라, Repository Inventory와 Knowledge Coverage를 보여 주는
작업입니다.

```powershell
legora scan
legora scan --depth file
legora scan --json
```

사용할 수 있는 플래그는 `legora scan [--depth file|module] [--json]`입니다. 기본
깊이는 `module`이고, `--depth file`은 파일 단위로 커버리지를 보고하며, `--json`은
코딩 에이전트를 위한 구조화된 출력을 만들어 줍니다.

커버리지는 딱 세 가지 상태, 즉 `covered`, `stale`, `uncovered`로 보고됩니다.
참조되지 않은 상태를 굳이 `unknown`이 아니라 `uncovered`라고 부르는 이유는, 다른
곳에서 쓰이는 최신성 `UNKNOWN` 상태와 헷갈리지 않게 하기 위해서입니다. 이 매핑
역시 fail-closed입니다:

- 최신성이 `CURRENT`인 지식 레코드의 active evidence가 참조하는 저장소 파일은
  `covered`입니다.
- 최신성이 `STALE`이나 `UNKNOWN`인 레코드가 참조하는 파일은 `stale`입니다
  (fail-closed 원칙에 따라, 오래되었거나 검증할 수 없는 근거는 절대 covered로
  치지 않습니다).
- 어떤 지식 레코드도 참조하지 않는 파일은 `uncovered`입니다.

읽기 좋은 출력은 다음과 같습니다(기본 `module` 깊이):

```text
Legora scan: 1 files (0 covered, 0 stale, 1 uncovered)
  src  total=1  covered=0  stale=0  uncovered=1
```

## Repository Knowledge

Legora는 저장소 로컬 지식을 다음 위치에 저장합니다:

```text
.legora/repository-knowledge.json
```

Repository Knowledge는 active evidence와 historical evidence 개정본을 따로
관리합니다. 최신성 검사는 active evidence를 읽으며, 소스 자료가 삭제되거나
바뀌거나 검증할 수 없으면 fail closed로 처리합니다.

코딩 에이전트는 근거를 *어디서* 포착할지 제안할 수 있지만, 그 제안을 검증하고
소스 스니펫을 실제로 포착하는 일은 Legora가 직접 합니다. 권위 있는 근거 필드는
단지 에이전트가 적어 냈다는 이유만으로 받아들여지지 않습니다.

에이전트가 일반적으로 넘기는 acquisition 입력은 저장되는 Knowledge Record 계약보다
일부러 작게 잡혀 있습니다. 에이전트는 `entity`, `flow`, `relationship` 중 하나와
함께 주제, 사람이 읽을 수 있는 참여자, 소스 로케이터를 제출하고, 내부 ID와 kind,
구조 필드는 Legora가 알아서 생성합니다.

```powershell
legora knowledge acquire --example
```

호환성을 위해 예전 방식의 전체 제안 JSON도 여전히 받아들입니다. 새 레코드를 발행하기
전에 Legora는 근거를 포착하기 전에 한 번, 그리고 원자적 store 트랜잭션 안에서 다시
한 번, 기존 Knowledge를 확인합니다. 중복일 가능성이 크면 레코드를 또 쓰지 않고
`EXISTING_KNOWLEDGE`를 반환합니다.

### `.legora`에 대한 버전 관리 정책

`.legora/repository-knowledge.json`에는 소스에서 뽑아낸 근거 스니펫이 들어 있을 수
있습니다.

권장 기본값은 다음과 같습니다:

- 실험 중이거나 비공개 코드를 다룰 때는 `.legora`를 로컬에만 두세요.
- 커밋할 때마다 그 내용을 먼저 확인하세요.
- 비공개 코드베이스에서 만든 `.legora`를 공개 저장소로 옮기지 마세요.
- 팀이 Repository Knowledge를 검토와 공유를 거친 지식 자산으로 삼기로 정한
  경우에만 커밋하세요.

Legora가 전역 무시 규칙을 강제하지 않는 이유는, 팀이 직접 소유하는 Knowledge
자산도 저장소 정책으로 충분히 선택할 수 있게 하기 위해서입니다.

## 근거 경계

근거 포착은 절대 경로 로케이터를 거부하고, 저장소 안에 있는지를 두 번에 걸쳐
확인합니다:

```text
relative locator
        ↓
lexical repository containment
        ↓
realpath resolution
        ↓
realpath containment re-check
```

이 두 번째 확인은 저장소 안의 심볼릭 링크나 정션을 통해 대상 저장소 밖의 근거를
읽어 들이는 일을 막아 줍니다.

같은 fail-closed 원칙은 최신성 검사와 Repository Knowledge 투영에도 그대로
적용됩니다.

## 이식형 Agent Skill

Bootstrap은 파일을 무작정 복사하지 않고 관리형 복사 트랜잭션을 사용합니다. 그
안에는 다음이 포함됩니다:

- 소유권 매니페스트,
- SHA-256 페이로드 검증,
- 소유하지 않은 유사 콘텐츠의 채택 거부,
- 로컬에서 수정된 관리형 콘텐츠의 덮어쓰기 거부,
- 단계적 발행,
- 백업과 검증,
- 실패 시 롤백.

Codex와 Gemini는 공유 Agent Skills 사용자 범위를 함께 쓰고, Claude Code는 자체
사용자 범위 Skill 위치를 씁니다. 아무것도 바꾸지 않고 설치 상태만 확인하려면
`doctor`를 실행하세요.

## Cartographer

Legora는 MIT 라이선스의 behavior-first 코드 이해 프로젝트인
[`miltonian/cartographer`](https://github.com/miltonian/cartographer)에서 영향을
받았습니다.

다만 Legora는 독립적으로 만든 구현이며, Cartographer는 런타임 의존성이
**아닙니다**. 지금 남아 있는 Cartographer 대상 코드는, 기존의 호환 가능한 모델을
Legora가 소유한 근거와 Behavior Slice 구조로 투영해 주는 레거시 import 호환성
경계일 뿐입니다.

출처 표기와 추가 참고 자료는 `THIRD_PARTY_NOTICES.md`와 `docs/references/` 아래의
디자인 참조 레지스트리를 확인하세요.

## 개발과 테스트

의존성을 설치합니다:

```powershell
npm ci
```

공개 CI와 동일한 검증을 실행합니다:

```powershell
npm run typecheck
npm test
npm run build
npm run test:integration:r4
npm run test:integration:r5
```

이 밖에도 개발용으로 저장소에 특화된 통합 스크립트와 라이브 프로바이더 스크립트가
있지만, 라이브 프로바이더 게이트는 일부러 기본 CI에서 빼 두었습니다.

## 라이선스

Legora는 MIT License로 배포됩니다. 자세한 내용은 `LICENSE`를 확인하세요.

서드파티 프로젝트와 참고 자료는 각자의 라이선스를 따릅니다. 자세한 내용은
`THIRD_PARTY_NOTICES.md`를 확인하세요.
