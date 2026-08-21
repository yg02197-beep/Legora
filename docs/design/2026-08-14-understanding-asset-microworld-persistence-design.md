# Legora — Understanding Asset & Microworld Persistence Design

## 0. Document Status

- Project: **Legora**
- Document: Understanding Asset & Microworld Persistence Design
- Date: 2026-08-14
- Status: **Approved Design / 사용자 승인 반영본**
- Scope: MVP asset model and Microworld persistence lifecycle
- Depends on: `2026-08-14-human-understanding-system-design.md`

---

# 1. Purpose

Legora의 Explain / Explore / Verify 결과 중 다시 열어볼 가치가 있는 결과를 **저장 가능한 Understanding Asset**으로 다룬다.

Microworld는 일회성 interactive demo가 아니라, 특정 repository revision과 evidence에 근거해 생성되고 나중에 다시 열거나 재검증할 수 있는 Understanding Asset의 한 종류다.

핵심 목적은 다음과 같다.

1. 과거에 형성한 software mental model을 다시 열어볼 수 있다.
2. 자산 생성 당시 repository evidence를 보존한다.
3. 현재 repository가 변경되었을 때 오래된 자산을 자동으로 최신 사실처럼 취급하지 않는다.
4. renderer가 바뀌어도 semantic source of truth에서 artifact를 다시 만들 수 있다.
5. Microworld뿐 아니라 explanation / diagram / walkthrough를 동일한 자산 체계에서 다룰 수 있다.

---

# 2. Core Decision

Understanding Asset은 공통 envelope를 갖고, 각 capability 결과가 specialization으로 확장한다.

```text
UnderstandingAsset
├─ ExplanationAsset
├─ DiagramAsset
├─ WalkthroughAsset
└─ MicroworldAsset
```

Microworld만 별도 저장 체계를 갖는 구조는 채택하지 않는다.

공통 자산 체계가 담당하는 것:

- identity
- subject / original question
- repository identity
- repository revision
- evidence provenance
- freshness
- validation state
- immutable history

Microworld specialization이 추가로 담당하는 것:

- causal projection
- executable artifact
- fidelity
- semantic validation
- runtime validation

---

# 3. Canonical Asset Layout

MVP 기본 저장 구조:

```text
understanding-assets/
  <asset-id>/
    manifest.json
    evidence.json
    status.json
    validations.json
    content.json
```

Microworld의 경우:

```text
understanding-assets/
  <asset-id>/
    manifest.json
    evidence.json
    status.json
    validations.json
    projection.json
    artifact.html
```

`artifact.html`은 semantic source of truth가 아니다.

```text
Repository Evidence
        ↓
projection.json
        ↓
Renderer
        ↓
artifact.html
```

따라서 renderer가 변경되거나 HTML artifact가 손상돼도 validated projection에서 다시 생성할 수 있어야 한다.

---

# 4. Common Manifest Contract

`manifest.json`은 자산의 **immutable creation record**다. 자산의 정체성, 생성 시점, source revision을 기록하며 freshness나 재검증 결과 때문에 덮어쓰지 않는다.

MVP 필드:

```text
asset_id
asset_type
schema_version

title
subject
original_question

created_at
repository_id
repository_revision

evidence_schema_version
content_schema_version
```

Microworld는 추가로 다음을 가진다.

```text
fidelity
projection_version
renderer_version
```

자산 ID는 content title이나 repository path와 분리된 stable identity다.

현재 freshness와 validation 상태는 `status.json`이 담당한다.

```text
freshness_status
validation_status
runtime_validation_status   ← Microworld only
last_checked_at
last_checked_repository_revision
```

`status.json`은 derived operational state이며, original creation provenance나 semantic content를 변경하지 않는다.

---

# 5. Asset Types

MVP에서 허용하는 asset type:

```text
EXPLANATION
DIAGRAM
WALKTHROUGH
MICROWORLD
```

모든 Explain / Explore / Verify 결과를 자동 저장하지 않는다.

저장 대상은 다음 중 하나를 만족할 때다.

- 사용자가 명시적으로 저장을 요청함
- 재사용 가치가 있는 repository understanding artifact임
- Microworld처럼 생성 비용과 evidence mapping을 보존할 가치가 큼

MVP에서는 장기 사용자 학습 점수나 learner profile을 함께 저장하지 않는다.

---

# 6. Evidence Contract

`evidence.json`은 자산이 주장하는 내용을 repository evidence와 연결한다.

각 evidence item은 최소 다음을 가진다.

```text
evidence_id
source_kind
repository_path
symbol_or_region
repository_revision
confidence
claim_refs[]
```

confidence:

```text
CONFIRMED
INFERRED
UNKNOWN
```

Microworld의 executable transition / constraint는 기본적으로 `CONFIRMED` evidence만 사용한다.

원칙:

> 저장된 Understanding Asset은 생성 당시 evidence보다 강한 사실을 주장할 수 없다.

---

# 7. Microworld Projection as Source of Truth

Microworld의 의미는 `artifact.html`이 아니라 `projection.json`에 저장한다.

기본 계약:

```text
MicroworldProjection
├─ subject
├─ learning_goal
├─ variables[]
├─ events[]
├─ transitions[]
├─ constraints[]
├─ controls[]
├─ observables[]
├─ scenarios[]
├─ predictions[]
└─ evidence_map[]
```

MVP fidelity target:

```text
F2 — Causal Fidelity
```

즉 event → transition → effect 관계는 보존하지만 실제 thread scheduler, timing, production latency를 복제한다고 주장하지 않는다.

---

# 8. Microworld Rendering Decision

MVP canonical renderer는 **React가 아니다**.

기본 artifact 형식:

```text
Self-contained HTML
├─ HTML
├─ CSS
├─ SVG / DOM
└─ minimal vanilla JavaScript state
```

이 선택의 이유:

- One Microworld, One Causal Lesson 원칙에 맞는 작은 artifact
- 별도 application framework나 build pipeline 없이 저장/재실행 가능
- AI가 생성·수정하기 쉬움
- sandboxed iframe 실행 가능
- DOM/SVG 수준에서 inspect/validation 가능
- framework lifecycle이 Microworld semantics를 지배하지 않음

React는 복잡성이 실제로 필요하다고 증명되기 전에는 dependency로 두지 않는다.

---

# 9. Renderer Architecture

Microworld 의미 모델과 표현을 분리한다.

```text
MicroworldProjection
        │
        ├─ HTML Artifact Renderer   ← MVP canonical
        ├─ Chat UI Renderer         ← host capability adapter
        └─ Static Renderer          ← fallback
```

## 9.1 HTML Artifact Renderer

Canonical persistence renderer다.

요구사항:

- self-contained
- network-independent by default
- deterministic from the same validated projection where practical
- no hidden causal logic beyond projection
- sandbox-compatible

## 9.2 Chat UI Renderer

ChatGPT나 향후 host가 직접 interactive component를 지원하면 사용할 수 있다.

하지만 host-specific UI를 canonical storage format으로 삼지 않는다.

즉:

```text
Host UI capability
= presentation adapter
≠ Legora semantic source of truth
```

## 9.3 Static Renderer

interactive rendering이 실패하거나 지원되지 않을 경우 같은 projection을 static diagram / step-by-step walkthrough로 표현한다.

---

# 10. Immutability Rule

생성된 Understanding Asset의 original semantic record를 현재 repository에 맞춰 조용히 덮어쓰지 않는다.

immutable original에 포함되는 것은 다음이다.

```text
manifest.json
evidence.json
content.json or projection.json
```

다음은 immutable semantic record와 분리된 derived / append-only state다.

```text
status.json       ← 현재 freshness / validation 상태
validations.json  ← 재검증 기록 누적
artifact.html     ← projection에서 재생성 가능한 representation
```

```text
Asset v1
repository revision: abc123
```

repository가 변경되면 v1 자체의 source revision은 그대로 유지한다.

핵심 원칙:

> 과거의 이해 자산은 과거의 repository evidence에 대한 기록이다.

---

# 11. Freshness State

MVP freshness state:

```text
CURRENT
STALE
UNKNOWN
```

## CURRENT

자산이 참조하는 evidence가 현재 repository revision에서도 유효하다고 확인됨.

## STALE

자산 생성 이후 관련 evidence surface가 변경되었으며 현재 validity가 재확인되지 않음.

`STALE`은 `WRONG`을 의미하지 않는다.

## UNKNOWN

현재 repository나 evidence surface에 접근할 수 없어 freshness를 판단할 수 없음.

---

# 12. Stale Detection

전체 repository에 commit 차이가 있다는 이유만으로 모든 asset을 STALE 처리하지 않는다.

가능한 경우 asset의 `evidence.json`에 기록된 source surface를 기준으로 freshness를 판정한다.

예:

```text
Asset evidence
- src/auth.ts::refreshToken
- src/session.ts::refreshLock
- tests/auth-refresh.test.ts
```

현재 revision에서 이 evidence surface가 변경된 경우 stale candidate가 된다.

MVP에서 semantic equivalence를 완벽하게 증명하려 하지 않는다.

보수적인 원칙:

```text
related evidence changed
→ STALE
→ explicit revalidation required
```

---

# 13. Revalidation Lifecycle

사용자가 stale asset을 재검증하면 기존 asset을 먼저 보존한다.

```text
Asset v1
    ↓
Revalidate against current repository
    ↓
┌──────────────────────────────────────┐
│ causal meaning unchanged            │
│ causal meaning changed              │
│ evidence insufficient / conflict    │
└──────────────────────────────────────┘
```

## 13.1 Meaning Unchanged

기존 asset record를 유지하고 별도의 validation record를 추가할 수 있다.

결과:

```text
Asset v1
original revision: abc123
revalidated against: def456
freshness: CURRENT
```

원본 생성 provenance는 바뀌지 않는다.

## 13.2 Meaning Changed

기존 asset을 overwrite하지 않는다.

새 Understanding Asset을 생성하고 lineage를 연결한다.

```text
Asset v1
revision abc123

superseded / related by revalidation
        ↓
Asset v2
revision def456
```

v1은 계속 열어볼 수 있다.

## 13.3 Insufficient Evidence or Conflict

최신 behavior를 확정할 수 없으면 새 executable Microworld를 확정 생성하지 않는다.

상태는 `STALE` 또는 `UNKNOWN`으로 유지하고 다음을 기록한다.

```text
EVIDENCE_CONFLICT
INSUFFICIENT_EVIDENCE
```

---

# 14. Validation Records

재검증 history는 asset의 original semantic content와 분리한다.

개념적으로:

```text
UnderstandingAsset
├─ original creation record
├─ validation records[]
└─ lineage refs[]
```

validation record 예:

```text
validated_at
against_repository_revision
result
validator_version
changed_evidence_refs[]
notes
```

MVP에서는 validation history를 **`validations.json`의 append-only record 배열**로 저장한다.

```text
validations.json
[
  ValidationRecord,
  ValidationRecord,
  ...
]
```

새 재검증은 기존 record의 의미를 수정하지 않고 새 record를 추가한다.

단, original creation provenance를 덮어쓰지 않는 규칙은 고정이다.

---

# 15. Microworld Validation Separation

Microworld validation은 최소 두 층으로 유지한다.

```text
1. Semantic / Internal Validation
Projection 자체가 schema와 causal contract를 만족하는가?

2. External Grounding Validation
Projection의 causal claims가 repository evidence와 연결되는가?
```

향후 browser runtime validation을 추가하면 세 번째 층이 된다.

```text
3. Runtime Artifact Validation
artifact interaction trajectory가 projection의 expected behavior와 일치하는가?
```

MVP 첫 vertical foundation에서 browser automation은 필수 dependency가 아니다.

Microworld cycle에 들어갈 때 필요성이 확인되면 Playwright 같은 browser validation을 추가한다.

---

# 16. Failure Behavior

## Artifact Renderer Failure

```text
validated projection
→ HTML generation failed
```

projection과 evidence는 보존한다.

fallback:

```text
Static Diagram
or
Step-by-Step Walkthrough
```

## Artifact Runtime Invalid

렌더링에는 성공했지만 projection과 다른 행동을 하면:

```text
MICROWORLD_INVALID
```

사용자 학습 artifact로 승인하지 않는다.

## Evidence Changed

```text
STALE
```

으로 표시하며 현재 behavior라고 가장하지 않는다.

---

# 17. User Experience

사용자가 과거 자산을 다시 열면 최소 다음을 알 수 있어야 한다.

```text
Title
Original question
Asset type
Created from repository revision
Freshness
Validation status
Evidence summary
```

STALE asset에서는 다음 행동을 제공할 수 있다.

```text
[Open Original]
[Revalidate Against Current Code]
```

`Open Original`은 과거 artifact를 그대로 본다는 의미다.

`Revalidate`는 현재 code에 맞게 기존 asset을 몰래 수정한다는 의미가 아니다.

---

# 18. MVP Boundaries

MVP에 포함:

- common Understanding Asset identity
- explanation / diagram / walkthrough / microworld asset type contract
- repository revision provenance
- evidence mapping
- CURRENT / STALE / UNKNOWN freshness
- immutable original asset rule
- explicit revalidation
- Microworld projection persistence
- self-contained HTML artifact persistence
- renderer separation
- lineage when meaning changes

MVP에서 제외:

- cloud sync
- team-wide asset sharing
- global search engine
- semantic merge of competing assets
- automatic long-term learner profile
- spaced repetition
- real-time background revalidation of all assets
- mandatory Playwright validation for every artifact
- React-based canonical Microworld application

---

# 19. Architectural Consequences

## Decision A — Asset Is Semantic, Not Visual

`artifact.html`은 다시 만들 수 있는 representation이다.

## Decision B — History Is Preserved

과거 repository behavior에 근거한 asset은 현재 code 변화 때문에 사라지지 않는다.

## Decision C — Freshness Is Explicit

오래된 이해 자산이 현재 사실처럼 보이지 않게 한다.

## Decision D — Renderer Is Replaceable

HTML, host-native chat UI, static output을 projection 뒤에 둔다.

## Decision E — Microworld Remains Small

저장 가능한 자산이라는 이유로 full application framework를 도입하지 않는다.

---

# 20. Acceptance Criteria

이 설계의 MVP 구현은 다음을 입증해야 한다.

1. 하나의 Understanding Asset을 stable identity와 repository revision을 포함해 저장할 수 있다.
2. Explanation과 Microworld가 동일한 common asset contract를 공유할 수 있다.
3. Microworld의 semantic projection과 HTML representation이 분리된다.
4. 동일 projection에서 artifact를 재생성할 수 있다.
5. 관련 evidence가 변경되면 asset을 STALE로 표시할 수 있다.
6. STALE이 WRONG으로 해석되지 않는다.
7. 재검증 시 original provenance가 보존된다.
8. behavior가 달라졌다면 기존 asset overwrite 대신 새 asset과 lineage를 생성한다.
9. evidence가 부족하면 최신 executable behavior를 확정하지 않는다.
10. React 없이 self-contained HTML/CSS/vanilla JS Microworld를 표현할 수 있다.

---

# 21. Final Design Rule

> **Understanding Asset은 특정 시점의 repository evidence에 근거한 재사용 가능한 mental-model artifact다. 원본은 보존하고, 현재 code와 달라질 수 있으면 stale로 표시하며, 재검증은 history를 지우지 않는다. Microworld의 의미는 projection이 소유하고 HTML은 교체 가능한 표현이다.**
