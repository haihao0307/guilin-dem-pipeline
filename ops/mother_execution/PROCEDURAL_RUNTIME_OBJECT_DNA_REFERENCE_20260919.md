# Procedural Runtime Object-DNA reference — Three.js/Astra train demo

Date: 2026-09-19

## Source and evidence boundary

Reference supplied by the user:

- Official Three.js repost: `https://x.com/threejs/status/2096136158157869382?s=20`
- Identified original creator post: `https://x.com/tomkrcha/status/2096082580554777041`

The X video stream was not directly readable in the coordinator runtime. Indexed copies and the creator's accompanying text identify the demonstration as two steam locomotives generated at runtime from TypeScript/Three.js using dimensions, profiles and geometry functions, with wheel motion and explode/reassemble behavior. The creator states that the runtime demo contains no conventional 3D model files. This remains a creator-reported demonstration until source code, a public reproducible build and performance receipts are inspected.

Do not conflate this runtime Two-Train demo with the creator's separate earlier Blender reconstruction reportedly containing 3,295 editable objects.

## Transferable lesson

The useful lesson is not “AI made a pretty train.” It is that a complex object can be represented as an inspectable production graph:

`evidence/reference -> dimensions -> section profiles -> semantic parts -> geometry functions -> constraints/joints -> runtime assembly -> behavior -> QA views`

This matches the project's Object-DNA direction. A useful Mother output should therefore expose:

1. authoritative dimensions and coordinate frame;
2. named semantic parts with stable IDs;
3. profile/section functions rather than only a final opaque surface;
4. explicit parent-child and joint constraints;
5. the same source for rendering, collision, attachment and behavior;
6. deterministic regeneration from parameters and seed;
7. inspect/explode/reassemble mode for QA, not merely spectacle;
8. machine-readable receipts and known limitations.

## What must not be copied blindly

- “No model files” is not itself a quality metric. A code-generated object can still have wrong proportions, bad topology, fake joints or poor performance.
- Object count is not fidelity. Thousands of scene objects can be disastrous on mobile.
- A social video is not proof of source accuracy, deterministic rebuild, stable IDs, collision correctness or production readiness.
- Exploded view must follow the assembly graph; arbitrary radial scattering is not an acceptable substitute.
- Motion must consume the same joint graph that defines the object. Decorative wheel rotation or fin motion disconnected from force/constraints is not accepted.

## Mother execution card

Every Mother that adopts this method must start with one bounded, testable object or cell. Within the first execution cycle it must produce:

- executable generator code;
- at least one invariant or numerical test;
- exact base/head SHA and command receipt;
- known-limitations/evidence boundary;
- a browser capture at desktop and 390x844 when rendering changes.

Planning-only notes, branch creation and statements that the Mother is “thinking” do not count as execution.

### Example bounded tasks

- Landscape Mother: one karst hill/cavity cell generated from macro profile + event field, with neutral reconstruction and protected-truth mask.
- Ocean Mother: one 24–40 m shoreline cell generated from bed profile + wave field + swash memory, with shared `shoreAt`/`swashAt` queries.
- Ocean Life Mother: one fish or coral body expressed as named anatomical/structural parts tied to a shared habitat field.
- Game Mother: one complete fishing interaction consuming the same fish, line, water and habitat objects; no duplicate gameplay-only proxy objects.
- Brick/Tiles/House Mothers: one object whose dimensions, assembly order, joints and material zones can be regenerated and inspected from a compact contract.

## Acceptance principle

A Mother has understood this reference only when another execution lane can consume its contract and regenerate or use the object without reverse-engineering private implementation details. Visual resemblance alone is insufficient.
