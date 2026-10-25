# Inferred finite-thickness Gresley assembly candidate

This is a pure numerical/scalar integration package for the existing whole-train model, not a component-demo replacement, mesh, renderer change, historical reconstruction, manufacturing drawing, structural proof or publication. No `r26` file was changed. The original retained failure remains available.

## Immediate result

- The original five plates are all 24 mm thick, with 24 mm body half-width, 33 mm eye radius and 13.5 mm bore radius. All eight original pins are radius 12 mm and length 70 mm.
- Original rod-on-rod interference is proved at A, C, B and E. A further main-lever/middle-short-link overlap closes a three-edge conflict cycle. Three distinct flat plate levels are the minimum under the stated restriction of unsplit, globally planar plates with unchanged profiles. This is not a global optimum among bent/clevis/redesigned mechanisms.
- Merely offsetting plates does NOT fix the original solid spindle ends. R/L/M have no transverse Y bore. The two left/right `valve_chest/*_shared_valve_spindle` solids are exact cylinder aliases contained in their respective capsule bodies, not additional independent shafts.
- `UNCUT_STACK_CANDIDATE.json` intentionally retains that input-joint failure. `TERMINAL_EYE_CANDIDATE.json` separately proposes explicit added eyes and explicitly disclosed through-Y material removal. Neither was installed in the train.
- The eye-connected candidate passes 14,401 common-theta samples for 73 analytic pieces / 2,628 pair relations. Its retained XZ kinematics are unchanged. A conditional interval certificate also covers every independent input pair in the stated `[4.02,4.18] m` rectangle. These are CENTRAL nominal-geometry results, not full-locomotive or structural acceptance.

## Derived stack, not arbitrary offsets

All dimensions below are metres. The user-facing assumption is an inferred design choice, not an A4 dimension.

Retained dimensions: `Y0=1.48`, plate thickness `t=0.024`, original spindle radius `rs=0.016`, original pin radius `rp=0.012`, original rod bore radius `rb=0.0135`.

Selected design variables:
- Axial running clearance `a=0.0005`.
- General noncontact surface clearance `c=0.0005`.
- Minimum spacer thickness `s=0.002`.
- Washer thickness `w=0.002`.
- End-retainer ENVELOPE thickness `r=0.003`.
- Exposed shaft-end reserve `e=0.0005`.
- Pin-to-bushing radial clearance `0.00015`.
- Loose spacer/washer radial clearance `0.0003`.
- Hardware outer radius `rb+0.0045=0.018`.

Derived relationships:

1. Each terminal eye has half-thickness `rs`, preserving the original 32 mm spindle-diameter axial envelope. Its input face gap is `s+2a=0.003`.
2. All three short links: `Ys=Y0+rs+t/2+(s+2a)=1.511`.
3. Equal lever: `Ye=Ys-t-(s+2a)=1.484`.
4. End envelope: `h=a+w+r+e=0.006`.
5. Main/short face gap: `g=max(s+2a,2h+c)=0.0125`.
6. Main lever: `Ym=Ys+t+g=1.5475`.

The upper gap has to fit O and E opposing end envelopes as their XZ axes almost coincide during the cycle. Replacing 12.5 mm with the otherwise sufficient 3 mm spacer gap produces an exact negative-scalar witness around theta 1.6924163111, with approximately 4.5 mm interior depth in BOTH pins. This rejected simplification is recorded rather than hidden.

The three original spindle centerlines remain at Y=1.48; all original plate thicknesses, widths, eye/bore radii, XZ pin paths, link lengths and official axle stations remain unchanged.

## All eight pin interfaces

Pin radius stays 12 mm. End ranges are derived from outer bearing faces plus/minus the 6 mm end envelope.

| Joint | Connected bearing members | Shaft Y interval | Shaft length | Between-member spacer |
|---|---|---|---:|---:|
| O | Main lever; frame mount UNKNOWN | 1.5295–1.5655 | 36 mm | None |
| R | New terminal eye + right short link | 1.458–1.529 | 71 mm | 2 mm |
| L | New terminal eye + left short link | 1.458–1.529 | 71 mm | 2 mm |
| A | Right short link + main lever | 1.493–1.5655 | 72.5 mm | 11.5 mm |
| C | Equal lever + main lever | 1.466–1.5655 | 99.5 mm | 38.5 mm |
| B | Equal lever + left short link | 1.466–1.529 | 63 mm | 2 mm |
| E | Equal lever + middle short link | 1.466–1.529 | 63 mm | 2 mm |
| M | New terminal eye + middle short link | 1.458–1.529 | 71 mm | 2 mm |

There are 15 separate bushings, outer radius 13.5 mm, inner radius 12.15 mm, wall 1.35 mm. The twelve retained plate eyes get 24 mm-long bushings; three new terminal eyes get 32 mm-long bushings. No retained rod bore is widened or secretly thinned. Spacers and washers have inner radius 12.3 mm and outer radius 18 mm. Each pin receives two finite washer/retainer envelopes, not a bare lengthened cylinder presented as retained hardware.

Nominal seat boundaries and intended eye/stem material unions are enumerated, not treated as accidental collision-free gaps. Nominal radial clearance implies real load-dependent backlash; the mathematical solver continues to constrain ideal coaxial centers and does not simulate that backlash or elasticity.

## Explicit terminal changes and alias policy

The candidate adds a radius-33-mm, 32-mm-thick Y-axis eye at each original moving R/L/M front pin. It unions that eye with the corresponding spindle and subtracts a radius-13.5-mm through-Y cylinder at that same moving XZ point. This subtraction is local in XZ to 13.5 mm from the original front pin and is NOT a cylinder/chest bore change or axle carving.

Canonical source fields receiving this candidate-only end hole:
- `valve/right_valve_spindle`
- `valve/left_valve_spindle`
- `valve/middle_valve_spindle_inferred_horizontal`

Duplicate source aliases that otherwise refill the holes:
- `valve_chest/right_shared_valve_spindle`, alias of the right capsule.
- `valve_chest/left_shared_valve_spindle`, alias of the left capsule.

The verified cylinder aliases have the same endpoints and radius as the straight cylindrical portion of each capsule. In candidate mode, suppress each duplicate independent solid only while its canonical candidate capsule still represents the same complete moving shaft. Alternatively, apply the identical moving terminal bore to both representations and continue treating them as one physical body. Never suppress other chest `mPV` parts. Keep every baseline source field unchanged.

`EXPLICIT_MODIFICATION_MANIFEST.json` records all additions/subtractions. `COUNTEREXAMPLES_AND_SUPPORT_QA.json` proves positive-volume continuity between each proposed eye and its drilled original stem with a 6 mm common interior ball. This is local geometric connectivity only, not a fabrication or strength proof.

## Integration now

`stack_candidate.js` exports pure functions:

```js
const profiles = stack.inspect(SCENE, G.reference);
const design = stack.derive(profiles, G.reference, {}, {terminalEyes:true});
const pose = G.fromOutside(leftPose, rightPose); // SAME absolute theta
const parts = stack.parts(design, profiles, pose);
const value = stack.scalar(parts[i], worldPoint);
const aabb = stack.bounds(parts[i]);
```

`integration_spec.js` exports `pack(design, profiles, pose)`. Its `fields` have original part ID, new/replacement status, scalar GLSL, pose binding, current support AABB and Lipschitz bound. `INTEGRATION_SPEC.json` and `CANDIDATE_REFERENCE_FIELDS.glsl` contain the reference theta=0.4 result.

73 pieces = 16 original-field candidate replacements (five plates, eight pins, three spindles) + 57 new pieces (three eyes, fifteen bushings, seven spacers, sixteen washers, sixteen end-retainer envelopes). The two source aliases are NOT pieces 74/75.

Two valid evaluation strategies, never both:
1. Compile the reference candidate scalar once, then apply the exact inverseXZ frame from each `referenceRigidFrameSourcePartId` at the common theta. Candidate Y layers stay fixed. This permits stable shaders.
2. Build world-pose descriptors from the common solver and evaluate directly. Do NOT also apply existing dynValve/dynGresley transforms.

All primitives are min/max combinations of 1-Lipschitz Euclidean-distance and axial-interval fields. Analytic upper bound is 1; a GPU implementation may use 1.000002 and support AABB padding 1e−6 m. They are not all exact signed-distance functions; do not use `abs(field)` as a safe marching distance.

## Verification and hard limits

Run:

```sh
node a4-recovered/gresley-stack-study/test_stack.js
node a4-recovered/gresley-stack-study/test_counterexamples.js
node a4-recovered/gresley-stack-study/test_integration_frames.js
python a4-recovered/gresley-stack-study/certify_stack_domain.py
```

- 14,401 common-theta samples; maximum retained rigid-length error 1.50e−15 m; maximum outside squared residual 8.89e−15 m².
- 73 nominal pieces, 2,628 pair relations, no unresolved central pair in the sampled eye-connected candidate.
- Selected nearest noncontact axial envelope clearance 0.5 mm; pin/bushing radial clearance 0.15 mm. Exact nominal mating boundaries are reported separately.
- 361 transformation phases, 527,060 scalar comparisons; max world-pose versus inverse-reference scalar difference 1.86e−15 m; Y change exactly zero.
- 4,096 directed-Decimal interval subboxes cover the independent outside-input rectangle. All central equations stay nonsingular and all central nominal piece relationships remain valid. The smallest conservative projected enclosure bound is not a measured mechanical fit clearance. This certificate remains CONDITIONAL: upstream continuous outside phase bounds are not proved.

UNRESOLVED, and acceptance remains false:
- O is only kinematically fixed. The actual frame-connected mount, bearing seat and force/load path are not known or modeled. No historical bracket was invented.
- The end-retainer envelopes have no verified threads, grooves, positive locks, tolerances, lubrication, assembly sequence, wear or strength specification.
- The middle spindle straight-line constraint has no verified prismatic guide or valve chest.
- The proposed terminal eyes/holes are inferred material changes, not existing authentic details. Their manufacturing and stresses are unverified.
- No clearance claim covers all other locomotive solids. Whole-train common-Time validation must continue after explicit integration.
