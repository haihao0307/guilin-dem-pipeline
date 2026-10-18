# A6 outside valve gear: independent constraint experiment R01

This directory is an **unpublished mechanical research experiment**. It imports the frozen A6 native R02 as a read-only comparison. It does not change that page, replace its components, or clear its six reported valve-reference collisions.

Implemented progress:

- A three-pin combination lever driven by the real R02 crosshead and an eccentric/expansion-link/radius-rod chain.
- A curved expansion-link sliding die plus a separate straight rear slot in the extended radius rod, supported by a fixed lifting-arm die at one reverser setting.
- Fixed-length rigid links, deterministic numerical constraint solving, non-toggling four-bar branch, exact R02 piston motion, full-cycle root closure and slot-travel limits.
- Twenty same-name finite native revisions plus twelve explicit additional pins, bored die blocks and attached guides/supports, preserving all 338 inherited names and four existing piston additions.
- Complete mesh/BVH sweep against every mechanical body and the full default shell, retaining the first genuine failure before repairs.
- A read-only reproduction of the six R02 triangle witnesses, including actual world-space triangle coordinates.

Run from any directory:

```sh
node a4-mark3-rule-conversion-r01/a6-valve-gear-experiment-r01/tests/valve-constraints.test.mjs
node a4-mark3-rule-conversion-r01/a6-valve-gear-experiment-r01/tests/audit-r02-witnesses.mjs
node --test a4-mark3-rule-conversion-r01/a6-valve-gear-experiment-r01/tests/valve-primitives.test.mjs
node a4-mark3-rule-conversion-r01/a6-valve-gear-experiment-r01/tests/valve-native-adapter.test.mjs
node a4-mark3-rule-conversion-r01/a6-valve-gear-experiment-r01/tests/valve-sweep-report.mjs
```

The tests write reports only inside this experiment's `docs/` directory.

## API

- `createValveConstraintModel()` creates the explicit design candidate and the numerical assembly branch.
- `evaluateValveConstraints(model, phaseRad)` returns joint positions and every fixed-length/sliding residual. It does not drive old incompatible meshes.
- `createValveNativeAdapter({baseModel})` supplies all 338 inherited part names with same-name replacements, plus 12 explicitly additional parts and 22 valve-moving names.
- `evaluateValveNativeAdapter(adapter, phaseRad)` supplies named rigid delta matrices from native phase-zero geometry. Combine with the base R02 matrices; both sets are disjoint.
- `screenFiniteValveSweep(adapter)` uses the complete default shell and all mechanical bodies.
- `validateValveConstraintCycle(model, {samples:1440})` reports 1,441 poses, the actual continued-root closure error, travel and support margins.

Coordinates are `[y,z]` in metres. The same wheel phase convention as R02 is used. Numerical branch seeds contain only three scalar root unknowns; every requested pose is solved again. No vertex animation cache, source animation, sinusoidal decorative motion, or mesh scaling is used.

## Frozen audit result

Final 1° sweep: 336,534 complete native triangles, 50 moving bodies, 404 static bodies including the 94-part default shell; zero sampled surface intersections. All eight formerly colliding pairs have independent phase-invariant lateral separation proofs. There are still **302 unresolved conservative continuous candidates**; this is not a continuous triangle clearance certification. Final runtime hashes match the sweep report. The original R02 six-witness evidence and first experimental failure remain preserved.

Concise machine-readable summary: [FINITE_VALVE_PUBLIC.json](docs/FINITE_VALVE_PUBLIC.json).

## What is and is not complete

The point-joint mechanism closes over a revolution with the documented 660.4 mm piston stroke. Finite native geometry now accompanies those constraints, including open bores, real die blocks and slots, attached guides and fixed supports. See FINITE_VALVE_SWEEP_LATEST.json for the current full-assembly sweep; no-witness conservative candidates are not a continuous triangle clearance certificate. Actual valve events, inside/Gresley motion, historical side phases and engineering loads remain unresolved. Never apply these solved joints to the old R02 valve meshes: their lengths and topology are incompatible.

See [the engineering proposal](docs/VALVE_MECHANISM_PROPOSAL_ZH.md), [constraint report](docs/CONSTRAINT_CYCLE_REPORT.json) and [six-witness evidence](docs/R02_SIX_COLLISION_WITNESSES.json).
