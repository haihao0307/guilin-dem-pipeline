# Native architectural review at 04e5ac12

Actual GPU run: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38344011903

All ten jobs completed successfully. This is ANGLE SwiftShader in pinned Playwright 1.57.0, not native-hardware or real-time acceptance.

- 33 production geometry/matter samples: zero distance differences; earlier 30 readbacks unchanged.
- Three native 18×18 smoke crops: zero unresolved rays. The unchanged window/whole smoke blocks each retain all 10,368 prior raw channels exactly.
- Actual tower images: whole 70×170, window 112×180, upper lantern 100×155, all zero unresolved rays. Complete windows, 0.63 m walls/inner lining and new upper brick facets are visible. Stone is visually too grey and dark, and the small-image brick pattern has excessive light/dark contrast. Material appearance is NOT accepted yet.
- The window has no verified optical glass transport. Visible interior surfaces are real finite plaster linings, not dark glazing decals.
- The retained 92054936 hall was rendered as three independent 60×90 native cores. Assembly compared 24,064 overlapping raw channels, 368 safely interior composed pixels and the complete shadow texture: zero differences. The resulting 180×90 image is structure review only; fine texture cannot be assessed at this size. It is a different frozen model revision and is labelled accordingly.

Images, validation and file-hash checkpoints are preserved in review-04e5ac12. Complete receipts are losslessly gzip-compressed. Raw eight-buffer readbacks remain in the linked run artifacts. The checkpoints identify their exact hashes; compressed receipts do not claim to contain the raw buffers.

Next step is exactly one readable 224×360 native window-surround crop of unchanged 04e5ac12 geometry/material. Four 112×180 cores with two-pixel halos use the same 640×426 viewport, lens, original 25c staged query, all 12 normal groups and complete 16×16 diagnostic shadow. A generalized two-dimensional assembler retains exact raw, shader, camera, shadow and safe composed-overlap checks and rejects duplicate/missing core pixels. Source/material functions are frozen; no parameter change is bundled with this review. Four complete-tile checkpoints can be reused independently if another job fails. No mid-stage GPU-state recovery is claimed.
