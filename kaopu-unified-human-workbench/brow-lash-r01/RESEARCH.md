# BROW-LASH-R01 / research and transfer record

Date: 2026-10-14. Scope: one retained HUMAN-INTEGRATED-R06 C3 person; independent brow/lash prototype. Movie-quality reference is a target, not an achieved certification. No replacement head, donor eyebrow bitmap, imported eyelash mesh, or generated beauty image was used as the deliverable.

## Primary teachers and the specific lesson

### SideFX: localized grooming and skin deformation

Official sources:
- https://www.sidefx.com/docs/houdini/fur/workflow.html
- https://www.sidefx.com/docs/houdini/nodes/obj/guidegroom.html
- https://www.sidefx.com/docs/houdini/nodes/sop/guidegroom.html
- https://www.sidefx.com/docs/houdini/nodes/sop/guidedeform.html

Lesson: groom in a rest surface; distinguish regional direction/length/density from animation transport; local areas require different flow rules. Deforming a rest groom is not the same thing as growing random new hairs every animation frame. Surface-frame deformation is a documented short-hair option, while long hair needs additional guides or simulation. Geometry collision and skin penetration are separate problems, not automatically solved by root binding.

Original R01 translation: medial/central/tail brow fields; stable seed; exact frontmost triangle queries; immutable barycentric root identity; original native eyelid morph transport. Brow centerline samples follow multiple surface anchors, while short eyelash curves follow a root frame. No Houdini executable code or restricted groom assets are shipped.

### Disney Animation: fiber reflectance is not a plastic tube

Official source:
https://disneyanimation.com/publications/a-practical-and-controllable-hair-and-fur-model-for-production-path-tracing/

Chiang, Bitterli, Tappan and Burley, Eurographics 2016, describe an energy-conserving near-field fiber model, internal-reflection treatment and azimuthal roughness distribution for production path tracing.

Lesson: hair color and highlight are fiber transport, not a uniformly glossy black surface. This is the reference direction for a later dedicated hair BSDF. R01 DOES NOT implement that complete model and must not be labeled Disney BSDF, a path tracer, or movie-grade energy transport. The present shader is an original realtime approximation using an analytic cylindrical normal and an anisotropic physical surface material. Taper, pigment variation, fine silhouette and continuous pixel coverage are implemented; multiple scattering, deep opacity and accurate internal transmission are not.

### Epic: attachment must survive facial deformation

Official sources:
- https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-bindings-for-grooms-in-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/setting-up-a-project-for-grooms-in-unreal-engine

Lesson: rigidly parenting a groom to a head is insufficient for facial deformation. Root attachment must reference the actual deforming skin, including morph targets rather than just bone movement.

Original R01 translation: reuse the exact final R06 surface and its native blink morph targets. A pooled sampler evaluates only needed surface vertices and shared triangle frames per pose; scalar-vs-pooled tests cover both relative and absolute morphs. This is not an animation cache or an alternate human.

## Anatomical/art-direction rules actually implemented

Brows have a rising medial flow, a flatter body with crossing directions above/below the center, and a tapering tail. Hair length, diameter, color intensity and small stray offsets vary by stable seed. Left and right do not share a mirrored random sequence. The 68-point landmark path belongs to the existing person; it is not an externally supplied idealized face.

Upper and lower lashes have separate counts, length envelopes, curve control points and root rows. Lower lashes are shorter, thinner and fewer. The visible native rim is measured by comparing skin/globe depth rather than moving a generic arc until it looks acceptable. Canthus samples without an unambiguous exposed native rim are omitted and reported, never silently attached to a guessed sphere.

Every rendered strip is one tapered 3D centerline, not a picture of an entire eyebrow. The ribbon representation is a realtime cylinder-silhouette approximation; it is not a circular volumetric strand mesh. Close/distant screen coverage varies continuously; there is no fixed-distance LOD switch or alternating high/low hairstyle.

## Verification boundaries

Exact triangle-root offset checks establish attachment only. They do not establish whole-strand collision freedom, natural closure direction, a correct tear line, or cinematic quality. All five native closure positions and side/macro views require image inspection in addition to scalar checks. Shader-link and page-error checks are not beauty acceptance.

The comparison test reads actual canvas pixels immediately after rendering; button text or DOM changes cannot satisfy it. The complete original source positions, faces and material object are compared before/after groom preset edits. Original host executable script hashes must remain unchanged during the build.

The retained R06 head's skin, rim folds, shading and eye geometry retain their existing limitations. Brows/lashes alone cannot establish a movie-quality complete face. The first native blink preparation still invokes the host's existing lazy idle preparation; its startup cost is measured separately and is not hidden as free grooming work.

Linux Chromium with SwiftShader is a reproducible functional check, not a consumer GPU benchmark. A 390x844 viewport is a layout test, not a physical phone. Geometry bytes exclude the retained person, JavaScript objects, temporary binding buffers, render targets and the rest of the engine. The measured pooled-binding CPU duration is not a whole-frame FPS claim.

## Known integration boundary

R01 is mounted on one complete frozen R06 copy and retains its original parameter UI. It serializes `kaopu/brow-lash-groom@1` in the original model archive, but global shared-worker/history wiring, all 36 people, arbitrary topology changes, all body motions and production collision certification have not been completed. The branch and PR remain isolated until user visual acceptance. Existing project asset licenses and notices continue to apply; reimplementation does not remove inherited obligations.
