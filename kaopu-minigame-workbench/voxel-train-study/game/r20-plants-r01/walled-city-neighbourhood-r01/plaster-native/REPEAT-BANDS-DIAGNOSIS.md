# Frozen grey-plaster stripe diagnosis and metric-field bridge

Baseline: def55598b6f6b9570365a50a718fa3faa3c742e3, GPU run 38132625915, 800 × 600. This investigation inspected the actual street-eye, borrowed-door, and dry-control PNGs. Candidate GPU acceptance is pending; CPU source/geometry checks are passed.

## Finding

There are two superimposed effects. Dry grey modulation comes from the retained source material fields evaluated in the supplied stretched domain. The deeper narrow wet lines are an additional V26 effect. Changing only wet strength cannot fix the dry field. The evidence does not support replacing the source kernel, adding noise, refining the grid, or repairing normals.

The old surface adapter supplied half = [1.775, 13.695] m on W/E front faces (other faces use horizontal half 1.95 m). The second value was half the entire building height, also used by the water domain. The source mmObserved and macro/micro low fields therefore traversed vertical material coordinates 7.02–7.72 times more slowly than horizontal coordinates. The new thin mesh uses real clipping boundaries, so its field half extents need not describe the full geometric silhouette.

A same-5-cm-step directional diagnostic of the unchanged mmObserved algebra, with a fixed 9-octave CPU observation bound, gives:

- Legacy [1.775, 13.695]: horizontal/vertical RMS difference ratio 6.413880378984681
- Metric [1.775, 1.775]: ratio 1.004044929789922
- Proposed fixed [1.8, 1.8]: ratio 1.0159371846189902

These are controlled coordinate diagnostics, not screen-filtered GPU appearance metrics.

## Direct old-image and geometry evidence

The audit is pinned to copies of the old building/surface recipes under versions/def55598, not the concurrently revised building layout.

- 160 plaster objects, 1,225,028 triangles, 40,807,504 attribute/index bytes, exactly matching the old GPU receipt
- 306,337 front vertices checked; no nonfinite or excessively tilted front normals
- Minimum absolute local front normal z = 0.9997954964637756
- Zero zero-area front triangles after Float32 storage
- Existing CPU coverage also checks real door/window openings, welded closure, shared-region seams, correct face directions, finite carrier coordinates, and no internal seam sidewalls

The explicit dry-image scanline is E8-right at pixel y = 125, x = 471..499. Raycasting the frozen geometry and applying the retained source base/lighting/tone-map algebra reproduces 85 of 87 RGB channel bytes exactly. The remaining two differ by 1; mean absolute channel error is 0.022988505747126436. The visible dry 97..102 red-channel variation is reproduced from the source field rather than inferred from a screenshot label.

The CPU approximation intentionally omits micro bump, filtered grain, source observation screen derivatives, and the tiny specular term. It is a local attribution check, not an assertion of whole-image GPU equivalence. Full per-pixel positions, normals, source scalar values, and predictions are in repeat-bands-ray-probes.json; measured values are in repeat-bands-pixel-evidence.json.

At pixel (498,125), wet red is 83 and dry red is 101; the dry source prediction is 101. This independently demonstrates an additional wet dark line on top of the source dry variation.

## Minimal fix and integration

New helper: makeMetricPlasterField({center, metresPerUnit:1.8}) from metric-field-domain.mjs. It returns the existing params shape with the supplied immutable center and half = [1.8,1.8]. The parent surface adapter must apply this helper; simply adding the file does not change existing material calls.

Use one fixed center and 1.8 m/unit for an entire facade domain. Reuse them across floors, setbacks, wall-width changes, exterior/interior coats, and regions. Preserve the interior relief/micro parameters by spreading them alongside the helper result. Do not derive this scale again from each floor's width, reset its phase/seed per floor, or use the water-domain height. The complete V26 domain should retain its own physically appropriate building bounds.

1.775 m is also suitable and differs from 1.8 m by only 1.4%; a fixed 1.8 m is easier to keep stable as the building layout changes. This patch does not alter any existing original source, CPU source-field port, geometry, shader, default, or material function. The old explicit half parameters remain available for A/B.

The exact same index topology, vertex counts, carrier arrays, triangle counts, draw counts, and allocated bytes are retained. Geometry heights/normals and shader field evaluation both consume the same new half values, so the change does not decouple shape and shading.

## Important residual source periodicity

The retained source coarse field has two explicit sines:

sin(2.7u + 0.9y) × sin(3.2y − 0.7u)
= 0.5[cos(3.4u − 2.3y) − cos(2u + 4.1y)].

For the old 2.75 m floor pitch, the first harmonic shifts 6.325 radians per floor, only 0.04181469282041306 from 2π. That original material can therefore still show repeated broad structure even after correcting the normalized low field. The metric bridge removes the measured tall-domain anisotropy; it does not claim to remove all original periodicity or the V26 wet lines. Any later aesthetic change to the original carrier needs its own explicit evidence and comparison.

## CPU and GPU verification

Passed: 18/18 tests (original 14 plus 4 new). The 12-wall reference remains 45,972 vertices, 72,748 triangles, 2,459,256 bytes. Test output is metric-field-cpu-results.txt.

CPU commands, run from the project parent:

PLASTER_THREE_FILE=/workspace/shared/kaopu-vendor-r170/three.module.mjs node --test walled-city-neighbourhood-r01/plaster-native/plaster-native.test.mjs walled-city-neighbourhood-r01/plaster-native/metric-field-domain.test.mjs
PLASTER_THREE_FILE=/workspace/shared/kaopu-vendor-r170/three.module.mjs node walled-city-neighbourhood-r01/plaster-native/audit-repeat-bands.mjs
python walled-city-neighbourhood-r01/plaster-native/verify-repeat-band-pixels.py

Minimal GPU entry: qa/plaster-field-domain-compare.mjs, export runPlasterFieldDomainComparison({THREE, renderer, report}). It reuses the host renderer and does not create a second animation loop. It renders only the frozen E8-right wall's two thin coats: legacy versus metric, each front-on and oblique, four PNGs total. Every view completes three readPixels frames and returns firstCompletedMs and warmMeanCompletedMs. Initial program compilation can contribute to the first measurement. Original source functions, topology and dry state are identical; V26 and other materials are absent. Renderer target/viewport/scissor/clear settings are restored. The host's existing report callback can save its stage:shot PNGs.

GPU module syntax check passed. No candidate browser/GPU rendering was performed by this worker. Visual approval remains false until the host inspects the actual A/B PNGs and whole-building dry/wet views. Do not use the isolated wall timing as whole-building FPS.

## Unchanged source locks

- source-plaster-original.frag: 6e6acf08c21ed3ad3dd390325e17ffd404f85d4d86eff957b499bcdb1dee55ff
- fields.mjs: 9572a99728a2d815cd9b9fe5a55dd940ac2a312bd5660f0851d6d91c93edabff
- geometry.mjs: 5c797d13527c39bae72c7fc0a008bd7cc6d8710fd3bf770ddc9e6db7fb22ae6f
- shaders.mjs: 5cd7a790463c6669c86f2df16b74d171422dd5319ee827a1ec51e01a0a047d8b

All worker changes are new files in plaster-native or the single new qa module. No neighbouring runtime files were edited. METRIC-FIELD_SHA256.txt enumerates the exact handoff artifacts.
