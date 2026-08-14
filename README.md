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

설계 단계입니다.
