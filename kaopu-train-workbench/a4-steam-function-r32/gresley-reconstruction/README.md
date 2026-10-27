# Retained finite Gresley closure study

This is an independent numerical reconstruction from the exact central scalar constructors in `../r25/scene.js`, driven by the existing finite outside solver in `../r25/outside_valve_solver.js`. It is not a recovered original generator, historical A4 calibration, a middle valve-chest installation, a whole-locomotive acceptance result, or a replacement for the whole train with a component demo.

No R25 file, scalar field, installation, renderer, Git repository, or public preview was changed by this study. All 519 original fields remain untouched. The module exports a pure CPU interface for a separately authorized integration; it does not attach itself to the renderer or modify `DYNAMIC`.

## Result and hard limit

The retained pin-center topology does support an exact finite planar mathematical closure. The actual outside valve positions are used, at one shared absolute theta. Neither `-qLeft - qRight` nor a fitted sinusoid drives any pin. That ideal expression is calculated only for reporting the finite correction.

However, the retained physical geometry already fails packaging at the equal-lever center. Both distinct lever plates occupy the same `Y = 1.48 ± 0.012 m` slab, and their overlapping eye annuli contain a common interior ball of radius 6 mm. The reference witness and exact scalar evaluations are in `PHYSICAL_PACKAGING_QA.json`. This is a proven pre-existing volumetric overlap, not merely pin contact. Transforming those rods faithfully preserves the unresolved packaging rather than curing it.

The existing middle spindle remains on the original inferred horizontal line `X = 0, Y = 1.48`, translating only along Z. A visible spindle direction is not evidence of an actual prismatic guide or valve chest. No middle chest, valve heads, porting, guide mounting, changed inclination, axial rod layering, clevis, spacer, or bearing installation was invented. Physical integration needs an authoritative middle valve axis/guide/chest arrangement and joint axial-layer/clevis/bearing constraints; those constraints are not present in these retained constructors.

## Recovered geometry

All listed coordinates are metres, in the whole train's existing axes. Pin normals are Y, since the original `mDisc` constructors specify `axis = 1`. All five rod constructors also specify `axis = 1`, so they lie in XZ and have unchanged Y thickness.

| Label | Retained role | X | Y | Z at theta 0.4 |
|---|---|---:|---:|---:|
| O | Fixed pivot | 0 | 1.48 | 5.55 |
| R | Outside right input | 0.98 | 1.48 | 5.303397901282459 |
| L | Outside left input | -0.98 | 1.48 | 5.273127325306952 |
| A | Long lever end | 0.978544348142550 | 1.48 | 5.603394369724456 |
| C | Short lever end / equal center | -0.489272174071275 | 1.48 | 5.523302815137772 |
| B | Equal left end | -0.976734264073580 | 1.48 | 5.573109549728431 |
| E | Equal middle end | -0.001810084068970 | 1.48 | 5.473496080547112 |
| M | Middle spindle front pin | 0 | 1.48 | 5.173501541270706 |

The middle spindle rear is `(0, 1.48, 4.023501541270706)` and its length is 1.15 m. Its front pin is M. The outside spindle front input pins are exactly each outside `spindleZ + 1.15 m`, to retained floating-point precision.

Derived retained lengths:

- OA = 0.98 m, OC = 0.49 m, with C opposite A about O.
- CB = CE = 0.49 m, with E opposite B about C.
- RA = LB = ME = 0.30 m.
- The actual decimal constructor endpoints, primitive syntax, exact extracted source lines, ratios, and branch signs are in `REFERENCE_CONSTRUCTORS.json`. The module derives lengths from those endpoints rather than introducing a new installation dimension.

## Finite equations and branch

Work in two dimensions `(X,Z)` and retain Y separately.

1. R = `(0.98, outsideRight.spindleZ + 1.15)` and L = `(-0.98, outsideLeft.spindleZ + 1.15)`.
2. A is the intersection of the circle centered O with radius OA and the circle centered R with radius RA. Choose the branch whose `cross(R-O, A-O)` is positive, as in the exact reference pose.
3. C = O − (OC/OA)(A−O).
4. B is the intersection of the circle centered C with radius CB and the circle centered L with radius LB. Choose the branch whose `cross(L-C, B-C)` is negative, as in the reference.
5. E = C − (CE/CB)(B−C).
6. Keep `M.x = 0` and choose `M.z = E.z − sqrt(ME² − E.x²)`, the retained lower assembly branch.
7. Translate the entire original middle spindle to M, preserving its length, X and Y.

Every circle intersection uses the finite equation, not a small-angle lever sum. Infeasible/tangent circles and nonpositive output radicands throw rather than silently substituting a trajectory.

`qMiddle` is reported from the same longitudinal datum 5.25 m used for the outside front pins, namely 4.1 m plus their retained 1.15 m extension. This reporting datum does not introduce a central valve chest or assert its neutral port position.

## CPU integration contract

The module supports both CommonJS and a browser global `createGresleySolver`:

```js
const central = createGresleySolver(SCENE, DYNAMIC, outsideSolver);
const state = DYNAMIC.state(Time, Location, ObjectState);
const pose = central.pose(state.theta);
const frame = central.transformFor(part.id, pose); // or state.theta
const world = central.transformPoint(sourcePoint, frame);
const source = central.transformPoint(world, frame, true);
```

For an already computed outside pair, `central.fromOutside(leftPose, rightPose)` uses those exact outputs and rejects different theta values or swapped sides. `central.atTime(Time, Location, ObjectState)` derives theta through the existing `DYNAMIC.state`, without inventing a second clock. Reference geometry stays at theta 0.4.

The original baseline must remain frozen if an integration offers baseline/candidate modes. This pure study module does not decide renderer mode. It is safe to use it only where the parent explicitly enables the inferred mathematical chain and retains the physical failure labels.

`transformFor(partId, thetaOrPose)` returns:

- `forwardXZ = [a,b,tx,c,d,tz]`, applied as `x' = a*x + b*z + tx`, `z' = c*x + d*z + tz`.
- `inverseXZ` with the same layout for scalar inverse queries.
- `Y` unchanged, plus transform classification, theta and explicit `wholeMechanicalAcceptance: false`.
- Identity for the retained fixed pivot pin. Unknown or noncentral fields return null, never a guessed attachment.

The 14-entry persistent whitelist is exported as `central.whitelist` and independently recorded with exact scalar source and original AABBs in `FIELD_MAPPING_QA.json`:

| Field suffix, under `valve/` | Transform | Reference anchor | Orientation endpoint |
|---|---|---|---|
| gresley_two_to_one_lever | Rigid XZ | O | A |
| gresley_equal_lever | Rigid XZ | C | B |
| gresley_right_short_link | Rigid XZ | R | A |
| gresley_left_short_link | Rigid XZ | L | B |
| gresley_middle_short_link | Rigid XZ | M | E |
| gresley_fixed_pivot_pin | Identity | O | Not applicable |
| gresley_right_input_pin | XZ translation | R | Not applicable |
| gresley_left_input_pin | XZ translation | L | Not applicable |
| gresley_long_end_pin | XZ translation | A | Not applicable |
| gresley_equal_centre_pin | XZ translation | C | Not applicable |
| gresley_equal_left_end_pin | XZ translation | B | Not applicable |
| gresley_equal_middle_end_pin | XZ translation | E | Not applicable |
| gresley_middle_valve_crosshead_pin | XZ translation | M | Not applicable |
| middle_valve_spindle_inferred_horizontal | XZ translation | M | Not applicable |

These are 13 moving fields and one fixed field. Cylinder, pressure, chest, outside gear, noncentral spindle and all other objects are not in the whitelist.

## Verification

Run from any directory:

```sh
node a4-recovered/gresley-study/test_gresley.js
node a4-recovered/gresley-study/test_field_mapping.js
python a4-recovered/gresley-study/certify_input_domain.py
python a4-recovered/gresley-study/physical_packaging_check.py
```

Results already obtained:

- 14,401 common-theta samples over one complete revolution, beginning at theta 0.4; forward, reverse, random access, periodic seams and explicit absolute-Time checks pass.
- All eight reference pin centers recover within 2.23e−16 m; the middle rear endpoint recovers exactly at the tested precision.
- Maximum rigid link-length error: 1.50e−15 m. Maximum outside squared-equation residual: 8.89e−15 m².
- Middle q range: −0.0785786991 to +0.0803930028 m in that sampled cycle.
- Reference finite-minus-ideal correction: +26.7678601 µm. Cycle correction range: +11.6218 to +68.9719 µm.
- 361 transform phases and 40,432 original-AABB corner checks pass. Maximum source-joint mapping error: 1.78e−15 m; inverse error: 1.85e−15 m; Y error: exactly zero.
- `NUMERICAL_QA.json` includes unchanged R25 source hashes. `FIELD_MAPPING_QA.json` contains all exact field mappings and no-auto-attachment checks.

### What is continuous and what is sampled

`CONDITIONAL_DOMAIN_CERTIFICATE.json` uses outward-rounded, 60-digit Decimal interval arithmetic over 4,096 subboxes to enclose the finite central equations for every independent input pair `left.spindleZ, right.spindleZ ∈ [4.02,4.18] m`. It proves positive radicands for the retained branches throughout that rectangle. Conservative lower bounds are 0.07605 m², 0.04260 m² and 0.08894 m² for the right circle, left circle and middle slider respectively.

All sampled actual outside inputs lie inside that rectangle. The certificate is conditional on those input bounds; it is not a validated continuous proof of the upstream nonlinear outside solver, so `allPhaseProof` remains false for the complete chain. The dense phase sweep remains a numerical test, not a proof of every physical phase, collision clearance, historical accuracy, pressure timing or whole-train function.

The proven source overlap means physical acceptance remains false regardless of pin-center closure. Do not add arbitrary offsets to make an image appear correct.
