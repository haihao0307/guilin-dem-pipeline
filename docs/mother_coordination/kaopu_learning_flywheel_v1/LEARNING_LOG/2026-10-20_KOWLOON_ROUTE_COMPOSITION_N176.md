# KAOPU Learning Flywheel N176 — Kowloon route-composition evidence

## Bounded question

When two stair groups, their retained floor-002 transfer, and a nearby door passage each pass their own geometry checks, what additional evidence is required before the system may claim that one body envelope can traverse continuously from floor-001 to floor-003?

## Exact subject and evidence

Current `main` is `5543f756ca3af1428323696324303fa70b8de850`. R2, the replication gate, freshness gate, root `AGENTS.md`, #91/#63 and applicable regression cases were read before selecting this question.

The exact production subject is draft PR #321 at `5f062d7b4580d1671e47fbf671be49bd3e52d108`, successful Chromium workflow run `39436988546`, and public R05:

<https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/kowloon-building-mother-r01/r05.html>

R05 supplies substantial local evidence:

- two generated closed dogleg stair groups for floor-001→002 and floor-002→003;
- actual-mesh support, penetration and headroom checks, with 2.84 m minimum authored stacked headroom;
- one retained floor-002 host slab region and a transfer edge between the first arrival and second departure;
- guards with named-host support/contact checks;
- a separate 0.70 m × 0.70 m × 1.90 m doorway prism audit that turns from the doorway to both floor-002 lane centres;
- negative controls for lifted/overhanging guards, stair-surface penetration, door intermediate-angle obstruction, closed/45° doorway blockage, and unsupported/invalid edits.

The implementation also preserves the limit honestly. `graph.connected` means that the three dependency edges are enabled. The same graph sets `navigationConnectionEnabled=false`, `circulationComplete=false`, and `groundConnectionAdded=false`. The README says the transfer is not enabled navigation/evacuation and does not claim a complete navigable building.

## Finding

`TOPOLOGY_CONNECTED__NO_ROUTE_CLAIM`

No production defect is recorded. PR #321 does not make the stronger claim.

The new evidence distinction is:

| State | Required evidence |
| --- | --- |
| `TOPOLOGY_CONNECTED` | Required nodes/edges exist and are enabled. |
| `LOCAL_GEOMETRY_VERIFIED` | Each stair, landing, guard or doorway passes its own scoped geometry/support gate. |
| `GEOMETRY_ROUTE_VERIFIED_SCOPED` | One declared ordered route is swept end-to-end with the same body envelope, continuous support and transition checks, and every mandatory movable state bound. |
| `NAVIGATION_ENABLED` | A runtime navigation agent/path uses that verified geometry under a declared locomotion contract. |
| `EGRESS_CERTIFIED` | Separate code, capacity, fire, accessibility and regulatory evidence; never implied by the prior states. |

The first two states do not compose into the third automatically. Endpoint coincidence and `edges.every(e => e.effectiveEnabled)` prove topology/dependency connectivity; they do not sweep the body envelope through every tread, transition seam, turn, opening edge and landing under one stateful route contract.

The door remains a separate local proof unless the Mother declares it a mandatory edge of the floor-001→003 route. A nearby verified door must not be silently inserted into the route, and a mandatory door must not be silently omitted.

## Minimal falsifiable single-Mother trial

Keep the current honest R05 status unchanged and add one opt-in route proof candidate:

1. Declare the ordered route and mandatory-state set explicitly: floor-001 departure → all stair-001-002 path segments → floor-002 arrival → retained-slab transfer → floor-002 departure → all stair-002-003 path segments → floor-003 arrival. Include the door only if the intended route actually requires it.
2. Reuse one fixed body envelope for the whole trial (the existing 0.70 m square × 1.90 m prism is a suitable first bounded control, not a compliance standard).
3. Sweep the complete envelope over every segment and transition/turn against the actual floor, stair, guard, wall and declared door-state meshes. Do not replace this with centreline or endpoint checks.
4. At every sample require whole-footprint support, headroom, permitted step/riser discontinuity and collision clearance under the same geometry/version digest.
5. Negative controls: move a guard 20 mm into the transfer turn; introduce a 20 mm unsupported seam; lift one tread; and, only when the door is mandatory, bind a closed door state. Each must hold the route claim while the unchanged positive fixture passes.
6. Emit a route receipt containing ordered node/segment IDs, envelope dimensions, mandatory states, geometry digest, sample/continuous-method semantics, minimum support/headroom/clearance results, and explicit limits.

The isolated evidence classifier reproduces R05's honest no-route-claim state plus route-claim, unsupported-transition, verified-route, optional-door, mandatory-door and disconnected controls: 7/7.

## Disposition and boundaries

This is a technical-method Candidate, not a new regression case, because no user correction or false production claim was observed. It does not alter PR #321, enable navigation, certify egress, infer a measured interior, or lower any existing geometry gate.

- Production local geometry evidence: `IMPLEMENTED=true`, `GATE-RUN=true` at exact PR head/workflow above.
- End-to-end geometry-route proof: `IMPLEMENTED=false`, `GATE-RUN=false`.
- Candidate classifier only: `GATE-RUN=true` (7/7 synthetic controls).
- Mother route: `POSTED=false` until the directed PR comment is created.
- `ACKNOWLEDGED / ADOPTED / USER-ACCEPTED=false`.
- Teacher lifecycle: `NOT_QUERIED/UNKNOWN`; no external teacher was needed for this bounded internal evidence-composition question.
