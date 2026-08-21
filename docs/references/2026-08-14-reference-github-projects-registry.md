# Legora — Reference GitHub Projects Registry

## 0. 문서 상태

- Project: **Legora**
- Document: Reference GitHub Projects Registry
- Date: 2026-08-14
- Status: **Reference Set v0.1**
- 목적:
  - Legora 설계의 선행 사례 추적
  - 중복 구현 방지
  - 재사용·차용 후보 식별
  - 각 프로젝트와 Legora의 차별점 유지

---

# 1. Reference Map

```
Legora
│
├─ Human Understanding
│  ├─ learn-codebase
│  ├─ cognitive-coverage
│  └─ Engram
│
├─ Explain
│  ├─ explain-diff
│  ├─ walkthrough
│  ├─ Artifacture
│  └─ code-to-docs-skill
│
├─ Explore
│  ├─ effect-viz
│  ├─ OpenGenerativeUI
│  ├─ agent-html-skills
│  ├─ OpenMAIC
│  ├─ tdoc
│  └─ MOOLLM
│
├─ Verify
│  ├─ learn-codebase
│  ├─ cognitive-coverage
│  ├─ Engram
│  └─ MiniAppBench
│
└─ Evidence / World Model
   ├─ Cartographer
   ├─ Understand Anything
   ├─ codebase-memory-mcp
   ├─ Nexus-skills
   └─ codebase-context

```

---

# 2. P0 — 반드시 깊게 참고할 프로젝트

## 2.1 Geoffrey Litt — `explain-diff`

**Legora 영역:** Explain / Verify

코드 변경을 단순 diff 순서가 아니라:

```
Background
→ Intuition
→ Code
→ Quiz

```

구조로 설명한다.

Legora가 가져올 것:

- 변경사항보다 배경을 먼저 설명
- 본질적인 intuition 우선
- toy example 적극 사용
- 실제 코드 walkthrough
- 설명 후 이해 확인

Legora와의 차이:

- `explain-diff`는 변경 설명이 중심
- Legora는 전체적인 **Human Understanding Router**가 중심
- Microworld와 evidence-grounded causal exploration까지 확장

---

## 2.2 `miltonian/cartographer`

**Legora 영역:** Evidence / World Model

Agent-first 코드 이해 시스템으로, 파일 트리보다 **시스템의 behavior**를 중심으로 persistent world model을 만든다.

주요 ontology:

```
boundary
capability
actor
entity
side-effect
invariant
failure-point
behavior flow

```

각 사실에 source evidence와 confidence를 연결한다.

Legora가 가져올 것:

- behavior-first 분석
- source evidence provenance
- confidence 구분
- flow / invariant / failure-point 개념
- UI와 stored model 분리

Legora와의 차이:

- Cartographer = 시스템 동작 지도
- Legora = **그 지도를 이용해 사람이 이해하도록 만드는 시스템**
- Cartographer 자체는 Microworld generator가 아님
- MVP에서는 필수 dependency로 사용하지 않음

---

## 2.3 `ryannadel/cognitive-coverage`

**Legora 영역:** Human Understanding / Verify

코드 coverage처럼 **사람이 이해한 범위**를 측정하려는 접근이다.

Legora가 가져올 것:

- file만이 아니라 concept / flow 단위로 이해를 생각하는 방식
- “설명을 봄”과 “이해함”을 구분
- understanding gap을 명시적으로 취급

Legora에서 그대로 가져오지 않을 것:

- MVP에서 이해도를 지속적인 coverage 점수로 만들지 않음
- 사용자별 장기 learner state를 기본 기능으로 두지 않음

---

## 2.4 `ktaletsk/learn-codebase`

**Legora 영역:** Human Understanding / Verify

코드를 보여주기 전에 사용자가 **먼저 결과를 예측하게 하는 Socratic 학습 방식**이 핵심이다.

주요 패턴:

```
Predict
→ Reveal
→ Compare
→ Misconception 발견
→ Mental model 수정

```

persistent learning journal도 제공한다.

Legora가 가져올 것:

- Predict-before-reveal
- 사용자의 오해를 직접 드러내는 질문
- 답을 바로 주지 않는 탐색
- 설명보다 mental model 형성을 중시

Legora에서 그대로 가져오지 않을 것:

- MVP에서는 persistent learning journal 불필요
- 장기 학습은 향후 Learner Mode에서만 검토

---

## 2.5 `topheman/effect-viz`

**Legora 영역:** Explore / Microworld UX

Effect runtime의 lazy evaluation, fibers, scheduling, errors, scopes 등을 브라우저에서 실행·편집하며 이해하는 학습 프로젝트다.

Legora에서 매우 중요한 이유:

> **“Microworld가 실제로 어떤 느낌이어야 하는가?”의 좋은 실물 사례**

Legora가 가져올 것:

- 실행 상태 시각화
- 작은 예제 변경
- 실행 흐름 단계별 관찰
- 시스템 내부 동작을 직접 경험하는 UX

Legora와의 차이:

- effect-viz는 Effect 전용 수작업 visualizer
- Legora는 repository에서 **질문별 Microworld를 자동 구성**하는 것을 목표로 함

---

## 2.6 `MiniAppBench/miniappbench`

**Legora 영역:** Microworld Verification

생성된 interactive HTML을 Playwright 기반 agent가 직접 클릭·입력·조작하면서 평가한다.

검증 영역:

```
Intention
Static correctness
Dynamic logic
Sequential logic
Robustness

```

Legora가 가져올 것:

- screenshot만으로 검증하지 않음
- 실제 interaction trajectory 수집
- runtime state 변화 검증
- sequential logic 확인
- generated interactive artifact를 실행 기반으로 평가

특히 Legora의:

> **“예쁜데 잘못 움직이는 Microworld” 방지**

에 중요한 참고 프로젝트다.

---

# 3. P1 — 기능 설계에 강하게 참고

## 3.1 `theclaymethod/artifacture`

**Legora 영역:** Explain / Visual Artifact

Verified visual explainer를 생성하는 프로젝트.

Legora가 가져올 것:

- visual code explanation
- interactive walkthrough
- explain-diff 계열 구성
- 생성 artifact의 deterministic verification 사고방식

Legora에서는 visual explainer renderer를 처음부터 다시 만들기 전에 반드시 비교할 대상.

---

## 3.2 `alexanderop/walkthrough`

**Legora 영역:** Explain / Structure

코드베이스를 탐색해 5\~12개의 핵심 개념으로 압축하고 clickable Mermaid diagram과 코드 설명을 생성한다.

목표 자체가:

> code reference가 아니라 mental model map

이다.

Legora가 가져올 것:

- 전체 파일 나열 금지
- 핵심 개념 수 제한
- plain-English explanation
- source path 연결
- 빠른 onboarding용 mental model

---

## 3.3 `CopilotKit/OpenGenerativeUI`

**Legora 영역:** Explore / Renderer

Agent가 HTML/SVG/Canvas/WebGL 기반 interactive UI와 simulation을 생성하고 sandboxed iframe에서 실행할 수 있다.

Legora가 가져올 것:

- generative interactive renderer
- sandboxed execution
- algorithm visualization
- simulation UI 생성 방식

Legora와의 차이:

- OpenGenerativeUI는 **무엇을 표현할지**에 대한 코드 의미 모델이 핵심이 아님
- Legora는 Behavior Slice와 evidence에서 표현할 내용을 먼저 결정

---

## 3.4 `f-labs-io/agent-html-skills`

**Legora 영역:** Explain / Explore / Human Interaction

여러 `SKILL.md` 기반 HTML artifact를 제공한다.

관련성이 특히 높은 skill:

```
html-code-review
html-interactive-playground
html-svg-diagrams
html-architecture-diagrams
html-mind-map

```

Interactive artifact에서 사용자의 조작 결과를 다시 agent에게 전달하는 **양방향 round-trip** 구조도 제공한다.

Legora가 가져올 것:

- SKILL.md 구성 방식
- interactive HTML artifact contract
- human → artifact → agent feedback loop

---

## 3.5 `Egonex-AI/Understand-Anything`

**Legora 영역:** Structural Evidence / Explore

코드베이스의 file/function/class/dependency를 분석해 interactive knowledge graph를 구축한다.

Legora가 가져올 것:

- 대형 코드베이스 navigation
- interactive knowledge graph
- structural map
- repository exploration UX

Legora와의 차이:

- 구조 지도는 Legora의 기반 또는 Explore capability
- **Human Understanding Router 및 causal Microworld와는 별도 문제**

---

## 3.6 `DeusData/codebase-memory-mcp`

**Legora 영역:** Evidence / Structural Backend

Tree-sitter와 type resolution을 이용해 persistent code knowledge graph를 구축하고 함수·클래스·call chain·HTTP route 등을 빠르게 조회한다.

Legora가 가져올 것:

- structural evidence backend 후보
- AST 기반 정확한 구조 추출
- impact/call-chain 질의
- persistent indexing

Legora에서는 agent용 infrastructure로 보고, 사용자 경험 그 자체로 보지 않는다.

---

## 3.7 `Haaaiawd/Nexus-skills`

**Legora 영역:** Evidence / Persistent Architecture Map

두 Skill:

```
nexus-mapper
nexus-query

```

를 중심으로 `.nexus-map/` persistent knowledge base와 AST 기반 구조 질의를 제공한다.

특히:

- architecture
- dependencies
- concepts
- test surface
- change impact
- provenance

를 명시적으로 관리한다.

Legora가 가져올 것:

- repository knowledge artifact 구성
- `implemented / planned / inferred` 구분
- 첫 분석 결과를 곧바로 확정하지 않는 gated workflow

---

# 4. P2 — 특정 기능 아이디어 참고

## 4.1 `nagisanzenin/engram`

**Legora 영역:** Verify / 향후 Learner Mode

사람을 위한 장기 학습 시스템으로:

```
generation
free recall
blind assessment
misconception
spaced review
retention

```

을 관리한다.

Legora에서 지금 가져올 것:

- “설명했다고 이해한 것이 아니다”
- generation / prediction 우선
- producer와 evaluator 분리
- 이해 판정에는 evidence가 필요

MVP에서 제외할 것:

- spaced repetition
- 장기 learner model
- review scheduler

장기 **Learner Mode** 설계 시 다시 깊게 볼 대상.

---

## 4.2 `THU-MAIC/OpenMAIC`

**Legora 영역:** Explore / Interactive Learning

문서나 주제를 interactive classroom으로 바꾸며 quiz, simulation, 3D visualization 등의 학습 활동을 생성한다.

Legora가 가져올 것:

- interactive simulation을 학습 과정 안에 배치하는 UX
- 설명 + simulation + quiz 조합
- learning activity orchestration

차이:

- OpenMAIC는 일반 교육 콘텐츠 중심
- Legora는 실제 repository evidence 기반 코드 이해 중심

---

## 4.3 `tornado-doc/tdoc`

**Legora 영역:** Explain / Explore Artifact

Prompt-native interactive HTML documentation 생성 계열.

Legora에서는:

- self-contained interactive documentation
- agent 환경에서 HTML artifact를 생성·검토하는 방식

참고 가치가 있다.

---

## 4.4 `SDS-Mode/code-to-docs-skill`

**Legora 영역:** Explain / Documentation

코드베이스에서 자동으로 documentation을 생성하는 Skill.

Legora가 참고할 것:

- 코드 → 교육용 설명 자산 변환
- architecture documentation
- structured documentation output

하지만 Legora는 문서 생성 자체가 최종 목적은 아니다.

---

## 4.5 `SimHacker/moollm`

**Legora 영역:** Explore / Microworld Philosophy

Papert식 constructionism과 microworld 철학을 직접적으로 다루는 프로젝트.

Legora가 가져올 것:

- learning by doing
- 작은 세계 안에서 규칙을 실험
- direct manipulation
- user-as-explorer 사고방식

특히 Microworld의 **교육 철학적 reference**로 유지한다.

---

## 4.6 `PatrickSys/codebase-context`

**Legora 영역:** Evidence / Agent Context

코드의 architecture, team convention, pattern, golden example, dependency 등을 agent에게 제공한다.

Legora가 가져올 것:

- bounded context
- local-first evidence
- broad repo 탐색보다 먼저 map을 사용
- pattern의 freshness / trend
- stale memory를 무조건 신뢰하지 않는 방식

Legora의 Behavior Slice Builder가 repository 범위를 좁힐 때 참고할 가치가 있다.

---

# 5. Legora와 레퍼런스의 차이

현재 reference들을 종합하면 대부분 다음 중 하나를 잘 해결한다.

```
코드 구조 파악
설명 생성
interactive UI 생성
학습
quiz
repository graph
artifact validation

```

Legora가 집중하는 빈 연결부는 다음이다.

```
실제 Repository Evidence
        ↓
질문별 Behavior Slice
        ↓
현재 이해 문제 판단
        ↓
Explain / Explore / Verify 선택
        ↓
필요한 경우
Evidence-grounded Microworld
        ↓
Prediction
        ↓
새 상황에서 이해 확인

```

즉 Legora의 핵심 차별점 후보는:

1. **Human Understanding Router**
2. **Least Sufficient Intervention**
3. **질문별 Behavior Slice**
4. **Terminology Bridge**
5. **Behavior → Executable Causal Microworld 변환**
6. **No Evidence, No Executable Behavior**
7. **Microworld 외부 근거 검증**
8. **Prediction 중심 이해 확인**

---

# 6. 구현 전 우선 재검토 순서

실제 구현에 들어가기 전에 다음 순서로 source까지 더 깊게 분석한다.

### Tier 1 — Architecture 결정에 직접 영향

1. `miltonian/cartographer`
2. `ktaletsk/learn-codebase`
3. `geoffreylitt/explain-diff`
4. `topheman/effect-viz`
5. `MiniAppBench/miniappbench`

### Tier 2 — 구현 방식 결정

6. `theclaymethod/artifacture`
7. `alexanderop/walkthrough`
8. `CopilotKit/OpenGenerativeUI`
9. `f-labs-io/agent-html-skills`
10. `ryannadel/cognitive-coverage`

### Tier 3 — Backend / 향후 확장

11. `Egonex-AI/Understand-Anything`
12. `DeusData/codebase-memory-mcp`
13. `Haaaiawd/Nexus-skills`
14. `nagisanzenin/engram`
15. `THU-MAIC/OpenMAIC`
16. `tornado-doc/tdoc`
17. `SDS-Mode/code-to-docs-skill`
18. `SimHacker/moollm`
19. `PatrickSys/codebase-context`

---

# 7. 유지 규칙

이 문서는 단순 링크 모음으로 관리하지 않는다.

새 프로젝트가 발견되면 다음 정보를 추가한다.

```
Project
Legora Layer
What It Solves
What We Can Reuse
What We Should Not Copy
Overlap With Legora
Priority
Last Reviewed

```

특히 기존 reference가 이미 해결한 기능을 Legora에서 새로 만들려 할 경우:

> **먼저 기존 구현을 다시 검토한 뒤 재개발 여부를 결정한다.**

반대로 기존 프로젝트가 비슷해 보여도 Legora의 핵심 계약:

```
Human Understanding
Evidence Grounding
Least Sufficient Intervention
Explain / Explore / Verify
Microworld only when justified
Prediction-based verification

```

을 만족하지 않으면 동일 제품으로 간주하지 않는다.
