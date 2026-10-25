# Finite outside-valve reconstruction study

## Result and boundary

The retained own scalar geometry supplies enough mutually consistent pin positions, rigid lengths, and a curved slot to reconstruct a finite left/right valve mechanism under explicit kinematic assumptions. The solver is driven by the existing common `DYNAMIC.pose(theta, side)` crank and the same crosshead. It does not substitute sinusoidal valve travel.

This is **newly reconstructed, inferred candidate kinematics**, not the recovered R20 generator, an original A4 design, or historical dimensions. The observed geometry is itself marked `fixed_theta_0.4_inferred_R20_geometry_not_historical_calibration` in R24. No files under R24, shaders, browser state, Git state, or published files were changed by this study.

The lift-top location is held at its retained setting (described upstream as reverser .75). A reversible control-to-lifting-arm map is **not** recoverable from this single setting and is not invented here. Do not expose a live reverser control using this solver.

All 14 central/conjugated fields are explicitly unsupported and remain unmapped. This study does not make the middle valve placement valid, does not animate it with `−left−right`, and does not establish whole-train acceptance. A subsequent integration must continue to display the known central-chain gap honestly.

## Files and immediate API

- `outside_valve_solver.js`: browser global `createOutsideValveSolver`, also CommonJS export. Pure CPU pose/rigid transforms. Does not patch DYNAMIC or any shader.
- `solve_outside.py`: independent NumPy/SciPy closure and forward/reverse full-cycle sweep.
- `extract_reference.py`: extracts exact numeric constructors from R24's own SCENE.sources.motion, without mesh/triangle sampling.
- `SOURCE_OBSERVATIONS.json`: exact XYZ coefficients, source function, source line, pin distances, slot data, and input hash.
- `reference-endpoints.json`: concise YZ reference state.
- `PYTHON_CLOSURE_QA.json`, `JS_CLOSURE_QA.json`, `FIELD_MAPPING_QA.json`, `JACOBIAN_QA.json`: test results.
- `left-cycle.json`, `right-cycle.json`: numeric solved states, not an animation lookup table.
- `retained-motion.glsl`: unmodified extraction of the user's own analytic source, supplied only for inspection.

Usage:

```js
const solver = createOutsideValveSolver(DYNAMIC);
const left = solver.pose(commonTheta, 'left');
const right = solver.pose(commonTheta, 'right');
const transform = solver.transformFor('valve/left_radius_rod', left);
// Or transformFor(partId, commonTheta); poses are cached per side at that theta.
```

`pose` returns:

- `yz`: exact solved joint dictionary `{B,C,E,J,T,H,K,D,V,U,L,A}` in YZ metres.
- `pins`: descriptive XYZ joint-center dictionary, projected into the gear plane X=±.98: `mainCrankPin`, `crossheadDropPin`, `eccentricPin`, `expansionTailPin`, `fixedTrunnion`, `liftTopPin`, `fixedReversingShaft`, `dieBlockPin`, `valveCrossheadPin`, `combinationUpperPin`, `combinationLowerPin`, `radiusLiftPickupPin`.
- `rods`: XYZ endpoint pairs for all seven rods and the valve spindle. Radius rod's third eye is `pins.dieBlockPin`; combination lever's third eye is `pins.valveCrossheadPin`.
- `spindleZ`, `spindleDisplacement = spindleZ−4.1`, `slotAngle`, `expansionAngle`, `combinationAngle`.
- `state = [slotAngle, combinationAngle, spindleZ]`, accepted as the optional third argument `pose(theta, side, previousPose)` for continuation.
- `wholeAcceptance:false` and the explicit reconstruction scope.

`solver.reference[side]` exposes the unchanged observed reference points. `solver.classify(partId)` reports `moving`, `fixed`, or `unsupported` with a reason. `transformFor` returns null for fixed or unsupported parts. Do not treat unsupported as validated fixed hardware.

For a moving part, `transformFor` returns:

```js
{angle, from:[Y,Z], to:[Y,Z], forwardYZ, inverseYZ, ...}
```

These describe the **forward** source-reference to current rigid transform. The query transform for evaluating the unchanged source scalar at a current point uses `inverseYZ`. Matrices are row-major 2×3 `[a,b,ty,c,d,tz]`:

```glsl
vec2 sourceYZ = vec2(a*p.y + b*p.z + ty, c*p.y + d*p.z + tz);
```

X is unchanged. Upload these CPU-computed coefficients once per part/frame, not a Newton solver per pixel. Transform the eight source AABB corners forward for conservative bounds. For any source interval function, transform the current query box's eight corners inversely and enclose all transformed corners. The caller still owns shader precision, bounds, field Lipschitz/proof handling, host cuts, and browser validation.

`solver.fieldFrame(partId, pose)` and `solver.fieldTransform(partId, xyz, pose, inverse)` cover the 46 outside-gear fields directly. `solver.frames(pose)` provides their 23 per-side frames. `transformFor` additionally covers the ten moving valve-chest fields.

## Exact source observations, not names alone

The full scalar helper `mFlatRod` explicitly makes bores at constructor points `a`, `b`, and, when `hasExtra=true`, `extra`. `mDisc` places a circular pin/bearing at its `c` constructor. Consequently the repeated coefficients below are actual centers/eyes, not inferred from names or AABBs.

Coordinate plane is (Y,Z), metres. X is −.98 left and +.98 right for the planar mechanism. Inner/outer trunnion cylinders have their own X offsets, but share the same YZ rotation axis.

| Symbol | Physical role | Left exact retained YZ | Right exact retained YZ |
|---|---|---|---|
| B | Main crank/return-crank eye | (1.1445859366303164, .30413434021975266) | (.685825340352334, −.0040907366754464628) |
| E | Eccentric pin | (1.1698040324760479, −.044094439491922072) | (.99475329458359729, .15858303033095505) |
| J | Expansion-tail pin | (1.0622433640832101, 1.7526889928156242) | (1.0850628697643372, 1.9563160974548464) |
| T | Fixed trunnion | (1.5600000000000001, 1.8) | same |
| D | Die-block/radius-rod third eye | (1.3675009200555428, 1.7898178325682585) | (1.379877383752161, 1.8677598487910383) |
| A | Radius-rod lift pickup | (1.3457208553597624, 1.5146785427860692) | (1.358302989511583, 1.5926043554547209) |
| U | Combination upper/radius-rod eye | (1.5490014591870458, 4.0826452474198369) | (1.5596640024236432, 4.1607222932603491) |
| L | Combination lower/union-link eye | (.97973942089391741, 4.416622389988536) | (.9024359824285868, 4.1002960594427611) |
| V | Valve crosshead/combination third eye | (1.48, 4.1231273253069523) | (1.48, 4.1533979012824593) |
| C | Crosshead drop pin | (.9, 3.8017714936278795) | (.9, 3.480300844953482) |
| H | Lift-top pin | (1.992517232944385, 1.4502235511763384) | same |
| K | Reversing-shaft center | (2.21, 1) | same |

The following values are calculated from those repeated source coefficients, within floating-point roundoff; they are **not historical measurements**:

- EJ=1.8, TJ=.5, DU=2.3, AD=.276, AU=2.576.
- AH=.65, KH=.5, LU=.66, LV=.58, UV=.08, CL=.62.
- D lies exactly on A–U, with A=D−.12(U−D).
- V lies exactly on L–U, with U=V+.08w and L=V−.58w for unit vector w along L→U.
- E is .16 from the driving axle center O=(1.016,0); the observed return arm B–E is .3491407099975118 left and .3491407099975116 right.
- C is the existing outside crosshead plus the fixed offset (−.116,0) in YZ. Its Z agrees with `DYNAMIC.pose(.4,0|2).s` exactly.
- The fixed valve guide has Y=1.48 and center Z=4.1.
- The valve spindle runs from V to V+(0,1.15).

Source coincidences are explicit: return crank's second eye = eccentric rod's first eye = E pin; eccentric rod's second eye = slotted expansion cheek tail eye = J pin; radius rod's extra eye = die block D; radius rod's upper endpoint = combination upper eye U; union link's endpoint = combination lower eye L; combination extra eye = V spindle start. The companion test transforms all these centers independently and checks coincidence.

### Arc source

`mArcPlate` applies the following world-to-local Q to `p.yz−T`, then uses the compact arc:

`r(sigma) = (R sin(sigma), R(1−cos(sigma)))`, `R=2.3`, `sigma in [−.2,.2]`.

Reference matrices:

- Left Q = [[.99551327183358018, .094622014368751742], [−.094622014368751742, .99551327183358018]].
- Right Q = [[.94987426047132573, −.31263219490969263], [.31263219490969263, .94987426047132573]].

The tail in this same local frame is (−.5,0), to roundoff. Thus the rigid link rotation q is obtained from J−T, and its die-block center is exactly `D=T+Rot(q)r(sigma)`. The observed sigma values are −.08383680358924032 and −.08369670411332253 rad.

The slot's empty half-width is .017; the retained die block is a circular `mDisc`, radius .015, axis X. Centering it on this arc leaves .002 radial clearance to the slot sides in this candidate geometry. Its X-axis disc is invariant under YZ rotation, so translation of D is the exact field transform; imposing a separately guessed noncircular tangent-aligned block would change the geometry and is not done.

## Reconstructed motion equations

Let Rot(a) be the usual 2D rotation in YZ and theta0=.4. Let R=2.3 and O=(1.016,0). All trigonometric uses here concern rigid rotations, not fitted valve travel.

1. Read B and crosshead S directly from the unchanged `DYNAMIC.pose(theta,sideIndex,0)`, where sideIndex=0 left or 2 right. Set C=S+(C0−S0). This retains the same slider-crank and common theta, rather than a second independently animated crosshead.
2. Under the explicit **rigid return-crank attachment** assumption, E=O+Rot(−(theta−theta0))(E0−O). This follows the same rotation as the driver and preserves B–E. A static geometry snapshot alone cannot prove a locked rather than free joint; that mechanical attachment assumption is part of this reconstruction, not recovered metadata.
3. Solve J as the intersection of circles centered T and E with radii .5 and 1.8. For v=E−T, d=|v|, u=v/d, a=(.5²−1.8²+d²)/(2d), and h=sqrt(.5²−a²):

   `J=T+a*u+branch*h*perp(u)`.

   `branch=sign(cross(E0−T,J0−T))` is fixed from the observed reference, not chosen anew per frame. Reject nonexistent or singular intersections. Then `q=atan2(−(Jz−Tz),−(Jy−Ty))`.
4. With fixed H, solve x=(sigma,gamma,vz). Define:

   - D=T+Rot(q)(R sin(sigma),R(1−cos(sigma))).
   - w=(cos(gamma),sin(gamma)).
   - V=(1.48,vz), U=V+.08w, L=V−.58w.
   - A=1.12D−.12U.

5. Simultaneously solve the three **finite** equations:

   - f1=|U−D|²−2.3²=0, the radius rod.
   - f2=|L−C|²−.62²=0, the union link.
   - f3=|A−H|²−.65²=0, the lifting link.

The combination lever's .66 length, .58/.08 division and horizontal V guide are built into the parameterization, not approximated. The third radius-rod eye D stays rigid because A=D−.12(U−D) and |U−D|=2.3 fix AD=.276 and AU=2.576.

The JS solver uses analytic derivatives, pivoted 3×3 elimination, residual-reducing line search, and reference-seeded continuation for random-access time. It throws if closure, the slot bound, or a nonsingular Jacobian cannot be satisfied. A previous pose can supply continuation without modifying the equations. It never repairs a failure with a sine, linear blend, or clamped invalid pose.

### Analytic Jacobian

Let `dD=Rot(q)(R cos(sigma), R sin(sigma))`, `dw=(−sin(gamma),cos(gamma))`, `dU=.08dw`, `dL=−.58dw`, e=(0,1), r=U−D, n=L−C, h=A−H. The rows with respect to (sigma,gamma,vz) are:

- (−2 r·dD, 2 r·dU, 2 r·e).
- (0, 2 n·dL, 2 n·e).
- (2 h·1.12dD, 2 h·(−.12dU), 2 h·(−.12e)).

## Field mapping and integration contract

36 outside-gear fields move: 18 per side. The five fixed fields per side are lifting arm, lift-top pin, inner and outer trunnion journals, and fixed valve guide. This fixed-arm decision applies **only at the retained reversing setting**.

- Rod fields use their actual repeated source endpoint pairs.
- Expansion slotted cheeks use rotation about T by q−q0, including both cheeks and tail pieces as one rigid field.
- Circular pins/die block translate to their corresponding joint centers; X-axis rotational symmetry makes this exact for their retained field.
- Crosshead drop arm translates with C; crank lateral mount translates with B.
- Valve spindle translates with V.

For each side's `mPV` valve chest, source branch indices 6,7,8,9,10 are the rear/front valve-head cores, rear/front seal bands, and shared spindle. Translate those five unchanged fields by `deltaZ=spindleZ−referenceSpindleZ`, equivalently current q−q0. Indices 0–5 and 11–15 are fixed. All 32 calls were parsed and verified; source q0 equals V0.z−4.1 and the two source spindle endpoints equal V0.z and V0.z+1.15 with zero observed discrepancy. Moving every mPV field would incorrectly move its shell, liner and ports.

`FIELD_MAPPING_QA.json`: 46 moving fields total, 32 fixed, 14 unsupported central/conjugated. No unrecognized field is attached to a guessed point.

## Validation results

Two independent implementations solved 7,201 positions per side, starting at theta .4, covering a full 2π cycle. Python also continued backward through the entire path.

- Reference point recovery: ≤4.97e−16 m.
- Python maximum finite equation residual: 7.994e−15 m²; rigid-length error ≤1.78e−15 m.
- JS rigid-length error ≤6.33e−15 m.
- JS versus Python maximum state discrepancy: 1.044e−14 in the mixed state coordinates (rad,rad,m).
- Source endpoint-to-transformed-joint error: ≤6.22e−15 m, including all third eyes.
- Eight source AABB corners plus interior test point transformed forward/inverse: ≤2.10e−15 m inverse error.
- Same-DYNAMIC-crosshead error: exactly zero in the test.
- Forward/reverse branch discrepancy: ≤3.28e−15 in mixed state coordinates.
- Random-access versus sequential solve: ≤2.69e−13 in mixed state coordinates.
- Sampled minimum |det(J)| >10.4077, maximum Jacobian condition number <8.151; no sampled branch singularity.
- Analytic Jacobian versus central finite differences at 361 phases/side: max absolute difference 2.18e−9 with step 1e−6.
- Sampled slot angle lies approximately −.087905 to −.0825734, with >.11209 rad margin to the end of the source arc.
- Spindle Z range approximately 4.0265814–4.1726047 m; candidate travel approximately .14602328 m. These are model outputs, not an A4 travel claim.
- Right(theta) matches left(theta+4.3) to 2.59e−13 in state coordinates, consistent with the retained common drive phase difference.

The very small floating-point residuals express algebraic self-consistency only. They are not physical tolerances, historical confidence, or proof of a collision-free continuum. Full-cycle sampled continuity does not establish global uniqueness over all assembly branches or a rigorous interval proof between samples.

## Remaining uncertainties / intentionally not done

1. Original finite generator not recovered. Fixed/moving attachment choices, perfect planar joints, locked return crank and fixed lift top are explicitly reconstructed assumptions.
2. No evidence for other reversing settings, phase calibration, historical lengths, clearances, elasticity, wear, backlash, load path or correct steam events.
3. Middle/conjugated linkage and middle valve installation are not solved or substituted with ideal arithmetic.
4. No new collision proof, contact-force proof, steam flow model, geometry repair, GPU test, shader edit, screen capture, or publish action.
5. Recreate the solver if the outside driving geometry/phases are deliberately changed; this module is tied to the observed R24 reference and rejects a mismatched reference at creation.

Run the independent checks with:

```sh
python a4-recovered/outside-valve-study/extract_reference.py
python a4-recovered/outside-valve-study/solve_outside.py
node a4-recovered/outside-valve-study/test_outside_solver.js
```

## Portable R25 package and CI

The publish/copy whitelist is recorded in `PACKAGE_MANIFEST.json`. It excludes the two ~940 KB cycle caches, Python bytecode, `valve-parts.json`, and the duplicate `retained-motion.glsl`. The latter two are local inspection conveniences only; all tests read the retained constructor source from the selected model's scene.js.

External dependencies are Python with NumPy 2.3.5 and SciPy 1.17.0 (the tested versions in `requirements.txt`), and Node.js with only its standard modules. The JS runtime solver itself has no external package dependency. Its sole model dependency is the supplied `DYNAMIC.pose` function.

Both `extract_reference.py` and `test_outside_solver.js` accept `--model PATH` or environment variable `A4_MODEL_DIR`. The CLI option wins; omitted values default to `../r24` relative to the script directory for the original study location. No absolute workspace path is embedded. `solve_outside.py` reads `reference-endpoints.json` alongside itself and writes its QA/caches alongside itself; it needs no model path.

For a copied `r25/valve-reconstruction` folder, run from the R25 root:

```sh
python -m pip install -r valve-reconstruction/requirements.txt
python valve-reconstruction/extract_reference.py --model .
python valve-reconstruction/solve_outside.py
node valve-reconstruction/test_outside_solver.js --model .
# Optional independent analytic-derivative check:
python valve-reconstruction/test_jacobian.py
```

The Python step regenerates `left-cycle.json` and `right-cycle.json` before Node compares independent solutions. These caches are deliberately untracked. The Node test also checks that the runtime module's embedded reference constants exactly match `reference-endpoints.json`; silently changing the source snapshot without rebuilding the measured runtime constants will fail that test. Core portability was tested with `--model a4-recovered/r25` and the extractor with `A4_MODEL_DIR=a4-recovered/r25`.
