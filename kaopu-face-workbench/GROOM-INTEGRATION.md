# Face groom integration

This is an additive module for the accepted, unchanged 17,821-vertex GNM face runtime. It starts off. The user explicitly adds hair, brows and lashes; a cancellable module Worker binds the baseline template while the face and photo-fitting tools remain usable.

## Preserved source

- 14,000 teacher-derived long-hair strands and 1,000 teacher-derived eyebrow strands
- Exact accepted source data, seed 724, original parting, original free 3D guides, original skin-root binding, fibre material and R8 four-layer opacity code
- Three source-curve trim presets. These are cuts of the original guides, not newly authored short hairstyles
- Original Daniel Bystedt credit and exact supplied CC BY-SA declaration retained
- Existing hair workbench is never modified by this integration

The head evaluator, head topology, positions and the lighting powers/colours/directions are not written by the module. Hiding grooming restores the head's original shadow settings and shader path. The existing R01 baseline button should hide grooming before restoring the GNM identity/expression/pose.

## New components

Lashes are 224 deterministic curved fibres. Their roots are projected onto outward-facing eyelid skin near the existing GNM eyelid landmarks and bound to exact triangles with barycentric coordinates. The complete curves follow those triangles' live deformation frames. They are not teacher-source geometry, photo reconstruction or pasted eyelash image planes.

Brow height adjusts only the brow source-root placement, then projects and rebinds onto real skin. It is limited to ±1.5 mm; zero restores the original source binding.

## Integration API

Import initFaceGroom from src/FaceGroom.js. Call it once after creating the existing head mesh with {scene,mesh,model,renderer,render}; optional mount selects a dedicated control container. Its Promise returns a lightweight controller immediately, without binding hair. Store that controller and call:

- beforeRender() immediately before the existing renderer.render()
- update() after GNM evaluation and normal updates
- hide() before the existing R01 baseline restore
- onContextRestored() after WebGL context restoration
- getOptions() / setOptions() to export and restore grooming preferences
- dispose() when permanently destroying the workbench

setOptions(), reset(), hide() and load() return Promises. Worker errors keep the clean head usable. No new renderer, animation loop, remote library, camera or external picture upload is added.

Only baseline template/topology/landmark arrays enter the binding Worker. Photos, video, fit records, current identity coefficients and person names do not enter it.

## Validation

Numerical tests use the hash-verified official GNM asset, never user images. They verify root-to-deformed-triangle attachment, finite output, zero invalid component bindings, worker transfer equivalence and exact reset for identity, expression and root pose changes. A separate lash test checks centreline segment crossings against skin and eyeballs on neutral/identity/expression/pose samples. These tests do not promise universal collision freedom or physical hair simulation.

The read-only face-groom-qa workflow exercises real Chromium and WebKit, cancellation/retry, all controls, changing head identity/expression/pose, 20 navigation cycles, WebGL loss/restore, mobile layout and actual screenshots. Real-browser visual acceptance is required before publication. The local executor cannot launch Chromium because its socket operation is restricted; numerical checks are not a substitute for this gate.

OBJ export remains GNM head geometry only. To retain grooming, include the validated grooming options in the existing profile; curve export is not implemented here.
