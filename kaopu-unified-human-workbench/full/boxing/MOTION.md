# R01 deterministic boxing motion

This module is self-authored procedural animation. It does not contain external motion capture, research-model weights, learned contact prediction, or a physical combat simulation. It preserves the current canonical 104-bone Anny hierarchy and all existing mesh vertices and skin influences. The rendering layer evaluates shape once per character and transports the resulting full joint-conditioned skin packet each frame.

## API

```js
const rig = createBoxingRig({
  names, parents, restMatrices,
  stature: fullNeutralHeightInMetres,
  child: stage === 'child' || stage === 'teen',
});
const frame = rig.evaluate(seconds, {
  pairIndex: 0,       // 0–17
  fighter: 0,         // A=0, B=1
  child: false,      // default comes from constructor
  intensity: 1,
  contactIK: true,
  footLock: true,
  poseOutput: false,
  opponentStature: opponentFullNeutralHeightInMetres,
});
```

- `posedMatrices` and `skinMatrices`: complete row-major arrays; metre Z-up; native forward -Y and subject-left +X. Returned matrices are reused and mutated at the next evaluation. Copy if retaining history.
- `rootTranslation`: already included in both matrix arrays. The renderer must not apply it a second time. Keep the neutral mesh floor offset on the actor group.
- `state`: `phase`, Chinese `label`, `variant`, `variantId`, `variantIndex`, opponent state, punches/defence amplitudes, cycle time and pair phase.
- `footContacts.L/R`: intended contact, actual lock status, flat/swing/toe-pivot mode, target and measured ankle, contact anchor and measured toe, and errors in metres.
- `metrics`: ankle/ground-contact errors, support count, stature, bone count and zero per-frame shape evaluations.
- Either `contactIK: false` or `footLock: false` removes the leg contact solver for an explicit unconstrained-FK comparison. It does not change mesh topology.
- `opponentStature` adjusts the strike height to the other character. Tall-to-short punches aim down; a substantially shorter participant practises torso-level targets. It does not change the skeleton or contact solution.
- `poseOutput: true` exports the solved pose in Anny's native local-ref rotation-vector degrees, including the root translation. These values are not Euler angles. `rig.exportNativePose()` also generates a pose on demand.

## Eighteen paired studies, three action grammars

Each pair has its own deterministic phase and a speed in the authored range. Six arenas use each of these distinct grammars:

1. `jab-slip`: double jabs produce alternating slips, followed by the defender's jab return.
2. `cross-duck`: a jab setup and rear straight invite a level change; the defender returns a compact hook.
3. `cross-counter`: jab/cross pressure is answered by an earlier straight counter during recovery.

Both actors read the same event schedule. A defence is driven by the other actor's current punch with a short authored reaction delay; counter timing is explicit. These are scripted paired studies, not autonomous agents or online physical collision avoidance. Each cycle includes guard, attack, evasion/block, return and recovery. Childhood/teen demonstrations use reduced intensity, shorter reach and lower foot lift for light target practice.

## Kinematics and contact

The reference mesh uses Anny's native local-ref rotations. The driver composes rotations about exact rest-joint pivots. Hip and spine rotation, shoulder motion, neck/head compensation, wrist orientation, all fingers, ankles and toes remain in the original hierarchy.

Arms and legs use analytical two-segment solutions with anatomical bend poles and measured, character-specific segment lengths. Intermediate twist bones remain in their original full subtrees. They are never removed or collapsed. Endpoint extension is limited before singular straightening.

Foot targets are piecewise constant during support. Quintic-eased swing windows interpolate between the planted targets with a bounded lift. The rear foot can pivot around a fixed toe contact while the toe joints counter-rotate. At least one foot remains planted. Root height and weight shifts are authored separately and are resolved by leg IK; no per-frame whole-mesh bounding-box grounding is used.

## Reproducible checks

From the workbench directory:

```sh
node full/boxing/tests/asset-reader.mjs
node full/boxing/tests/motion-analytic.mjs
node full/boxing/tests/motion-surface.mjs
```

The tests require Node 20.11+ and Node built-ins; no package installation is required. The analytic test uses the included Anny parts. Full-surface/range tests resolve the existing same-repository assets through ui/runtime-metadata.json assetURLs, with an assembled local source path as an offline fallback. If GNM is absent locally, its existing immutable upstream URL is fetched into memory and SHA-256 verified; no model asset is copied into the repository. Use BOXING_OFFLINE=1 to forbid this fetch and get an explicit missing-asset message. A checkout without the shared sibling assets cannot run the full-surface test until those existing assets are available. They write `full/research/boxing-r01/MOTION-ANALYTIC-QA.json` and `MOTION-SURFACE-QA.json`.

The final three-grammar checks cover:

- 36 accepted character skeletons, 8,640 analytic frames and native-pose replay
- 36 complete 25,417-vertex characters at 20 sampled times each
- Dense foot-surface and joint-velocity checks at 1/60-second intervals for 15 seconds per character: 32,436 frames
- Maximum dense sole penetration: 0.265 mm; maximum support hovering: less than 0.001 mm
- Maximum head/shoulder/knee speeds: 0.874 / 0.918 / 0.464 m/s
- Maximum wrist speed: 3.609 m/s; maximum adjacent 1/60-second displacement: 60.2 mm, occurring in the punching hand
- Bone-length error below 7e-16 m and native replay matrix difference below 7e-7

The contact threshold is 2 mm. Small residual sole deviations come from full native blended skin weights, not anchor motion. Matrix/contact correctness does not replace rendered visual review; detailed motion-dependent soft-tissue correctives and collision dynamics are outside R01.

## Pair spacing and gloves

`BOXING_PAIR_SEPARATIONS[pairIndex]` and `recommendPairSeparation(pairIndex)` return the tested root spacing in metres, locked to the current 36-preset catalogue. They are not a generalized collision solver. The 18 calibration rows are also exported as `BOXING_PAIR_RANGE`. This calibration assumes the R01 ellipsoid gloves: radius 0.081 × height / 1.75, long axis ×1.25, centre 75% from wrist to middle-finger base.

The surface-based spacing test samples all eight attack peaks in each pair, including the actual defensive motion. It conservatively bounds each glove by its longest radius. The closest adult peak leaves 6.5 cm; children and teenagers leave 12 cm. The arms' raised guard and forward torso lean, the palm offset and the opponent's face surface all count toward range. Therefore a smaller root separation is not automatically more accurate. Misses produced by a slip, duck, shorter reach or a compact hook can have larger clearances; this is a non-contact paired technical study, not a claim that every punch lands.

Run `node full/boxing/tests/pair-range.mjs` to reproduce `PAIR-RANGE-QA.json`. Strongly changing the accepted character proportions or glove geometry requires recalibrating this spacing rather than reusing the table as a collision guarantee.

## Native reevaluation boundary

`node full/boxing/tests/native-residual.mjs` compares 54 poses from two child and four adult slender/heavy/tall/sturdy characters. The deployed Float32 texture/CSR equation is replayed through `AnimatedHuman.sampleVertex`; it is compared with `CommonPerson.compute` after applying the exported native Anny rotation vectors, root translation and `owners.headRig='body'`. This is a CPU numerical comparison, not GPU framebuffer readback.

The worst whole-mesh RMS difference is 0.653 mm. The maximum 5.424 mm residual occurs in the neck transition; the corresponding neck-band RMS is 2.008 mm and its P95 is 3.901 mm. Outside the neck transition, maximum body and head differences are 0.000285 mm and 0.000067 mm respectively. The neutral ownership switch has zero displacement in these cases.

The animated workbench transports its neutral neck correction with the skin. Full native reevaluation recomputes the contour, fairing and neck surface after each pose. R01 therefore does not claim per-frame equivalence to the native dynamic neck correction. The measured difference is local, with no whole-head drift; rendered neck close-ups remain the appearance check. Detailed results are in `NATIVE-POSE-RESIDUAL.json`. No runtime code was changed by this diagnostic.
