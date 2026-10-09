# Hand-body coordination, independent R01 candidate

Status: six executable tasks, undergoing visual QA. Not a replacement for accepted boxing, activity, reaction or collision systems. No main-page navigation is modified.

## Implemented

`HandBodyCoordinator({names, parents, restMatrices, stature, floorOffset})` builds shape-specific finger curl axes, palm bases and limb lengths from the existing 104-bone CommonPerson rest skeleton. `evaluate(seconds, {task, duration, side, target, amount, twistDegrees, poseOutput})` emits `posedMatrices`, `skinMatrices`, native degree rotation-vector `pose` when requested, hand targets/errors and grip phases. Six tasks: open, fist, pinch, grasp, carry, reach-turn. Phases are approach/close/hold/release/recover. This is authored task logic, not a trained or SOMA motion planner.

The renderer must use the existing AnimatedHuman full-CSR path, retaining every influence and its joint-conditioned rest position and neutral seam offset. Never substitute a four-influence buffer, replace the mesh, rescale an actor after rig preparation, or mix the old rig with a new shape. The native origin is near the pelvis, not the floor: pass each actor's floorOffset. Native coordinates are metres, Z-up, -Y forward. View/Jolt coordinates are metres, Y-up: [x,z+floorOffset,-y]. GNM radians are not native Anny degree rotation vectors.

Shape and head are evaluated once per actor. Every animation frame preserves all 25,417 vertices, 50,624 triangles and the original 104 bones. The candidate does no mesh decimation, top-four truncation or neural shape regeneration.

## SOMA findings and reuse boundary

Pinned local runtime: py-soma-x 0.3.3, upstream source commit d6aa640f7787498009c4e3d57fcc14a243905d10. Official low-LOD model executes on CPU: 4,505 vertices; 77 non-root input controls; 78 public transforms; 110 internal skinning joints. Seven additional native hand/chest/shoulder probes were actually executed and changed geometry with finite outputs. The public virtual Root is not a pose channel: pose index = public transform index minus one.

SOMA's procedural sidecar is the authoritative twist topology. Four helpers per upper arm, forearm, thigh and shin yield 32 internal helpers beyond the 78 public joints. Forearm/shin drivers follow wrist/foot twist; upper-arm/thigh use reverse start/end compensation. Segment-aligned swing/twist avoids treating world Euler X as a universal anatomical axis. The candidate applies the principle to the existing Anny arm helpers; it does not copy SOMA's 110-bone transforms onto the 104-bone character or claim identical weights/results. Its current axial weighting is authored, not learned.

SOMA hand controls include metacarpal-like joints and terminal joints. For index/middle/ring/pinky, SOMA `*1` corresponds semantically to an Anny metacarpal and `*2..4` to `finger2..5-1..3`. Thumb1..3 corresponds to finger1-1..3. End markers are diagnostics, not an additional Anny deformation bone. These semantic correspondences are not a validated all-body retarget map.

SOMA provides a differentiable body/hand representation, FK/LBS, procedural controls and fitting/pose inversion. It is not the intent-to-action planner used here. The self-authored layer supplies intent, smooth phase timing, anatomical-pole limb IK, planted-foot compensation, bounded spine/hip/shoulder sharing, finger closure and small bounded CCD adjustments. Pinch uses skeleton-tip proxies. It does not establish skin-surface contact or physical grasp stability.

Pose correctives are learned per-vertex rest-shape offsets applied before LBS, require the procedural rig path and a separately loaded corrective checkpoint. Existing CPU experiments explicitly use `correctives_model_path=None` and `apply_correctives=False`. No pose-corrective weights are run in this candidate. A low-LOD CPU pass does not establish mid-LOD memory requirements or performance. Prior mid-LOD exit 137 has no confirmed cause.

## Jolt boundary

The object target returned here is a single object-origin target. A palm origin is never itself a box origin. For carry, both wrist targets derive from the same object target and explicit left/right offsets. `grip` and edge events can feed a separate fixed-step adapter. Real grasp constraints, human skin collision, mass-to-body effort and load balancing are not solved. The browser shows an authored object target only; it does not claim a Jolt simulation.

Normal Jolt lifecycle is grab(current pose), setKinematicTarget(object world pose), fixed step, release once after the final queued step. Jolt release inherits completed kinematic COM velocity. Seeking requires explicit reset/reconciliation; never feed a several-metre discontinuity as an ordinary hand step. Use the latest independently verified RigidObjectWorld revision; this candidate does not overwrite it.

## Evidence and known limits

Local numeric run: 36 accepted shape-specific rest skeletons × six tasks × 121 frames = 26,136 evaluated frames. Actual meshes: four shape presets × six tasks × three phases = 72 complete CommonPerson/full-CSR geometry samples. CPU images are geometric evidence, not browser/shader evidence. Browser QA independently captures front/side and body/hand views in real Chromium SwiftShader.

Metrics distinguish wrist target error from fingertip error. Bone-length and orthogonality checks do not certify believable hand shapes. Pinch still has residual proxy gaps on some shapes. Wrist/extreme curl quality, inter-finger skin clearance, thumb pad contact, metacarpal volume and load-aware body balance remain visual/contact calibration gates. Nothing in a numeric pass is permission to describe these as solved.

Sources: https://github.com/NVlabs/SOMA-X ; https://nvlabs.github.io/SOMA-X/stable/ ; https://github.com/NVlabs/SOMA-X/blob/d6aa640f7787498009c4e3d57fcc14a243905d10/soma/body/soma.py ; local official SOMA_procedural_transforms.json sidecar (no asset republished here).
