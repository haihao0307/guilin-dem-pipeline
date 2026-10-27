# Existing outside valve joint audit

This folder diagnoses the actual unchanged R29 fields. It does not create replacement geometry, alter R29, change Git, or claim historical dimensions.

## Main findings

1. Both retained combination levers already have a through-X hole at V. Hole radius is 13.5 mm; lever thickness is 24 mm, eye outer radius 33 mm, web width radius 24 mm. The transverse V pin radius is 12 mm and total X length is 110 mm. There is no separate V bushing field in the scene.
2. Both original spindles are solid radius-16-mm capsules from V to V + [0, 0, 1.15]. The candidate keeps that rear body. Its explicit new through-Y hole is at the other end, 1.15 m in front, for the Gresley input joint. It is not a V-joint bore or fork slot.
3. This is not an inverse-transform omission. Across 1,441 sampled phases, transformed lever hole to V error is at most 1.78e-15 m, candidate spindle rear to V error at most 8.88e-16 m, and old/new spindle transforms agree exactly. The lever rotates while spindle and V pin translate. Relative angle is not constant, so these solids cannot be treated as one rigid union.
4. Existing tail witnesses lie 23.25 mm radially from the X-axis V bore, 9.75 mm outside the 13.5 mm hole. Merely adding that hole to the spindle would leave these points occupied. The complete rotating lever material needs clearance, not just coaxial pin-center alignment.
5. The old fixed guide is also wrong for this joint. It is a closed rectangular tube centered at (side X, 1.48, 4.1), outer half-size (55, 45, 170) mm minus an inner through-channel half-size (24, 24, 190) mm. At all 72 checked phases, the lever occupies its top/bottom wall and the transverse pin occupies its side walls. There are 576 exact retained-field witnesses, with maximum field values at most -5 mm for lever/guide and -12 mm for pin/guide. These are scalar values, not certified Euclidean penetration depths.

## Minimum repair constraints, not a geometry proposal

- Keep the same V motion and the existing lever V hole. Preserve the other Gresley connection, Y-axis terminal bore and front pin/eye/bushings.
- A new moving joint needs a free articulated interface with the rotating 24 mm lever. If a two-cheek arrangement is chosen from official evidence, its slot width must be at least 24 mm plus two explicitly stated axial clearances. Its shaft-bearing axes must remain coaxial with the X-axis V pin throughout motion.
- The pin provides 43 mm on either side beyond each lever face before reaching its end: cheek thickness + axial clearance + retention reserve must fit that budget. The old guide's channel reduces the local free budget to only 12 mm per side and cannot be assumed compatible.
- The 12 mm pin in a 13.5 mm hole leaves 1.5 mm nominal radial space. An added bushing must explicitly allocate inner running clearance, bushing wall and outer fit; no existing V bushing may be assumed.
- The old tube guide must be replaced explicitly in candidate mode if the evidence-backed open-guide topology is used. Its failures must remain preserved in baseline/history. Do not declare its wall overlap an intended connection.
- V travels through approximately Z = 4.026581 to 4.172605. The existing fixed rear valve cover occupies Z = 4.228 to 4.25 and radius 26 to 169.3 mm about the spindle axis. Packing occupies radius 16 to 26 mm in the same Z interval. The rear-facing support surface is Z = 4.228; a guide needs an explicit connection to fixed material without closing this central passage or obstructing removal.
- Any radially wide moving crosshead material extending toward that cover has a sampled worst-case forward budget of 55.3953 mm from V, less its required clearance. This bound applies where its radial position overlaps the cover, not to the narrow shaft through the center.
- The upper connection U is 80 mm from V along the lever. Its minimum sampled Y is 1.5483677; the 12 mm upper-pin lower bound is Y = 1.5363677. The upper pin is another full 110 mm X-axis member, and the radius rod shares that neighborhood. Include both, not just V pin and lever.
- A conservative sampled projection of the old lever into the spindle's Y strip reaches 37.8058 mm in front of V. A complete R16 mm capsule would need a start-center shift beyond 53.8058 mm plus clearance for simple Z separation. That nearly consumes the 55.3953 mm wide-body budget. This is an explanatory bound, not a proposed dimension or continuous certificate; a shaped joint must be evaluated directly.
- Keep both old spindle aliases suppressed in candidate mode when replacing the canonical shaft. The original valve spindle and shared chest spindle are solid and would refill a new slot if resurrected.

## Reusable CPU and phase API

- `analytic_fields.scalar(id, referencePoint)` evaluates the exact captured reference field. `transformed_scalar(id, worldPoint, frame)` evaluates it using that frame's inverse affine map.
- `PHASE_POSES.json` has 72 common-Time phase rows, full selected-part inverse frames and world V/U/L poses. Absolute theta = 0.4 + Time.
- `node pose_at.js THETA` computes an arbitrary actual phase from the current matching model, without interpolating. It checks the captured source hashes and refuses silently changed inputs.
- `NEIGHBOR_IDS.json` identifies 13 left and 14 right actual broadphase neighbors. All 27 neighborhood scalar functions have been checked for evaluator support, including original main rod and power-crosshead guides. `SOURCE_FIELDS.json` records 91 relevant fields and dynamic bindings; `KEY_FIELDS.json` selects the immediate joint members.
- `TRANSFORM_ALIGNMENT_QA.json`, `TAIL_OVERLAP_DECOMPOSITION.json`, `GUIDE_FAILURE_SWEEP.json`, `TRANSITION_CONSTRAINTS.json` preserve the findings. `INPUT_SHA256.json` binds them to source modules.
- The earlier whole-train package remains `../r29-neighbor-study/R29-PROFILE-WHOLE-NEIGHBOR-AUDIT.zip`. Its two inherited articulated witnesses are replayed here, and the old-old guide collisions expand the required next whole-neighbor scope.

No sampled no-witness result establishes continuous clearance. The original retained dimensions are hypotheses, not a recovered A4 drawing. Any new architecture must be reviewed with the official image evidence being handled separately.
