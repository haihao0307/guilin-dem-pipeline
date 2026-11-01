# KAOPU Learning Flywheel N228 — A6 wheel axle-relation mutation

## One bounded question

Does A6 checkpoint version 20 close N227 by binding each wheel's `Time.axleID` to the correct owning/driver relationship, or is the field still inert metadata?

## Exact current subject

- Library identity: `libfile_2cabe4dab46c8191b45f04e641c12ca2`
- observed version: `20`
- modified: `2026-11-01T15:40:41.588506Z`
- archive SHA-256: `8fb6cedbdf48416902b60b9cb8633911654043435e16b085177cb12fcead658e`
- size: `89,041,083` bytes

The current main baseline documents remain unchanged, and issue #91 contains no acknowledgement after N227 comment `6557500053`.

## Fresh package delta

Compared with the exact N227 v13 archive:

- file entries: `11,115 -> 11,794`;
- 679 paths added and 5 old v12 checkpoint-history paths removed;
- the current wheel contract, canonical train, wheel tests, canonical-binding tests, assembly tests, current evaluator, and wheel builder are byte-identical;
- the added `event-assembly-binding-audit-r01` repairs a shared return-surface dependency and explicitly reports `instancesAndEventsIdentical:true`; it is useful surface-authority work, not an axle/driver relation repair.

Therefore a newer/larger archive is not treated as wheel-relationship progress by itself.

## Positive evidence preserved

The unmodified v20 package reran:

- current assembly tests;
- canonical binding tests;
- current wheel tests.

Result: **18/18 PASS**. These retain the package's meaningful identity, placement, shared-Time, topology, and geometry equivalence evidence.

## Concrete counterexample

The exact current canonical train was cloned in memory. Only one field changed:

`train88/A6/A4/drive_wheel_rear.Time.axleID`

from the correct drive token:

`locomotive.driver.1`

to a known token from the wrong assembly:

`tender.tender.1`

Results:

- canonical import accepted the mutation;
- evaluator accepted it;
- evaluated at Times `0`, `0.53`, and `2.4`;
- 30,240 world-matrix scalar comparisons;
- changed scalars: **0**.

The current evaluator derives wheel rotation from `frameLaw`, `radiusFamily`, shared travel, and nominal family radius. It does not consult `Time.axleID` when producing frames. The field can therefore be semantically wrong while all present geometry/time outputs remain identical.

## Decision

`HOLD_AXLE_RELATION_METADATA_NOT_RUNTIME_OR_VERIFIER_BOUND`

This confirms and sharpens N227; it is not a new failure class. Extend `CANDIDATE_GEOMETRY_TIME_NOT_RELATION_GRAPH_001` rather than creating a duplicate regression.

## Minimum repair trial

For one A6 drive wheel only:

1. bind `wheelInstanceID -> axleOrDriverInstanceID -> motionLawRef`;
2. require every referenced identity and role to resolve;
3. reject a valid token from the wrong assembly;
4. reject a missing driver;
5. mutate only the relation edge while geometry stays fixed;
6. require the independent verifier to observe the rejection.

The existing `Time.axleID` may remain a descriptive key, but it cannot serve as relationship proof until the gate consumes and validates it.

## Applicability boundary

This does not reject the A6 wheel geometry, imply that a physical axle model already exists, certify contact/forces, modify the private package, or require a global OS change. It only blocks promotion from geometry/time equivalence to an axle/driver relationship claim.

## State

- `POSTED`: issue #91 comment `6560161905`
- `ACKNOWLEDGED`: false
- `IMPLEMENTED`: Candidate mutation probe only
- `GATE-RUN`: exact v20 in-memory mutation plus unmodified 18-test replay
- `ADOPTED`: false
- `USER-ACCEPTED`: false
