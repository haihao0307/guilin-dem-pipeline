# Ocean Life Mother R03.A run5 — evidence-gated anatomy articulation interface

Date: 2026-09-19. This run continues `work/ocean-life-mother-r00-20260918` after the alpha correction run. It preserves R00/R01/R02, the existing R03 field study, Game Mother and all other Mother production branches.

## Actual increment

A source-independent anatomical articulation kernel now exists at `src/anatomy-kernel.js`. Its purpose is to give the continuous fish field a place to attach real mouth/jaw, gill-cover, eye and fin relationships later, without reverting to a painted mouth line or a generic whole-body deformation.

The interface is deliberately evidence-gated. A part cannot move unless its identity, parent, coordinate frame, length unit, anchor, axis, angle unit and allowed angle range are explicitly supplied. Unknown parts are rejected. A missing anchor is rejected instead of becoming `[0,0,0]`. Missing frame or units are rejected. Hierarchy cycles are rejected. Hinge axes are normalized and zero-length axes are rejected. Runtime state values are finite radians and are clamped to the declared evidence range.

The kernel supports rigid fixed parts and rigid hinge parts and composes parent-child transforms. It can transform a point together with its geometric and shading normals, so future source-bound jaw, operculum, eye or fin samples can remain tied to the same continuous field rather than being rebuilt as separate mesh assets.

`tools/build.py` now includes the anatomy kernel before the study runtime and records that source binding is still required. The existing study runtime has NOT been changed to pretend that any current UV patch is a lower jaw, gill cover, eye mechanism or fin hinge. The original R03 coefficient payload was not available in this runtime, so the full black-bass HTML was not rebuilt.

## Executed verification

`tools/anatomy_interface_qa.cjs` was executed against the kernel. Nine invariant checks passed:

1. zero articulation state is an exact identity;
2. a hinge anchor remains invariant under rotation;
3. a rigid hinge preserves distance to its anchor;
4. normal rotation preserves unit length;
5. a requested angle outside the declared range is clamped to that range;
6. an unbound part is rejected rather than assigned a default location;
7. a missing anchor is rejected;
8. a missing coordinate frame or unit declaration is rejected;
9. a parent hierarchy cycle is rejected.

In the synthetic radius check, the before/after distances were `0.10198039027185571` and `0.1019803902718557` source-local units. In the synthetic clamp check, a requested state of `99` was limited to the declared `0.65 rad`. These values belong only to the test fixture and are not biological measurements for FISH-REF-001.

`tools/anatomy_interface_browser_qa.py` was also executed under Xvfb using Chromium/SwiftShader at 1280x900 and 390x844. Both layouts produced zero page errors and WebGL error `0`. Four synthetic articulated points were rendered. Maximum observed articulated displacement was `0.043159271971079105` synthetic source-local units, the rest-state identity error was `0`, and unknown bindings remained explicit. The browser receipt is `qa/ANATOMY_BROWSER_R03A_RUN5.json`.

These are actual code/browser checks of the new interface. They do NOT constitute a black-bass jaw, gill, eye or fin reconstruction.

## Source replay status

The exact `model_67a_-_largemouth_bass.glb` payload and the original generated R03 coefficient payload were not readable in this run. Conversation/Library search did not resolve a usable exact GLB file reference. No replacement fish was used and no source values were invented.

Consequently there is no new FISH-REF-001 source replay, no new mouth/fin edge measurement, no gill or eye landmark extraction, no validated hinge pivot, and no accepted biological angle range. Existing color, normal, alpha and geometry fidelity gates remain unchanged.

## Logical boundary

The fact that fish anatomy is evolutionarily structured does not let the system infer precise pivots, axes, ranges or parent relations from one adult surface appearance, a UV chart, or a convenient generic fish skeleton. Those values still need source evidence, anatomical observation or an explicitly labelled hypothesis. The interface is useful because it prevents missing evidence from silently becoming geometry.

Likewise, a two-parameter continuous surface can express detailed geometry, but that alone does not establish a globally one-to-one anatomical coordinate map or tell the system which samples belong to a moving jaw versus a stationary cheek. Semantic part identity is a separate relation that must be bound and verified.

## Next bounded task

When FISH-REF-001 becomes readable again, use actual source landmarks/components to bind only the parts that can be supported: mouth/jaw boundary first, then operculum, eyes and fins. Record each part's frame, anchor, axis, allowed state range, source evidence and residual rest-position error. Test the zero-state reconstruction before any animation. Only after the rest pose is source-consistent should movement be compared with the source animation or biological references.

If the source remains unavailable, do not guess those values. Source-independent work should remain limited to interface invariants, composition rules and other tests whose truth does not depend on the missing fish payload.

No R03 public workbench is deployed in this run. `shareAllowed=false`; `visualAcceptance=false`; `anatomicalAcceptance=false`; `materialFidelityAcceptance=false`; `motionAcceptance=false`; `productionReady=false`.
