# KAOPU Crab R04 — Agent Start Here

## Authoritative project location

- Repository: `haihao0307/guilin-dem-pipeline`
- Branch: `handoff/kaopu-crab-full-context-r04-20260930`
- Previous work branch: `work/kaopu-crab-triad-r01-20260930`

There is already a dedicated crab project line. Do **not** open this work under the humanoid repository unless the user explicitly changes the repository later.

## Frozen teacher roles

1. **Original coconut crab archive — `crab+3d+model.zip`**
   - Authoritative teacher for the coconut crab's visible morphology, silhouette, surface, colour placement and final object identity.
   - The 77 exported source pieces are evidence about surface organisation only. They are not bones and must never become 77 runtime motion objects.

2. **Animated ordinary crab archive — `animated_crab_rigged_free.zip`**
   - Secondary teacher for complete crab surface reconstruction, skeleton hierarchy, bind pose, skin weights, joint coupling, IK controls and animation timing.
   - It must first be reconstructed through the Composer–Score–Instrument workflow as its own object.
   - Its body proportions and finished mesh must not replace coconut-crab morphology.

## Correct production target

The final coconut crab is one continuous living object. Use a unified generated surface and weighted skinning. Hard exoskeleton zones should be nearly rigid; compliant joint membranes and attachment zones should blend weights. Leg, chela, eye-stalk and antenna motion must propagate through articulated chains and ground/contact constraints rather than moving exported pieces.

## Immediate execution order

1. Freeze and audit the animated teacher source and license.
2. Reconstruct its entire surface one-to-one from all source positions, triangles, normals, UVs and connectivity.
3. Validate the reconstructed static object before using its skeleton.
4. Extract skeleton hierarchy, bind matrices, vertex weights, animation channels, gait phase and coupled body response.
5. Return to the original coconut-crab surface teacher and repair every visible crack or detached region.
6. Retarget shared crab rig knowledge through coconut-crab-specific joint locations and weights; never copy ordinary-crab proportions.
7. Validate static surface first, then idle, locomotion, alert and feeding.

## Non-negotiable gates

- Metres, Y up, +Z forward.
- Composer, external Score and pure Instrument remain separate.
- Teacher meshes are comparison/measurement sources only and do not survive as formal runtime truth.
- No species-name preset dispatch.
- No sphere/capsule/box substitute anatomy.
- No source-piece rigid motion system.
- No rigging before static surface integrity is accepted.
- No visual, motion or production acceptance may be inferred from automated tests.
- Delivery must become a fixed public one-click browser URL after the executable build is published.

## Current state warning

R03 proved a one-render-object weighted architecture, but its coconut-crab morphology and motion remain rejected by the user because visible cracking and unnatural motion still exist. R03 is evidence and a diagnostic baseline, not an approved visual baseline.
