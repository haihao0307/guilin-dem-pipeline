# KAOPU Learning Flywheel — Motor animated R01 articulated-child replay (N195)

- Date: 2026-10-26
- Subject: `main@47d416556dc6bcb4bac4078a9c81bd64faa8f70a`
- Base: `01907c4676df0160f85282229f9bfa965a944e09`
- Production delta: `kaopu-motor-mother/experiments/motor-mother-four-vehicles-animated-r01/index.html`
- Existing applicable regression: `MOTOR-ARTICULATED-CHILD-TRANSFORM-001`
- State: `OBSERVATION -> CANDIDATE_REPLAY`
- External teacher: `NO_NOVELTY`

## Bounded question

Does the new animated R01 close both failures identified by N194: a fixed edge hinge and side-window inheritance?

## Source delta

The new side-window matrix now shares the door's rotation prefix:

```js
T(doorCenter) * RY(doorAngle) * T(windowLocal) * S(window)
```

The door itself remains:

```js
T(doorCenter) * RY(doorAngle) * S(door)
```

Therefore the window now moves rigidly with the door rotation, but the rotation axis remains at the centered box origin rather than a declared edge hinge.

## Numeric replay at 65 degrees

- door center displacement: `0`
- candidate edge hinge drift: `0.752219452 model units`
- window world-center displacement: `0.198146305 model units`
- window relative transform across angles: invariant

## Verdict

- `WINDOW_CHILD_ATTACHMENT: PASS`
- `HINGE_FIXED_POINT: FAIL`
- overall: `HOLD_PARTIAL_FIX`

This is a source-plus-numeric replay. It is not browser, GPU, visual, production or user acceptance.

## Evidence scope

For commit `47d41655...`:

- commit-bound workflow runs found: none
- combined commit statuses found: none
- browser/device evidence: not found
- visual acceptance: not evaluated
- unrelated controls/vehicle dynamics: not evaluated

## Next minimum falsifiable change

Reuse the existing Candidate regression; do not create a duplicate. The door and all door children need a declared edge hinge, for example:

```
T(worldHinge) * RY(theta) * T(-hingeLocal) * localPartTransform
```

Replay the same angles `0 / 15 / 35 / 65`; pass only if hinge drift is within a declared epsilon and the window-to-door relative transform remains invariant.

## Status semantics

- saved: `CANDIDATE_REPLAY`
- synthetic numeric: `GATE-RUN`
- production result: `HOLD_PARTIAL_FIX`
- `ACKNOWLEDGED / IMPLEMENTED / ADOPTED / USER-ACCEPTED`: not claimed
