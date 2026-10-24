# R02 display-only transparent inspection

This isolated teaching sketch keeps the full authoritative model, ownership graph,
physical queries and analytic primitives unchanged. Transparency is a view setting,
not a geometry or material edit.

## Integration

Import `renderGhost` and `restoreOpaque` from `./ghost-inspection.mjs`.

- `await renderGhost(renderer, fullModel, source, renderOptions, {opacity: 0.25})`
  produces a complete displayed frame and returns `wallMs`, `cancelled`,
  `ghostInspection: true`, pass counts and picking policy.
- `await restoreOpaque(renderer, fullModel, source, renderOptions)` renders one
  complete opaque frame through the original descriptor and presentation path.
- Keep `state.model` equal to the original full model. Rebuilds may continue to
  call `renderer.setModel(fullModel, source)` normally.
- Pass one current `requestRevision` to both operations. Cancelled ghost frames
  do not present an intermediate image. The caller should serialize frames using
  its existing busy/queued mechanism.
- Selection repaint in ghost mode should call `renderGhost` again, not the
  renderer's opaque `repaintSelection` shortcut.

## What is transparent

By default, the display filter selects the teaching model's outer `rear/right`
walls, roof, lift shaft back/outer walls and cabin back/side/ceiling. Columns,
beams, treads, platforms, floors, internal room walls and actual door leaves remain
in the interior image. In particular, the elevator cabin floor is not removed.

Explicit display overrides are `ghostNodeIds`, `opaqueNodeIds`, or
`inspectionDisplay: 'ghost' | 'opaque'` on a primitive/node. Class toggles are
`ghostWalls`, `ghostRoof`, `ghostLiftShell`. These controls change display filtering
only. No unseen frame, glass, geometry or evidence is created.

## Bounded GPU implementation

1. Trace/shade the complete scene offscreen and copy its RGBA16F color image.
2. Trace/shade the display-filtered interior offscreen, retaining original IDs.
3. Present one GPU composite: interior × (1 − opacity) + full scene × opacity.

Both scene renders use `skipPresent: true`; only the final composite reaches the
canvas. There is no intervening opaque/interior flash and no resolution reduction.
The extra full-image storage is exactly eight bytes per pixel; it is included in
the existing native-resolution memory budget. Display descriptor textures are
cached until model generation or filter settings change. No depth peeling,
unbounded passes, meshes, Three.js, PBR, browser software installs or physical
refraction are used.

The final hit buffers are from the interior trace, so ghost-mode picking selects
visible internal solids. Switch to opaque mode to pick an outer ghost shell.
The existing line/normal edge cues are retained in both images.

## Limits and QA

This is a two-image x-ray overlay, not order-independent optical transparency.
It can reveal internal surfaces that a physically refracting wall would not show.
An opaque interior wall can still hide a more distant interior object; there is
no recursive peeling. Source shells, when supplied, appear only in the full-scene
image; the independent R02 source may remain empty.

`node test-ghost-inspection.mjs` checks data immutability, real changed analytic
first-hit visibility, class selection, cache reuse, cancellation and presentation
ordering with a mock GPU. Real WebGL pixel comparison and opaque roundtrip image
hashes must be checked separately in browser QA. These tests are not building-code,
fire-safety, structural or continuous-clearance certification.
