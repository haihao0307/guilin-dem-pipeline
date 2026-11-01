# KAOPU Learning Flywheel N227 — A6 wheel relationship scope

## One bounded question

Does the current `verified` A6 wheel checkpoint machine-bind part identity, parent/subordinate relationships, and transmission relations, or only geometry/screenshots?

## Exact subject

- Library identity: `libfile_2cabe4dab46c8191b45f04e641c12ca2`
- Library version observed: `13`
- Archive: `A6_SPACETIME_R01_WHEEL_VERIFIED_CHECKPOINT_20261101.zip`
- SHA-256: `1bf084b6de355c37538e1cb6b070945163aeb9137e1730957919f61a2a5a060b`
- Package is paused pending user method discussion; no new modeling/fitting is claimed after pause.

## What the package actually proves

The checkpoint has meaningful, bounded positive evidence:

- 14 wheelsets / 28 wheel faces / 5 shared wheelset models / 624 named leaf boundary views.
- Stable canonical identities and placement events exist.
- Parent matrices are compared with the independently executed source generator at five Times.
- 624 leaf world points are compared at three shared Times (1,872 checks).
- Native wheel equivalence reports 183,300 samples and maximum error about `5.8465e-8` source units.
- The package explicitly keeps physical scale, wheel-rail contact, bearings/loads, suspension, brakes, couplers, and several placement questions UNKNOWN.

Therefore this is not a stale screenshot bundle, and it would be incorrect to claim that parent relationships are wholly absent.

## Remaining failure mechanism

The tests bind identity, placement/world matrices, leaf membership, and shared Time tightly enough for geometry/time equivalence. They do **not** expose a separate transmission/kinematic edge graph with a fail-closed verifier that answers which axle/driver drives each wheel and whether every driver reference and law is valid.

This distinction matters:

1. **identity** — the part has a stable ID;
2. **placement** — the part is spatially parented under an assembly;
3. **structural/subordinate** — the part is a member of the declared owner;
4. **transmission/kinematic** — a declared driver causes the driven part's motion under a checked law;
5. **physical attachment/contact** — an engineering claim, still UNKNOWN here.

A shared Time value and a correct world matrix can prove numerical motion equivalence without proving layer 4. Geometry/time evidence must not silently inherit the broader label “relationship verified.”

## Candidate decision

`HOLD_A6_WHEEL_TRANSMISSION_RELATION_UNBOUND_NOT_BROAD_RELATIONSHIP_VERIFIED`

Keep the existing geometry/time evidence. Narrow the claim to `wheel_geometry_time_verified` until a separate relation receipt binds placement, subordinate, and transmission edges. Physical attachment remains UNKNOWN.

## Minimal falsifiable gate

The Candidate probe separates seven controls:

1. complete logical graph → `ACCEPT_LOGICAL_RELATION_GRAPH_CANDIDATE`;
2. dangling placement parent → `HOLD_PARENT_RELATION_UNRESOLVED`;
3. wheel under the wrong assembly → `HOLD_PARENT_SCOPE_MISMATCH`;
4. member bypassing its wheel owner → `HOLD_SUBORDINATE_RELATION_MISMATCH`;
5. geometry/time proof without a transmission edge → `HOLD_TRANSMISSION_RELATION_UNBOUND`;
6. missing transmission driver → `HOLD_TRANSMISSION_DRIVER_UNRESOLVED`;
7. wrong driver role → `HOLD_TRANSMISSION_DRIVER_UNRESOLVED`.

Replay: **7/7 PASS**. This only validates the Candidate decision semantics; it is not a production train gate.

## Proposed receipt fields

- `identityGraphRef`
- `placementEdgeCount` / `placementVerifierVerdict`
- `subordinateEdgeCount` / `subordinateVerifierVerdict`
- `transmissionEdgeCount`
- `transmissionDriverRefsResolved`
- `kinematicLawCheck`
- `physicalAttachmentStatus`
- `geometryTimeReceiptRef`

## Applicability boundary

Local to Vehicle/Mechanical assemblies that make relationship claims. It does not alter the A6 asset, reject its geometry/time work, certify engineering, change the R2 OS, or impose a global gate. The same layered relation receipt may later be auditioned for cars, trains, articulated machinery, rigs, and other assemblies, but no transfer is assumed here.

## Mother-directed questions

The actual Vehicle/Mechanical Mother should answer only:

1. Is an explicit axle/driver-to-wheel transmission edge relevant to the current A6 path?
2. Does an existing production gate already validate the exact transmission edge, driver identity, and motion law?
3. Which existing placement/member records can populate the separated receipt without duplicating authority?
4. What smallest production-bound mutation test can falsify the relation graph while leaving geometry unchanged?

## State

- `POSTED`: issue #91 comment `6557500053`
- `ACKNOWLEDGED`: false
- `IMPLEMENTED`: Candidate probe only
- `GATE-RUN`: Candidate 7-control replay only
- `ADOPTED`: false
- `USER-ACCEPTED`: false

No main branch, production Mother, private asset, renderer, or global gate was modified.
