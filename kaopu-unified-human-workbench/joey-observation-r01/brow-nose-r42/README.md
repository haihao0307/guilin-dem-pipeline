# R42: one native brow/nose full-face candidate

User rejected R39B. R30 remains the preserved female-readability baseline, with no likeness acceptance. R42 starts from R30, not from an accepted B. No production page changes or source-reference images are included.

The visible concern is the whole eyebrow/nasal relationship: the old brows read as rounded arches with sparse medial starts; reference U01/U04/U07 have a more extended, near-straight main band and gentle lateral peak/taper. The current nose reads short and bulbous across front/oblique/profile. U13 offers a larger oblique reference with a continuous ridge-to-tip direction, but is not a calibrated side photograph. Pose, expression, light and lens differences prevent anatomical millimetre recovery.

Only one candidate is authored. Existing surface-bound eyebrow options change archFlatten .75→1, outerLift .005→.001 m, maskRadius .0053→.0048 m, length .0045→.0037 m, medialFeatherFloor .35→.70, count 1800→2100. Root triangles and barycentrics remain on the original native GNM skin; this is existing 3D grooming, not painted makeup or replacement facial geometry. These values are authoring choices, not measured hair follicles.

Five existing Anny controls change: nose-scale-vert .28, nose-scale-depth -.17 (from -.25), nose-greek .35, nose-septumangle .35 and nose-nostrils-angle .15. R37's moderate angular direction is reused as a candidate only; it was never a whole-face acceptance. Nose width/volume, eyes, mouth, cheeks, GNM identity, body, skin and expressions retain R30. No R38 lips or R39B jaw recipe is adopted.

The native model was actually evaluated locally with the previously verified fixed runtime: maximum vertex change 1.96437 mm, zero relative triangle reversal, exact rollback. The browser test compares R30 / R42 / restored R30 at one matched eye-level long-lens camera from R40 with zero expression and original zero eye rotations. It checks complete position SHA, 68 landmarks, finite brow geometry, native surface support, deterministic bare renders and archive/pixel rollback. The old 8000-strand head hair settings and code are frozen for three-view visual context. Self-intersections and final likeness are not implied by these checks.

Current status at upload: own code and local native geometry tested; actual browser rendering pending. Browser results must be read and images actually viewed before reporting an outcome. A passing test does not constitute likeness acceptance.
