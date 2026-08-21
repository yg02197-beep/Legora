# Legora — Human Understanding System Design

## 0. 문서 상태

* Project: **Legora**
* Document: Human Understanding System Design
* Date: 2026-08-14
* Status: **Design Draft / 사용자 승인 내용 통합본**
* Scope: MVP 설계
* 핵심 목적: **복잡한 소프트웨어를 사람이 이해·예측·판단할 수 있도록 돕는다.**

---

# 1. 문제 정의

AI가 코드를 작성하는 속도가 빨라질수록 새로운 병목은 코드 생성 자체보다 **사람이 그 코드를 이해하는 능력**으로 이동한다.

코드가 정상적으로 동작하고 테스트를 통과하더라도 사람이 다음을 할 수 없다면 실질적인 이해가 부족하다.

* 왜 이 코드가 존재하는지 설명
* 주요 구성요소가 어떻게 연결되는지 설명
* 조건이 바뀌었을 때 어떤 일이 일어날지 예측
* 잘못된 동작이나 설계상의 위험을 판단
* 기존 mental model을 이용해 새로운 설계에 참여

따라서 Legora의 목적은 문서를 많이 생성하거나 코드를 요약하는 것이 아니다.

> **Legora는 실제 코드 근거를 바탕으로 사람이 소프트웨어에 대한 유용한 mental model을 형성하도록 돕는 시스템이다.**

---

# 2. 핵심 제품 원칙

## 2.1 Human Understanding이 최상위 목적이다

Microworld, diagram, walkthrough, quiz는 모두 수단이다.

```text
                 Human Understanding
                        │
                        ▼
                Understanding Router
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
       Explain        Explore       Verify
                        │
                   Microworld
```

Legora는 Microworld 생성기가 아니다.

Microworld는 사람이 **인과관계를 직접 조작하고 관찰해야 이해가 쉬워지는 경우**에 사용하는 Explore capability 중 하나다.

---

## 2.2 가장 작은 충분한 개입을 선택한다

모든 질문에 긴 설명, diagram, Microworld, quiz를 전부 제공하지 않는다.

가능하면 다음과 같은 순서로 최소한의 개입만 사용한다.

```text
짧은 설명
   ↓
쉬운 용어 / 예시
   ↓
Diagram / Walkthrough
   ↓
Prediction
   ↓
Microworld
   ↓
Transfer Verification
```

이미 충분히 이해한 경우 즉시 종료할 수 있어야 한다.

이를 **Least Sufficient Intervention** 원칙으로 정의한다.

---

# 3. 전체 아키텍처

MVP 기준 Legora는 다음 여섯 구성요소를 갖는다.

```text
            User Understanding Request
                       │
                       ▼
              Understanding Router
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
     Explain         Explore         Verify
        │              │
        │          Microworld
        │              │
        └───────┬──────┘
                ▼
          Behavior Slice
                │
          Evidence Reader
                │
             Repository
```

구성요소:

1. **Understanding Router**
2. **Evidence Reader**
3. **Behavior Slice Builder**
4. **Explain**
5. **Explore / Microworld**
6. **Verify**

---

# 4. Understanding Router

## 4.1 역할

Router는 콘텐츠 생성기가 아니다.

Router가 답하는 질문은 하나다.

> **“현재 이 사람이 이해하는 데 다음으로 무엇이 필요한가?”**

Explain, Explore, Verify capability는 스스로 다음 capability를 호출하지 않는다.

모든 다음 행동 결정은 Router가 담당한다.

---

## 4.2 입력

```text
UnderstandingRequest
├─ subject
├─ user_goal
├─ current_context
├─ available_evidence
├─ behavior_slice
├─ observed_understanding
└─ explicit_user_preference
```

`observed_understanding`은 장기적인 사람 프로필이 아니다.

현재 대화에서 확인된:

* 확인된 이해
* 부분 이해
* 불확실
* 오해

정도만 사용한다.

---

## 4.3 이해 부족 유형

MVP에서는 다음 정도로 분류한다.

```text
UnderstandingGap
├─ terminology
├─ structure
├─ causality
├─ misconception
├─ uncertainty
├─ transfer_unverified
└─ none
```

기본 route:

```text
terminology
→ Explain / Terminology Bridge

structure
→ Explain / Diagram / Walkthrough

causality
→ Explore
   └─ 조건 충족 시 Microworld

misconception
→ Contrast
→ Prediction
→ 필요 시 Explore

uncertainty
→ Evidence inspection / targeted explanation

transfer_unverified
→ Verify

none
→ Stop
```

---

# 5. Explain

Explain의 목적은 사용자의 머릿속에 **유용한 mental model을 만드는 것**이다.

지원 capability:

```text
Explain
├─ Terminology Bridge
├─ Short Explanation
├─ Example
├─ Contrast
├─ Diagram
├─ Walkthrough
└─ Explain Diff
```

---

# 6. Terminology Bridge

어려운 전문 용어 때문에 개념 자체를 이해하지 못하는 상황을 별도로 처리한다.

원칙:

> **쉬운 말을 먼저 사용하고, 정식 용어와의 연결은 끊지 않는다.**

예:

```text
지켜져야 하는 규칙
(invariant)

실제 프로그램 동작을 정리한 지도
(world model)

실제 프로그램과 작은 모델의 동작이 얼마나 충실하게 같은지
(fidelity)
```

권장 설명 구조:

```text
전문 용어
   ↓
정확한 뜻
   ↓
쉬운 표현
   ↓
현재 코드에서의 의미
   ↓
필요한 경우 예시
```

Terminology Bridge는 독립적인 대형 subsystem이 아니라 Explain capability의 한 mode로 구현한다.

---

# 7. Evidence Reader

Legora의 모든 핵심 설명은 실제 repository 근거와 연결돼야 한다.

Evidence Reader는 질문에 관련된 코드만 최소 범위로 조사한다.

찾아야 할 정보:

* 관련 파일
* 함수 / 클래스
* 상태
* event
* 조건
* 호출 관계
* 테스트
* configuration
* 실패 경로

각 사실은 다음 근거 수준을 갖는다.

```text
CONFIRMED
코드 / 테스트 / 설정에서 직접 확인

INFERRED
근거를 종합하면 그렇게 보이나 직접 확인되지 않음

UNKNOWN
현재 정보로 판단 불가
```

중요 원칙:

> **설명이 쉬워져도 사실의 확실성이 올라가서는 안 된다.**

---

# 8. Behavior Slice

MVP에서는 프로젝트 전체 World Model을 생성하지 않는다.

현재 질문에 필요한 작은 동작 지도만 만든다.

예:

```text
Behavior Slice: Concurrent Refresh

Participants
- Request A
- Request B
- Refresh lock

State
- token = valid / expired
- refresh = active / inactive

Events
- request
- refresh success
- refresh failure

Constraint
- active refresh <= 1

Effects
- wait
- retry

Evidence
- auth.ts
- session.ts
- relevant tests
```

기본 schema:

```text
BehaviorSlice
├─ participants[]
├─ states[]
├─ events[]
├─ flows[]
├─ constraints[]
├─ effects[]
├─ failures[]
└─ evidence[]
```

---

# 9. 외부 World Model Backend

Cartographer와 같은 시스템은 Legora의 필수 dependency로 두지 않는다.

MVP:

```text
Question
   ↓
Evidence Reader
   ↓
Behavior Slice
```

향후:

```text
                     Behavior Slice
                           ▲
                           │
                 World Model Adapter
                           │
           ┌───────────────┼──────────────┐
           ▼               ▼              ▼
      Cartographer      Native        Future Backend
```

즉 Cartographer는 **Behavior Slice를 더 빠르고 풍부하게 제공할 수 있는 backend 후보**다.

Cartographer 자체가 Microworld를 생성하는 것은 아니다.

---

# 10. Explore

Explore의 목적은 사용자가 직접 관찰·조작하면서 시스템을 이해하도록 돕는 것이다.

지원 가능 방식:

```text
Explore
├─ Code Navigation
├─ Interactive Diagram
├─ State Inspection
├─ Timeline
├─ Scenario Comparison
└─ Microworld
```

모든 Explore가 Microworld인 것은 아니다.

---

# 11. Microworld

## 11.1 정의

Microworld는 실제 프로그램 전체의 복제품이 아니다.

> **코드 근거가 충분한 하나의 인과관계를 최소한의 상태·이벤트·조작·관찰로 표현한 작은 실행 실험이다.**

핵심 원칙:

> **One Microworld, One Causal Lesson.**

---

## 11.2 생성 조건

다음 네 요소가 필요하다.

```text
1. Observable State
2. Trigger / Event
3. Evidence-grounded Causal Relation
4. Observable Result
```

또한 두 gate를 모두 통과해야 한다.

### Understanding Gate

현재 이해 부족이 인과관계 탐색으로 실제 개선될 수 있는가?

### Fidelity Gate

코드 근거가 실행 가능한 모델을 만들 만큼 충분한가?

둘 중 하나라도 실패하면 Microworld를 만들지 않는다.

---

# 12. Microworld Projection

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

---

## 12.1 Variables

실험에서 변할 수 있는 상태.

```text
token = valid | expired
refresh_active = true | false
waiting_requests = integer
```

---

## 12.2 Events

상태 변화를 시작시키는 사건.

```text
REQUEST
TOKEN_EXPIRE
REFRESH_SUCCESS
REFRESH_FAILURE
```

user event와 system event를 구분할 수 있다.

---

## 12.3 Transitions

```text
from
event
guard
to
effects
evidence
```

모든 실행 가능한 transition은 실제 source evidence와 연결되어야 한다.

---

## 12.4 Constraints

World Model의 invariant를 실행 가능한 규칙으로 표현한다.

예:

```text
active_refresh <= 1
```

사용자가 실험으로 constraint를 깨면 violation을 명시적으로 보여준다.

---

## 12.5 Controls

사용자가 원인 쪽에서 조작할 수 있는 항목.

```text
[Send Request]
[Expire Token]

Lock
ON / OFF

Refresh Result
SUCCESS / FAIL
```

MVP control:

* button
* boolean
* enum
* simple numeric value

---

## 12.6 Observables

결과에서 관찰할 항목.

예:

```text
active refresh count
waiting requests
current token state
API result
constraint violation
```

원칙:

> **Control은 원인을 조작하고, Observable은 결과를 보여준다.**

---

# 13. Scenario 중심 학습

Microworld는 빈 playground를 제공하지 않는다.

하나의 작은 Scenario를 중심으로 진행한다.

예:

```text
Scenario:
Two requests arrive with an expired token.

Initial:
token = expired
lock = ON
active_refresh = 0

Question:
How many refresh requests will be created?
```

흐름:

```text
PREDICT
   ↓
RUN
   ↓
OBSERVE
   ↓
EXPLAIN
```

그 뒤 하나의 조건만 변경한다.

```text
lock = OFF
```

다시 결과를 예측하도록 한다.

Microworld의 핵심은 조작 자체가 아니라 **인과관계를 예측하고 수정하는 경험**이다.

---

# 14. Microworld 정확성 수준

Microworld 정확성 수준을 다음처럼 정의할 수 있다.

```text
F1 — Structural
관계만 보존

F2 — Causal
event → transition → effect 보존

F3 — Behavioral
조건 / 순서 / 실패 경로까지 보존

F4 — Runtime-backed
실제 runtime trace 기반
```

MVP 목표는:

> **F2 — Causal Fidelity**

이다.

실제 thread scheduler, latency, production runtime timing을 복제한다고 주장하지 않는다.

---

# 15. Evidence & Fidelity 규칙

핵심 규칙:

### Rule 1

> **쉬워져도 사실이 강해지면 안 된다.**

### Rule 2

> **움직이는 모델은 말로 하는 설명보다 더 강한 근거를 요구한다.**

일반 설명:

```text
CONFIRMED
+
명시된 INFERRED
```

Microworld executable behavior:

```text
기본적으로 CONFIRMED만
```

### Rule 3

> **복잡성은 생략할 수 있지만 핵심 인과관계는 바꾸면 안 된다.**

### Rule 4

> **근거가 부족하면 작은 범위만 모델링하거나 만들지 않는다.**

### Rule 5

> **Projection은 원본 evidence보다 더 강한 사실을 주장할 수 없다.**

---

# 16. 생략 정보

Microworld는 필요한 부분만 표현하므로 일부 코드는 생략한다.

내부적으로는 최소한 다음을 추적한다.

```text
Included
- token expiry
- refresh lock
- retry

Omitted
- logging
- telemetry
- cookie persistence
```

따라서 사용자가 실제 시스템 전체인지 물으면 명확히 범위를 설명할 수 있어야 한다.

---

# 17. Verify

Verify는 사람의 마음을 완전히 판정하는 기능이 아니다.

알 수 있는 것은 관찰 가능한 이해 증거다.

지원 방식:

```text
Verify
├─ Explain-back
├─ Prediction
├─ Contrast
├─ Debugging Question
├─ Transfer Scenario
└─ Quiz
```

MVP에서는 다음 두 방식만 필수로 한다.

### Explain-back

> “한 문장으로 다시 설명하면?”

### Prediction

> “조건이 이렇게 바뀌면 어떻게 될까요?”

---

# 18. Verify 결과

단순 PASS / FAIL만 사용하지 않는다.

```text
VerificationResult
├─ confirmed[]
├─ partial[]
├─ uncertain[]
├─ misconception[]
├─ insufficient_evidence[]
└─ next_gap
```

애매한 답변을 틀렸다고 단정하지 않는다.

예:

질문:

> refresh lock은 왜 필요한가?

답변:

> 동시에 일어나는 걸 막으려고.

판정:

```text
partial
```

그다음:

> 무엇이 동시에 일어나는 것을 막는다는 뜻인가요?

처럼 한 단계만 좁혀 확인한다.

---

# 19. 사람의 이해 상태 저장

MVP에서는 사용자의 이해도를 영구 점수로 저장하지 않는다.

금지 예:

```text
user.auth_understanding = 82%
user.refresh = VERIFIED
```

현재 대화 안에서만:

```text
confirmed
partial
uncertain
misconception
```

정도를 사용한다.

사람의 이해 판정 자체보다 **시스템에 대한 정확한 지식 자산**을 우선 저장한다.

---

# 20. Understanding Evidence

필요하면 중요한 이해 증거를 선택적으로 저장할 수 있는 확장 지점은 둔다.

예:

```text
UnderstandingEvidence

subject:
  Cartographer

observed:
  initially believed that
  Cartographer generates microworlds

clarified:
  Cartographer provides behavior/world model data

verification:
  distinction later explained correctly
```

하지만 MVP에서는 자동 장기 저장하지 않는다.

장기 학습이 목적이 되는 경우에만 별도 Learner Mode로 확장한다.

---

# 21. Learner Mode — MVP 외

향후 선택적으로:

```text
Human Understanding
├─ Work Mode
│   현재 작업 이해
│
└─ Learning Mode
    장기 학습
    ├─ misconception history
    ├─ review queue
    ├─ spaced repetition
    └─ retention tracking
```

을 추가할 수 있다.

MVP 범위에서는 제외한다.

---

# 22. Capability 간 책임 분리

Explain, Explore, Verify는 서로 직접 호출하지 않는다.

```text
              Router
       ┌────────┼────────┐
       ▼        ▼        ▼
    Explain  Explore   Verify
       │        │        │
       └────────┼────────┘
                ▼
        Capability Result
                │
                ▼
              Router
```

공통 결과:

```text
CapabilityResult
├─ outcome
├─ claims[]
├─ evidence_refs[]
├─ unresolved[]
├─ observations[]
└─ suggested_next_signal
```

`suggested_next_signal`은 명령이 아니다.

다음 행동은 항상 Router가 결정한다.

---

# 23. 사용자 경험

사용자에게 mode 선택을 요구하지 않는다.

기본 UX:

```text
"refresh lock 이해시켜줘"
"이 코드 왜 이렇게 돼?"
"이 diff 이해가 안 돼"
```

필요하면 `/understand` 같은 alias를 제공할 수 있지만 특정 slash command에 제품 설계를 종속시키지 않는다.

---

## 23.1 기본 흐름

```text
User Question
    ↓
짧고 쉬운 설명
    ↓
충분히 이해됨?
 ┌──┴──┐
yes   no
 │     │
끝    어디가 막혔나?
       │
       ├─ 용어 → 쉽게 풀기
       ├─ 구조 → Diagram / Walkthrough
       ├─ 인과 → Example / Microworld
       └─ 오해 → Contrast
                ↓
          필요하면 Explore
                ↓
            짧은 Verify
                ↓
          다음 판단에 충분?
```

---

# 24. 사용자 의도 우선

사용자가 명시적으로:

> “시험 말고 답만 줘.”

라고 하면 Verify를 강제하지 않는다.

> “Microworld 필요 없어.”

라고 하면 다른 Explore/Explain 방식을 사용한다.

> “내가 이해했는지 문제 내줘.”

라고 하면 바로 Verify로 갈 수 있다.

원칙:

> **Explicit User Intent > Automatic Routing**

단, 정확성 규칙은 사용자가 해제할 수 없다.

근거가 없는 내용을 실제 코드 동작이라고 가장하지 않는다.

---

# 25. 실패와 Fallback

## 25.1 Knowledge Failure

필요한 사실이 부족한 경우.

예:

* transition 근거 부족
* state 불명확
* 여러 source가 충돌
* 용어 의미가 애매함

이 경우 이해 도구 생성 자체를 제한한다.

---

## 25.2 Capability Failure

사실은 충분하지만 도구 실행이 실패하는 경우.

예:

* HTML 생성 실패
* renderer failure
* browser test failure
* diagram generation failure

이 경우 같은 knowledge를 더 단순한 형태로 사용한다.

---

# 26. Fallback Ladder

```text
Microworld
   ↓
Interactive Diagram
   ↓
Static Diagram
   ↓
Code Walkthrough
   ↓
Plain Explanation
   ↓
Evidence Inspection
```

아래로 내려가는 것은 실패가 아니라 **더 단순한 이해 방식으로 후퇴하는 것**이다.

---

# 27. Evidence Conflict

예:

```text
Code:
single refresh

Test:
two refreshes expected

Documentation:
single refresh
```

이 경우 Legora가 임의의 정답을 선택하지 않는다.

```text
EVIDENCE_CONFLICT
```

로 처리한다.

사용자에게는:

> 코드, 테스트, 문서가 서로 다른 동작을 가리키고 있어서 현재는 하나의 확정된 모델로 만들기 어렵습니다.

라고 설명한다.

Microworld는 기본적으로 생성하지 않는다.

---

# 28. Microworld 생성 실패

Projection은 성공했지만 renderer가 실패한 경우:

```text
Microworld
  ✗

동일 Projection
  ↓
Static Step-by-Step Walkthrough
```

로 후퇴한다.

---

# 29. 검증 실패한 Microworld

Microworld가 생성됐어도 실제 expected behavior와 맞지 않는다면 사용자에게 노출하지 않는다.

```text
MICROWORLD_INVALID
```

로 폐기한다.

원칙:

> **검증되지 않은 interactive artifact는 학습 자료로 사용하지 않는다.**

---

# 30. 자기검증 함정 방지

AI가:

```text
Microworld model 생성
→ expected trajectory 생성
→ simulation 생성
→ 둘이 일치
```

했다고 해서 정확성이 증명되는 것은 아니다.

둘 다 같은 잘못된 해석을 공유할 수 있다.

따라서 검증은 두 층으로 분리한다.

```text
1. Internal Consistency
Projection ↔ Simulation

2. External Grounding
Projection ↔ Repository Evidence
```

가능하면 가장 강한 근거를 활용한다.

예:

```text
existing test assertion
        ↓
expected behavior
        ↓
Microworld result
```

핵심 원칙:

> **Microworld는 자기 자신을 정답으로 삼아 검증해서는 안 된다.**

---

# 31. 테스트 전략

두 가지를 분리한다.

## 31.1 Truth Validation

> 실제 코드와 맞는가?

검사:

* source evidence 존재
* 존재하지 않는 state/function 생성 금지
* evidence confidence 유지
* stale evidence 탐지
* Microworld transition과 코드 근거 연결

---

## 31.2 Understanding Validation

> 이걸 본 사람이 실제로 더 잘 설명·예측하는가?

좋은 검증은 만족도보다 **예측 능력 변화**다.

```text
Before
→ 결과 예측 실패

Explain / Explore

After
→ 새로운 조건의 결과를 예측
```

---

# 32. 이해 검증 단계

```text
Level 1 — Recognition
용어 인식

Level 2 — Explanation
자기 말로 설명

Level 3 — Prediction
조건 변화 결과 예측

Level 4 — Transfer
새로운 유사 상황에 적용

Level 5 — Judgment
이해를 기반으로 설계/수정 판단
```

Legora의 핵심 목표는 특히 **Level 3~5**다.

---

# 33. Microworld 성공 기준

좋은 Microworld의 기준은:

```text
많이 클릭했다
재미있었다
예뻤다
```

가 아니다.

핵심은:

> **사용자가 이전에는 예측하지 못했던 동작을 새로운 조건에서도 예측할 수 있게 되었는가?**

즉 interaction 자체보다 **prediction quality의 개선**이 중요하다.

---

# 34. Router 테스트

대표 fixture:

### Case A

```text
"JWT가 뭐야?"
```

Expected:

```text
Explain / Terminology Bridge
```

### Case B

```text
"request가 handler까지 어떻게 가?"
```

Expected:

```text
Explain / Flow or Diagram
```

### Case C

```text
"refresh lock ON/OFF 차이를 이해하고 싶어"
```

Expected:

```text
Explore / Microworld if evidence sufficient
```

### Case D

```text
"내가 이해했는지 확인해줘"
```

Expected:

```text
Verify
```

### Case E

```text
causal evidence insufficient
```

Expected:

```text
Microworld prohibited
→ simpler explanation
```

---

# 35. MVP Scope

MVP에 포함:

* 자연어 기반 understand 진입
* Understanding Router
* Terminology Bridge
* Evidence Reader
* 질문별 Behavior Slice
* Short Explain
* Structure/Flow Explanation
* 한 종류의 State/Flow Microworld
* F2 causal fidelity
* Button / Boolean / Enum / Simple Numeric controls
* Explain-back verification
* Prediction verification
* Source evidence mapping
* Microworld internal + external validation
* 안전한 fallback

---

# 36. MVP 비범위

첫 버전에서는 하지 않는다.

```text
- 전체 프로젝트 World Model 필수 생성
- Cartographer 필수 설치
- Persistent Learner Profile
- 이해도 점수
- Cognitive Coverage Dashboard
- Spaced Repetition
- 팀원별 학습 관리
- Production Runtime Instrumentation
- Debugger 수준 tracing
- 실제 DB 연결
- 실제 network simulation
- 모든 프로그래밍 언어 지원
- 실제 thread scheduler 복제
- 복잡한 3D/Canvas visualizations
- 다양한 Microworld archetype
- 자동 생성 대형 교육 과정
```

---

# 37. MVP 대표 사례

## Case 1 — Terminology

질문:

> invariant가 뭐야?

동작:

```text
Terminology Bridge
→ 쉬운 설명
→ 정식 용어 연결
→ 필요하면 코드 예
→ 종료
```

Microworld 없음.

---

## Case 2 — Structure

질문:

> request가 실제 handler까지 어떻게 가?

동작:

```text
Evidence
→ Behavior Slice
→ Flow Explanation / Diagram
→ 종료
```

Microworld 없음.

---

## Case 3 — Causality

질문:

> refresh lock이 왜 필요한지 모르겠어.

동작:

```text
causality gap
    ↓
code evidence 확인
    ↓
sufficient
    ↓
Microworld

lock ON / OFF
    ↓
Predict
    ↓
Run
    ↓
Observe
    ↓
새 scenario Prediction
```

---

# 38. MVP 성공 기준

MVP는 다음을 모두 입증해야 한다.

1. 어려운 용어를 의미 손실 없이 쉽게 설명할 수 있다.
2. 설명의 핵심 주장에 실제 코드 근거를 연결할 수 있다.
3. 용어 문제, 구조 문제, 인과 문제를 구분할 수 있다.
4. 필요하지 않은 경우 Microworld를 만들지 않는다.
5. 필요한 경우 하나의 인과관계를 작은 Microworld로 만들 수 있다.
6. Microworld 동작을 repository evidence와 독립적으로 검증할 수 있다.
7. 근거가 부족한 경우 더 단순한 설명으로 안전하게 후퇴한다.
8. 사용자가 새로운 조건의 결과를 이전보다 잘 설명·예측할 수 있다.

---

# 39. 핵심 설계 원칙 요약

### Human First

> **최상위 목적은 도구 생성이 아니라 사람의 이해다.**

### Least Sufficient Intervention

> **현재 이해에 충분한 가장 작은 개입을 선택한다.**

### Easy but Exact

> **쉽게 설명하되 정확한 의미와의 연결을 끊지 않는다.**

### Evidence Grounded

> **코드 근거 없는 사실을 만들지 않는다.**

### No Evidence, No Executable Behavior

> **근거 없는 인과관계는 Microworld에서 실행하지 않는다.**

### One Microworld, One Causal Lesson

> **하나의 Microworld는 하나의 인과관계만 가르친다.**

### Projection Cannot Strengthen Evidence

> **학습용 모델은 원본 근거보다 더 확실한 주장을 만들 수 없다.**

### External Validation

> **Microworld가 자기 자신을 정답으로 삼아 검증해서는 안 된다.**

### Understanding Is Observable, Not Assumed

> **사람이 이해했다고 추측하지 않고 설명·예측·전이 같은 관찰 가능한 증거를 본다.**

### Graceful Fallback

> **Microworld가 불가능해도 이해 흐름은 계속된다.**

---

# 40. 프로젝트 정의

## Name

**Legora**

## Working Tagline

**Make software understandable.**

## Product Definition

> **Legora는 실제 소프트웨어의 코드 근거에서 필요한 동작만 추출하고, 어려운 개념을 쉽게 설명하며, 필요한 경우 조작 가능한 작은 인과 실험(Microworld)을 제공하고, 사람이 그 원리를 실제로 설명·예측할 수 있는지 확인하는 Human Understanding System이다.**

## MVP Definition

> **Legora MVP는 사용자의 코드 이해 질문에서 관련 근거를 찾고, 질문별 작은 동작 지도(Behavior Slice)를 만들며, Explain / Explore / Verify 중 필요한 최소 행동을 선택한다. 인과관계 탐색이 필요한 경우에만 코드 근거가 충분한 F2 수준의 Microworld를 생성한다.**
