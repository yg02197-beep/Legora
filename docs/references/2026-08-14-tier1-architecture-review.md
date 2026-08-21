# Legora — Tier 1 Reference Architecture Review

## 0. 문서 상태

- Project: **Legora**
- Document: Tier 1 Reference Architecture Review
- Date: 2026-08-14
- Status: **Architecture Review / Pre-Implementation**
- Basis:
  - `docs/design/2026-08-14-human-understanding-system-design.md`
  - `docs/references/2026-08-14-reference-github-projects-registry.md`
- 목적:
  - Tier 1 reference를 실제 구현 관점에서 재검토한다.
  - Legora가 재사용·차용할 계약과 직접 소유해야 할 계약을 분리한다.
  - Reference와 비슷하다는 이유로 MVP scope가 불필요하게 커지는 것을 막는다.

---

# 1. Executive Conclusion

Tier 1 재검토 결과, 기존 Human Understanding System Design의 큰 방향을 바꿀 이유는 발견되지 않았다.

가장 중요한 결론은 다음과 같다.

> **Legora MVP는 Native Minimal Core를 소유하고, 외부 시스템은 Adapter로 연결한다.**

구체적으로:

1. `BehaviorSlice`는 Legora가 소유하는 내부 canonical contract로 유지한다.
2. Cartographer의 persistent world model 전체를 MVP dependency로 채택하지 않는다.
3. Explain은 `explain-diff`의 narrative pattern을 차용하되 renderer나 HTML 형식에 종속되지 않는다.
4. Verify는 `learn-codebase`의 prediction-first interaction pattern을 차용하되 persistent learner profile은 도입하지 않는다.
5. Microworld는 renderer가 의미를 발명하지 못하도록 `MicroworldProjection`과 renderer를 분리한다.
6. Microworld 검증은 generator/renderer와 분리된 validation boundary를 둔다.
7. Browser interaction validation은 MiniAppBench의 trajectory-based 접근을 참고하지만, Legora의 truth oracle은 repository evidence여야 한다.
8. `effect-viz`는 Microworld의 학습 UX reference로 유지하되 Effect runtime 전용 구현을 일반화해서 복제하지 않는다.

따라서 Tier 1 reference는 Legora를 대체하는 통합 backend가 아니라 다음 다섯 역할로 분해해서 참고한다.

```text
Cartographer   → Evidence / behavior modeling reference
learn-codebase → Prediction-first learning interaction reference
explain-diff   → Explanation narrative contract reference
effect-viz     → Causal exploration / runtime visualization UX reference
MiniAppBench   → Interactive artifact execution validation reference
```

---

# 2. Review Method

이번 검토는 README의 제품 설명만 비교하지 않고 다음을 우선 확인했다.

- 공개된 architecture / skill / pipeline 구조
- 저장 모델과 UI의 책임 분리
- source evidence / confidence / provenance 취급 방식
- 학습 interaction의 상태 저장 범위
- interactive artifact 생성과 검증의 분리 여부
- 실제 브라우저 interaction을 통한 dynamic validation 방식

관찰된 reference 구현과 Legora에 대한 설계 판단을 구분한다.

- **Observed**: 해당 reference source/document에서 직접 확인한 구조
- **Legora Decision**: reference를 근거로 Legora에 적용하는 설계 판단
- **Do Not Copy**: MVP scope 또는 Legora의 핵심 계약과 충돌하므로 그대로 가져오지 않는 부분

---

# 3. `miltonian/cartographer`

Source:

- https://github.com/miltonian/cartographer
- https://github.com/miltonian/cartographer/blob/main/docs/architecture.md

Last Reviewed: 2026-08-14

## 3.1 Observed

Cartographer는 agent-first code understanding system이며 파일 목록이 아니라 시스템 behavior를 persistent world model로 외부화한다.

주요 ontology는 다음 계열이다.

```text
boundary
capability
actor
entity
side-effect
invariant
failure-point
flow
```

각 사실은 source evidence 및 confidence/provenance와 연결된다.

Architecture 문서상 핵심 구조는 다음처럼 분리된다.

```text
Agent / Plugin
   ↓
Local Service
   ↓
World-Model Store
   ↓
Projection Engine
   ↓
Browser UI
```

World Model Store가 source of truth이고 UI는 그 model의 projection이다. V1은 agent가 일반 파일 읽기/검색 도구를 사용해 behavior를 해석하며 custom AST parser를 필수 전제로 하지 않는다. Persistent model은 project root 기준으로 저장된다.

## 3.2 What Legora Should Reuse

- behavior-first analysis
- source evidence anchor
- confidence/provenance를 domain model에 포함하는 방식
- flow / invariant / failure-point 개념
- stored semantic model과 UI projection의 분리
- backend가 달라져도 상위 consumer가 동일 계약을 보도록 하는 사고방식

## 3.3 Do Not Copy

- 전체 repository에 대한 persistent world model을 MVP 선행조건으로 만들지 않는다.
- Cartographer ontology 전체를 그대로 Legora domain model로 복제하지 않는다.
- map browser/UI를 Legora의 primary UX로 채택하지 않는다.
- Cartographer가 없으면 Legora가 작동하지 않는 dependency 구조를 만들지 않는다.

## 3.4 Legora Decision

`BehaviorSlice`를 Cartographer model보다 작은 **question-bounded canonical contract**로 유지한다.

```text
Repository
   ↓
Evidence Reader
   ↓
Behavior Slice  ← Legora canonical boundary
   ↑
World Model Adapter
   ↑
Cartographer / future backend
```

Cartographer adapter는 향후 `BehaviorSlice` 생산 경로 중 하나가 될 수 있지만, Router/Explain/Explore/Verify는 Cartographer의 native entity schema를 직접 알지 않는다.

---

# 4. `ktaletsk/learn-codebase`

Source:

- https://github.com/ktaletsk/learn-codebase
- https://github.com/ktaletsk/learn-codebase/blob/main/SKILL.md

Last Reviewed: 2026-08-14

## 4.1 Observed

핵심 학습 loop는 답을 먼저 주기보다 learner에게 prediction을 요구하는 Socratic interaction이다.

대표 pattern:

```text
Predict
→ Reveal / Trace
→ Compare
→ Misconception 발견
→ Mental model 수정
```

질문 유형에는 prediction, trace, design reasoning, comparison, error prediction 등이 포함되며, partial/incorrect answer에는 단계적 hint를 제공한다.

또한 persistent learning journal, mastery, review 등의 장기 학습 기능을 포함한다.

## 4.2 What Legora Should Reuse

- predict-before-reveal
- 결과보다 reasoning을 관찰하는 질문
- partial answer를 즉시 오답 처리하지 않는 방식
- 한 단계씩 좁히는 hint
- trace / comparison / error-prediction 질문 패턴
- 설명 직후 새로운 조건에서 다시 예측시키는 방식

## 4.3 Do Not Copy

- persistent learning journal
- 장기 mastery score
- spaced review scheduler
- learner state를 제품 기본 source of truth로 만드는 구조
- 모든 interaction을 Socratic quiz로 강제하는 UX

## 4.4 Legora Decision

`learn-codebase`에서 가져올 대상은 persistent learner subsystem이 아니라 **Verify interaction grammar**다.

현재 대화에서만 다음을 관리한다.

```text
confirmed
partial
uncertain
misconception
```

그리고 다음 행동 결정 권한은 Verify가 아니라 Router에 남긴다.

---

# 5. `geoffreylitt/explain-diff`

Source:

- https://gist.github.com/geoffreylitt/a29df1b5f9865506e8952488eac3d524

Last Reviewed: 2026-08-14

## 5.1 Observed

핵심 설명 순서는 다음이다.

```text
Background
→ Intuition
→ Code
→ Quiz
```

주변 코드를 먼저 조사하고, beginner-friendly background에서 현재 change에 필요한 narrow context로 좁힌다. Intuition에서는 toy data와 diagram을 사용하며, Code section은 파일 순서가 아니라 이해 가능한 conceptual order로 설명한다.

최근 recipe는 source/tests/config/callers 등을 먼저 조사하고, 설명 전 narrative를 구성하며, artifact 자체도 검증하도록 강화되어 있다.

## 5.2 What Legora Should Reuse

- background before implementation detail
- intuition before exhaustive details
- toy example / before-after comparison
- code를 conceptual execution order로 설명
- jargon을 처음 등장할 때 풀어주는 방식
- explanation artifact의 자체 구조 검증

## 5.3 Do Not Copy

- Explain 결과를 항상 단일 self-contained HTML로 제한하지 않는다.
- 모든 설명 뒤에 정확히 5개 quiz를 강제하지 않는다.
- diff explanation을 제품 중심 abstraction으로 두지 않는다.
- renderer contract를 explanation semantics와 결합하지 않는다.

## 5.4 Legora Decision

`explain-diff`는 엔진 dependency가 아니라 **Explain narrative contract reference**로 사용한다.

Legora Explain은 Behavior Slice와 evidence refs를 입력으로 받고, 출력 형식은 text / diagram / walkthrough / diff explainer 중 Router가 선택한다.

---

# 6. `topheman/effect-viz`

Source:

- https://github.com/topheman/effect-viz

Last Reviewed: 2026-08-14

## 6.1 Observed

Effect runtime의 실행을 브라우저에서 시각화하고 example program을 편집할 수 있는 학습용 visualizer다.

Repository는 React/TypeScript/Vite 기반 구조를 가지며 별도의 runtime-oriented Vite configuration과 runtime watch plugin을 둔다. Workshop은 lazy evaluation, fibers, scheduling, errors, scopes 등 실행 과정의 내부 동작을 단계적으로 학습하도록 구성돼 있다.

이번 검토에서는 GitHub가 일부 source blob을 안정적으로 반환하지 않아 세부 runtime message protocol까지는 확인하지 못했다. 따라서 아래 결정은 공개 repository 구조와 README에서 직접 확인 가능한 범위를 넘어서 특정 내부 구현을 가정하지 않는다.

## 6.2 What Legora Should Reuse

- 작은 실행 예제를 직접 변경하는 UX
- 내부 상태를 execution progression과 함께 관찰하는 방식
- 한 번에 하나의 runtime concept에 집중하는 학습 구조
- control과 observable을 분리해 인과를 체감시키는 제품 감각

## 6.3 Do Not Copy

- Effect-specific runtime instrumentation
- Effect fiber/scheduler model을 일반 프로그램 behavior model로 일반화
- 실제 runtime replay가 없으면 Microworld를 만들 수 없다는 전제
- free-form code editor를 MVP Microworld의 필수 control로 두는 것

## 6.4 Legora Decision

`effect-viz`는 **Microworld UX reference**이지 semantic backend가 아니다.

Legora MVP는 source repository runtime을 복제하지 않고 F2 causal fidelity를 목표로 한다. 사용자가 조작하는 것은 code editor가 아니라 `MicroworldProjection.controls`로 제한한다.

---

# 7. `MiniAppBench/miniappbench`

Source:

- https://github.com/MiniAppBench/miniappbench
- https://raw.githubusercontent.com/MiniAppBench/miniappbench/main/miniappbench/examples/scripts/agent_eval.py

Last Reviewed: 2026-08-14

## 7.1 Observed

MiniAppBench는 generated interactive HTML/MiniApp을 평가하는 benchmark와 MiniAppEval pipeline을 제공한다.

Pipeline 구조가 명시적으로 다음처럼 나뉜다.

```text
Generate
→ Compile
→ Evaluate
```

Evaluation에서는 Playwright browser automation을 이용해 실제 app을 조작하고, DOM state / console / code와 interaction 결과를 바탕으로 intention, static, dynamic quality를 평가한다.

`agent_eval.py`의 browser mode는 실제 operation과 DOM state 변화에 근거해 dynamic capability를 판단하도록 요구하며, 단순히 UI가 있을 것이라고 추측하는 것을 금지한다.

## 7.2 What Legora Should Reuse

- 생성과 평가 pipeline 분리
- 실제 browser interaction trajectory 수집
- sequential interaction 검증
- DOM/state 변화 기반 assertion
- screenshot만으로 dynamic correctness를 판정하지 않는 방식
- generated artifact가 실제 조작 가능한지 검증하는 별도 stage

## 7.3 Do Not Copy

- LLM evaluator의 quality score를 Legora truth oracle로 사용하지 않는다.
- intention/static/dynamic score를 그대로 Legora fidelity metric으로 사용하지 않는다.
- open-ended agent exploration만으로 causal correctness를 증명했다고 보지 않는다.
- artifact generator와 evaluator가 공유하는 추론을 독립 evidence로 간주하지 않는다.

## 7.4 Legora Decision

Legora validation은 두 층으로 유지한다.

```text
Layer A — Semantic / External Grounding
MicroworldProjection
↕
Repository Evidence / tests / config

Layer B — Runtime Artifact Validation
Projection expected trajectory
↕
Rendered Microworld interaction trajectory
```

Browser validation은 Layer B의 도구다. Layer A를 대신하지 않는다.

---

# 8. Cross-Reference Architecture Decisions

## D1 — Legora owns the canonical contracts

외부 프로젝트 native schema를 Router가 직접 사용하지 않는다.

MVP canonical contracts:

```text
UnderstandingRequest
UnderstandingGap
EvidenceRef / EvidenceClaim
BehaviorSlice
CapabilityResult
MicroworldProjection
VerificationResult
```

외부 backend나 renderer는 이 경계 밖에 둔다.

---

## D2 — Evidence and presentation are separate

```text
Repository Evidence
       ↓
Evidence Reader
       ↓
Behavior Slice
       ↓
Capability Semantics
       ↓
Renderer / Presentation
```

UI가 새로운 semantic fact를 만들 수 없다.

---

## D3 — Router is the only orchestration authority

```text
Router
├─ Explain
├─ Explore
└─ Verify
```

Capability는 결과와 `suggested_next_signal`만 반환한다. 다음 capability를 직접 호출하지 않는다.

---

## D4 — Microworld is projection-first

```text
Behavior Slice
   ↓
Microworld Projector
   ↓
MicroworldProjection
   ├─ Semantic Validator
   ├─ Renderer
   └─ Runtime Validator
```

Renderer는 transition, constraint, expected behavior를 임의로 생성하지 않는다.

---

## D5 — Generator and validator do not share a truth oracle

Internal consistency와 external grounding을 분리한다.

```text
Projection ↔ Simulation
```

일치만으로 PASS시키지 않는다.

최소한:

```text
Projection claim
   ↓
Evidence anchor
   ↓
Independent expected behavior
   ↓
Runtime trajectory comparison
```

이 가능해야 executable behavior를 사용자에게 노출한다.

---

## D6 — Persistent learner state is outside MVP

현재 대화의 observed understanding만 Router input으로 사용한다.

장기 learner journal / coverage / mastery는 adapter나 future Learner Mode로 남긴다.

---

# 9. Architecture Options Considered

## Option A — Native Minimal Core + Adapters — **Recommended**

Legora의 작은 canonical contracts와 Router를 직접 소유하고, Cartographer/renderer/browser validator 등을 adapter로 연결한다.

장점:

- 기존 승인 설계와 일치
- MVP scope가 가장 작음
- external reference 교체 가능
- truth/presentation/orchestration 책임 분리가 명확함
- 향후 Cartographer 도입 경로를 막지 않음

단점:

- Behavior Slice 최소 추출 logic을 Legora가 직접 구현해야 함
- adapter contract를 초기에 명확히 설계해야 함

## Option B — Cartographer-First Core

Cartographer world model을 사실상 Legora의 canonical knowledge model로 사용한다.

장점:

- 풍부한 persistent behavior model을 빠르게 활용 가능
- provenance/confidence 등 이미 해결된 부분이 많음

단점:

- MVP가 외부 ontology와 lifecycle에 강하게 결합됨
- 질문별 작은 Behavior Slice보다 repository-wide model 구축이 선행될 위험
- Cartographer가 없는 환경의 Legora가 약해짐
- Human Understanding Router보다 backend integration이 제품 중심이 될 위험

판정: **MVP 비권장**

## Option C — Renderer-First Microworld Prototype

interactive UI부터 만들고 이후 evidence model을 연결한다.

장점:

- 빠르게 눈에 보이는 demo를 만들 수 있음
- UX 실험 속도가 빠름

단점:

- semantic truth와 renderer logic이 섞이기 쉬움
- “예쁜데 잘못 움직이는 Microworld” 위험이 가장 큼
- No Evidence, No Executable Behavior 원칙을 구조적으로 보장하기 어려움

판정: **반려**

---

# 10. Recommended MVP Boundary

첫 implementation cycle은 전체 제품을 한 번에 완성하는 것이 아니라 다음 vertical foundation을 만든다.

```text
Natural-language Understanding Request
        ↓
Minimal Evidence Reader
        ↓
Behavior Slice
        ↓
Understanding Router
        ↓
Explain OR Verify OR Explore decision
        ↓
Capability Result
```

Microworld는 이 foundation의 계약이 안정된 다음 cycle에서:

```text
Behavior Slice
→ Fidelity Gate
→ MicroworldProjection
→ Semantic Validation
→ Renderer
→ Runtime Validation
```

순서로 추가한다.

이 순서를 택하면 Microworld UI가 product architecture를 역으로 결정하는 것을 방지할 수 있다.

---

# 11. Review Limitations

- `effect-viz`의 일부 source blob은 2026-08-14 GitHub web retrieval에서 cache miss가 발생해 runtime watch/message implementation의 세부 코드는 직접 확인하지 못했다.
- 따라서 effect-viz에 대해서는 확인되지 않은 내부 protocol을 Legora 설계 근거로 사용하지 않았다.
- MiniAppBench의 evaluation prompt와 공개 pipeline은 확인했지만, Legora가 MiniAppEval evaluator 자체를 dependency로 채택한다는 의미는 아니다.
- Reference project의 future changes가 Legora의 canonical contracts를 자동으로 변경하지 않는다. Registry의 `Last Reviewed`를 갱신한 뒤 별도 설계 판단을 거쳐야 한다.

---

# 12. Pre-Implementation Gate

Tier 1 review 이후 implementation plan에 들어가기 전에 다음을 고정해야 한다.

1. **Architecture option:** Option A — Native Minimal Core + Adapters
2. **첫 vertical slice:** Evidence → Behavior Slice → Router → one capability result
3. **Microworld sequencing:** foundation 이후 별도 implementation cycle
4. **Persistence:** MVP learner persistence 없음
5. **Validation:** semantic grounding과 runtime artifact validation 분리
6. **Technology stack:** repository에 아직 stack이 없으므로 implementation plan 작성 전에 별도 결정 필요

이 문서는 reference 조사 결과와 architecture implication을 기록한다. 실제 code scaffold나 implementation은 포함하지 않는다.
