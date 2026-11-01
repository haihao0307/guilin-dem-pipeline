# KAOPU Learning Flywheel N229 — A6 native frame-authority relation scope

## One bounded question

Does A6 checkpoint version 27 close the existing axle/driver relationship gap, especially through the newly added `native-time-adapter-r01`, or does it still preserve `Time.axleID` as unvalidated metadata?

## Exact current subject

- Library identity: `libfile_2cabe4dab46c8191b45f04e641c12ca2`
- observed version: `27`
- modified: `2026-11-01T19:10:11.164059Z`
- archive SHA-256: `4e6a823a900cc113c683a6d5c0aa769084d5cea0ed512a220a359b7e92b228a0`
- size: `137,665,193` bytes
- entries: `12,310`

The four current main baseline documents retain the same blob SHAs as N228. Issue #63 has no new feedback. Issue #91 has a newer Mechanical prism gate note but no acknowledgement or implementation receipt for N227/N228's A6 relation result.

## Fresh v20 -> v27 delta

- 516 paths added and 1 removed;
- no same-path file changed;
- current wheel contracts, canonical train, current evaluator, wheel builder, and the three current wheel/assembly test files are byte-identical to v20.

The relevant genuine addition is `mother-rebuild-r01/native-time-adapter-r01`. It explicitly prevents static/dynamic frame-authority mixing and reuses the existing `evaluateCurrent` world frames without a second transform. This is useful, bounded work and must not be dismissed.

Unmodified v27 replay:

- current wheel/canonical-binding/assembly suites: **18/18 PASS**;
- native frame-authority adapter suite: **5/5 PASS**.

These results preserve geometry/time and exclusive-frame-authority evidence. They are not axle/driver relation negative controls.

## Exact counterexample

The exact v27 canonical subjects were cloned in memory. Only this field changed:

`train88/A6/A4/drive_wheel_rear.Time.axleID`

from `locomotive.driver.1` to known wrong-assembly token `tender.tender.1`.

Results:

- canonical imports accepted the mutation;
- current evaluator accepted it at Times `0`, `0.53`, and `2.4`;
- 30,240 current world-matrix scalar comparisons, changed scalars: **0**;
- the new native frame-authority adapter accepted it at Times `0`, `0.53`, and `1.4`;
- 7,038 frame queries and 110,256 matrix scalar comparisons, changed scalars: **0**.

The adapter validates provider selection, clock shape/reference, finite seconds, placement time, stable identity, and snapshot revision. It does not consume `Time.axleID`, resolve an axle/driver edge, or reject a correct token from the wrong assembly.

## Decision

`HOLD_AXLE_RELATION_METADATA_NOT_RUNTIME_OR_VERIFIER_BOUND`

This is new subject-level evidence for a new v27 consumer, not a new failure class. The existing `CANDIDATE_GEOMETRY_TIME_NOT_RELATION_GRAPH_001` was extended; no duplicate regression was created.

The adapter remains valuable for its stated frame-authority scope. It must not be promoted into transmission/kinematic relationship proof.

## Minimum repair trial

For one drive wheel:

1. bind `wheelInstanceID -> axleOrDriverInstanceID -> motionLawRef`;
2. require referenced identity, assembly membership, and driver role to resolve;
3. reject `tender.tender.1` for a locomotive drive wheel even though the token exists;
4. reject a missing or wrong-role driver;
5. run the independent verifier while geometry remains fixed.

## Applicability boundary

This does not reject A6 geometry, shared Time, the exclusive frame-authority adapter, or its 5 passing tests. It does not certify contact, forces, transmission hardware, or production adoption. It changes no private package, production Mother branch, main, or global OS gate.

## State

- `POSTED`: pending directional follow-up
- `ACKNOWLEDGED`: false
- `IMPLEMENTED`: Candidate probe/regression update only
- `GATE-RUN`: exact v27 current + native-adapter mutation, plus 18/18 and 5/5 unmodified replay
- `ADOPTED`: false
- `USER-ACCEPTED`: false
