# KAOPU Learning Flywheel — Motor R05 door assembly contract (N194)

- Date: 2026-10-26
- Subject: `main@01907c4676df0160f85282229f9bfa965a944e09`
- Production artifact: `kaopu-motor-mother/r05/index.html`
- Scope: one bounded question only
- State: `OBSERVATION -> CANDIDATE`
- Routing: Motor Mother via coordination issue #91
- External teacher: `NO_NOVELTY` (ordinary rigid hierarchy/pivot semantics already suffice)

## Bounded question

Does R05's implementation satisfy its own two articulated-door claims?

1. the door rotates about a vertical hinge;
2. the side window follows its owning door's assembly transform.

## Source facts

The door transform is:

```js
mul(T(-.28,.40,z), mul(RY(s*door), S(.70,.53,.05)))
```

The procedural box is centered on its local origin. Therefore `RY` is applied about the door center, not an offset edge hinge.

The side-window transform is:

```js
M(-.32,1.39,s*.82*wide,.68,.23,.03)
```

It contains neither `door` nor the door transform and is not a child of a door assembly node.

## Minimal numerical replay

For local half-width `r = 0.70` and open angle `θ = 65°`:

```
edge displacement = 2 r sin(θ / 2)
                  = 0.752219452 model units
door-center displacement = 0
window-transform delta = 0
```

Both candidate door edges drift while the center remains fixed. Thus no edge is the fixed hinge. The window remains static while the door rotates.

## Result

- `HINGE_FIXED_POINT: FAIL`
- `WINDOW_CHILD_ATTACHMENT: FAIL`
- `R05_DOOR_INTERACTION: HOLD_CONTRACT_MISMATCH`
- Other R05 geometry, lighting, browser, GPU and visual acceptance: `NOT_EVALUATED`

This is a source/numeric gate result, not browser or user acceptance.

## Falsifiable Candidate gate

For every articulated door sample angle:

1. a declared hinge point must remain within `epsilon` of its closed-state world position;
2. the window's transform relative to the door must remain invariant;
3. a fixed window with a rotating door is a hard failure;
4. a center-pivot door described as edge-hinged is a hard failure.

A conforming transform may use an explicit hierarchy or:

```
T(worldHinge) * RY(theta) * T(-hingeLocal) * localPartTransform
```

The window must inherit the same door assembly transform. This is a contract recommendation only; no production implementation was changed.

## Applicability boundary

Applies to articulated rigid assemblies: doors/windows, hoods and hatches. It does not judge static-body proportion or visual styling.

## Status semantics

- Saved: `CANDIDATE`
- Numeric probe: `GATE-RUN`
- Routed: pending comment, then `POSTED`
- `ACKNOWLEDGED / IMPLEMENTED / ADOPTED / USER-ACCEPTED`: not claimed
