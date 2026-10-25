# Lace Atelier R05 — stitch naturalism experiment

Date: 2026-10-25
Base: R04 candidate commit `b3f91dd46a25a012de25af9ec122cb0f10a1c81b`
Branch: `research/lace-atelier-r05-stitch-naturalism-20261025`

## Problem being tested

R04's own visual review says the raised fill still reads as repeated, parallel hard rods. R05 targets the regularity of stitch placement, not a broad geometry-density increase. The current patch adds a bounded, deterministic height variation to the interior stitch relief only. Its XY path is unchanged, preserving the stitch count formula, boundary shape, attachment endpoints, yarn radius, net construction, and recipe schema.

## Constraints

- Jitter is a function of stitch index, element ID, seed, and the existing variation parameter; it does not consume the random generator stream or make builds non-repeatable.
- Offset is capped below half a nominal stitch interval, so neighbouring positions should not reverse order.
- No texture maps, copied motif assets, external mesh, or fixed-distance LOD is introduced.
- R01/R02/R03/R04 history remains intact; this is a separate research branch and must remain Draft.

## What is and is not proven

This is a focused geometry hypothesis. It is not yet a claim of improved lace realism. The candidate must pass core/API tests and a clean standalone build, then be inspected at overall, macro, grazing-light, front/back and oblique views. The known browser WebGL limitation and failed R04 publication path remain unresolved until new evidence proves otherwise.

The R04 baseline had 2.73M primary triangles and about 3.03M total triangles in its default botanical preset, roughly +24.16% total over R03. R05 does not intentionally add stitch count or geometry segments, but the resulting exact geometry counts and render cost must be measured by the test/build output; no GPU performance claim is made.

## Acceptance questions

1. Does the fill stop reading as mechanically parallel rods at macro distance?
2. Do stitch intervals remain ordered and do tips/attachment points remain stable?
3. Does the visual improvement persist under the same camera and light?
4. Does it avoid adding obvious noisy/speckled appearance at overall distance?
5. Is the effect worth retaining after real browser/WebGL review?

If visual review does not support the change, revert the R05 patch rather than promoting it.


## Follow-up: cross-section normal consistency

The R05 display implementation originally used different lobe amplitudes for vertex positions and the analytic angular derivative used by normals. It also retained a lobed normal profile when the A/B checkbox disabled the geometry envelope. This made the switch an invalid optical comparison. The profile and derivative now share the same coefficients and strength; the undersampled sixth harmonic was removed, leaving a stronger single three-lobe approximation, and A/B OFF uses the unlobed ellipse. A numeric strength control supports controlled sweeps without changing topology. The new CPU tests validate the analytic ellipse normal, bounded strength response and unchanged vertex/index counts.

This is a geometry/shading correctness fix, not proof that the current stylized three-lobe envelope matches real lace thread. Visual judgement still requires same-camera browser/WebGL comparisons under studio, grazing and backlight conditions.
