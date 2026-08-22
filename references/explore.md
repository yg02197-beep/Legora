# Explore

Use Explore after Entry is READY when the user wants to inspect causality, changed conditions, state/event transitions, scenario differences, or why an evidenced outcome occurs.

## Explore is broader than Microworld

Not every Explore interaction is a Microworld. Prefer the cheapest useful form:

- code navigation through the evidenced slice;
- state inspection;
- timeline or event sequence;
- scenario comparison;
- causal walkthrough;
- Prediction or Microworld only when executable evidence supports a finite scenario.

## Executable evidence boundary

Prediction and Microworld behavior must come through the existing evidence-bounded causal path. A repository claim being plausible is not enough.

Before finite executable behavior, require the existing executable evidence gate to support the needed facts and a validated finite scenario. Never invent missing states, events, guards, transitions, effects, failure paths, observations, or alternative cases.

If executable evidence is insufficient, degrade to evidence-bounded inspection or explanation. State what is known, what is inferred, and what cannot currently be simulated.

## Microworld rule

One Microworld should express one evidence-supported causal lesson. It is not a replica of the whole repository and must not imply coverage beyond the validated scenario.

## User-facing flow

1. Identify the causal question within the READY Behavior Slice.
2. Prefer navigation/inspection when that already answers it.
3. Use Prediction/Microworld only if the executable-evidence path supports it.
4. If the gate fails, explain the evidence gap rather than fabricating behavior.
