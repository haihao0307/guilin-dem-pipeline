# ET17 lips / small periocular refinement — research and scope

User anchor: `7bc25d5e31808d0a5724f602d4a4ade42a14c385/kaopu-unified-human-workbench/eye-materials/preview.html`.
Date: 2026-10-11. This branch starts from that exact commit, not the independently advancing PR210 head. Do not modify the old eye-materials preview, identity-lab, body parameters, rig, or other workbenches.

## Primary teachers reviewed

1. Ten24 / 3D Scan Store — HD Female Head 06, official close-up renders and asset description: https://www.3dscanstore.com/hd-head-scans/hd-head-models/hd-female-head-model-06 . Visual reference for the vermilion/skin transition, broken vertical furrows, soft commissures and profile planes. Commercial assets were not purchased, downloaded, embedded, rehosted, or claimed as our own.
2. Ten24 / 3D Scan Store — Male Retopologised Head Scan 31: https://www.3dscanstore.com/sd-heads/retop-head-scans/male-3d-model-retopologised-head-scan-31 . A second observed complexion and lip form, avoiding a universal pink lipstick preset. Same reference-only boundary.
3. Stan Prokopenko, original author lesson: https://stanprokopenko.com/2012/10/video-draw-lips-anatomy-structure/ . Artistic construction: the curved dental support volume; upper-lip three forms and lower-lip two; central tubercle; pinched corners; alternating profile planes; do not draw one uniform white outline around the lips. This is an artistic model, not a universal anatomical measurement or a mesh source.
4. USC ICT, Digital Emily: https://vgl.ict.usc.edu/Research/DigitalEmily/ . Observed expression-dependent skin buckling and stretching; geometry, normals, reflectance and expression must not be conflated. No USC model or texture copied for this iteration.
5. Epic Games, MetaHuman materials: https://dev.epicgames.com/documentation/metahuman/metahuman-materials-and-textures . Separate base color, specular/roughness, normals, scatter and animated deltas; high and low detail regimes. Learn the separation of responsibilities; do not claim a port of Unreal or MetaHuman assets.
6. Cleveland Clinic, lip anatomy: https://my.clevelandclinic.org/health/body/lip-anatomy . Distinguishes cutaneous skin, vermilion, philtrum/Cupid's bow and inner mucosa. Used for visual region naming, not medical advice.

## Hypotheses to verify against the frozen live mesh

- A painted color boundary cannot repair an incorrect silhouette, lack of lip roll or malformed contact seam.
- Existing fixed-native-mesh and face-surface adapters should be retained; any new surface is derived deterministically and rendered instead of, never on top of, the old local surface.
- Separate dry lip surface from its narrow moist inner region. Use irregular, band-limited furrows rather than repeated sine stripes, noise-only skin pores or uniformly polished plastic.
- Small eye changes only: local crease/edge continuity; preserve the natural eyes and their controls. Do not claim full eyelid reconstruction or optical simulation.

## Acceptance / honesty

Inspect real rendered frontal, oblique, side and gray-mode images; compare the same person under the same camera and light. Verify finite geometry, native buffers/topology unchanged, parameters affecting actual pixels, save/restore, preset changes and basic expression paths. The existing deformation and browser performance limit this round; full muscles, soft-tissue collision, teeth/tongue contact and measured scan-grade fidelity are not certified by a screenshot or a passing functional check.

Delivery requires a new immutable HTTPS preview verified in an external browser. A source archive or a local screenshot is not the delivery. No commercial service, paid asset purchase, main merge or force-push is authorized by this task.
