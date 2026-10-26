# KAOPU Learning Flywheel — OpenUSD dual-local joint frame candidate (N196)

- Date: 2026-10-27
- Trigger: Motor N194/N195 repeated center-pivot failure and coordination issue #91 root-cause review
- Bounded question: does OpenUSD Physics add a concrete, transferable joint representation beyond KAOPU's current `hingeLocal / parentAssembly` wording?
- Screening status: `TEACHER_CANDIDATE`
- Lifecycle: `RADAR_FOUND -> TEACHER_CANDIDATE`
- Registry/referenceSet: not entered
- Affected Mothers: Motor, Aircraft control surfaces, Building doors/windows
- Mother query: pending targeted #91 routing; no ACK claimed

## What it knows that KAOPU Current Best View does not yet encode

KAOPU currently names an explicit hinge and checks a fixed point plus child-relative invariance. OpenUSD adds a more complete constraint contract:

1. `body0` and `body1` are explicit relationships;
2. each side stores its own local joint pose: `localPos0/localRot0` and `localPos1/localRot1`;
3. both local poses must map to the same world joint frame;
4. revolute `axis` and lower/upper angular limits are separate from geometry;
5. optional drive parameters are separate from joint identity and limits;
6. a missing body relation can mean a world anchor, rather than an implicit guess.

The novel verifier invariant is therefore not merely “one hinge point does not move.” It is:

```
world(body0) * jointFrame0 == world(body1) * jointFrame1
```

within a declared positional and angular tolerance, while child-part relative transforms remain invariant.

Primary sources:

- OpenUSD Physics schema: https://openusd.org/dev/api/usd_physics_page_front.html
- Joint proposal/schema: https://openusd.org/dev/wp_rigid_body_physics.html
- v26.11.1 source release: https://github.com/PixarAnimationStudios/OpenUSD/releases/tag/v26.11.1
- parser tests: https://github.com/PixarAnimationStudios/OpenUSD/blob/v26.11.1/pxr/usd/usdPhysics/testenv/testUsdPhysicsParsing.py
- license: https://github.com/PixarAnimationStudios/OpenUSD/blob/v26.11.1/LICENSE.txt

## Teacher screening

1. **Source/provenance:** official Pixar OpenUSD documentation and repository.
2. **Maintenance:** v26.11.1 published 2026-10-21; current repository and generated 2026 documentation are active.
3. **Runnable evidence:** C++/Python implementation plus parser tests cover joints, local poses, limits and articulation topology.
4. **License:** Tomorrow Open Source Technology License 1.0, Apache-2.0-derived with a modified trademark section. Reuse needs this exact license, not an “Apache-2.0” shorthand.
5. **Direct relevance:** directly addresses Motor's absent explicit joint frames and transfers to doors, hatches, aircraft control surfaces and architectural openings.
6. **Novelty:** dual body-local joint frames and a frame-closure invariant are not yet present in the KAOPU Motor Candidate contract.
7. **Dependency/cost:** full OpenUSD integration is heavy (C++/Python build and scene-schema dependency). KAOPU should audition the field semantics in its own small JSON/JS structures first.
8. **Risks:** importing the library or copying defaults would be unnecessary; axes, handedness, units and tolerances must be bound to each Mother. Physics drive defaults are not visual acceptance. No external mesh or asset is required.

## Minimal synthetic replay

Angles: `0 / 15 / 35 / 65°`.

| Fixture | joint-frame closure error | child-relative error | Result |
|---|---:|---:|---|
| dual local frames + edge hinge + attached child | 0 | 0 | PASS |
| center pivot labeled as hinge | 0.752219452 | 0 | REJECT |
| correct edge hinge but detached child | 0 | 0.735138971 | REJECT |

Observed decisions matched all three expected decisions.

This proves only that the representation exposes both N194 failure modes. It does not prove production physics, browser behavior, visual quality or user acceptance.

## Candidate translation for one-Mother trial

Task Anchor fields:

```
jointId
jointType
body0
body1
localPos0
localRot0
localPos1
localRot1
axis
lowerLimit
upperLimit
attachedChildren
positionEpsilon
orientationEpsilon
samples
```

Delivery Receipt fields:

```
maxJointFramePositionError
maxJointFrameOrientationError
maxChildRelativeTransformError
limitViolations
sampleResults
verifierIdentity
```

Verifier gate:

- reject if either body relation or either local joint frame is missing;
- reject if the two world joint frames do not close within tolerance;
- reject if the declared axis or limits are absent for an articulated revolute joint;
- reject if an attached child changes its parent-relative transform;
- include the center-pivot negative control;
- producer cannot self-approve.

## Applicability and rollout boundary

- Use only as a local Candidate schema for Motor first.
- Reuse existing `MOTOR-ARTICULATED-CHILD-TRANSFORM-001`; do not duplicate a regression.
- Do not require OpenUSD as a runtime dependency.
- Do not globally adopt until Motor Mother ACKs relevance and a real source implementation passes the same gate.
- Aircraft and Building remain `NOT_QUERIED/UNKNOWN`.
- No change to R2 OS or production branches.
