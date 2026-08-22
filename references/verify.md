# Verify

Use Verify after Entry is READY when the user explicitly wants to check understanding or when a small understanding check is useful before continuing.

Verify evaluates observable evidence in the current interaction. It does not claim access to the user's mind, permanent ability, or permanent mastery.

## Preferred forms

Use the smallest suitable form:

- explain-back: ask the user to restate the relevant mechanism briefly;
- Prediction: ask what happens in an evidenced case;
- transfer verification: when available, use a different evidenced case rather than an unsupported hypothetical;
- concise contrast/debugging question when it targets the current gap.

Do not force Verify when the user asked only for an explanation.

## Result semantics

Do not reduce ambiguous understanding to a general PASS / FAIL binary. Classify only what the response supports:

- `confirmed` — the required idea is clearly present;
- `partial` — a useful part is present but an important piece is missing;
- `uncertain` — the response does not support a confident judgment;
- `misconception` — the response contains a specific contradiction with the evidence;
- `insufficient_evidence` — the interaction does not provide enough evidence to judge the target point.

A result applies to the current observed understanding evidence, not a permanent learner profile.

## Evidence boundary

Prediction or transfer questions must be grounded in evidenced cases. Do not manufacture a supposedly correct answer from unsupported repository behavior. If a second evidenced transfer case does not exist, do not fabricate one.

The Verify capability reports observed understanding evidence; it does not decide the next capability by itself. The Skill/agent chooses the next smallest useful intervention.
