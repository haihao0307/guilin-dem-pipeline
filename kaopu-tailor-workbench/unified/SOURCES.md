# Unified clothing workbench: implementation and verification scope

This update combines the existing five cases in the original workbench. It adds no garment type. Source patterns, body meshes, SDF fields, grading operations, material parameters and reference algorithms remain available at their original paths. Compatibility entry pages route to the one viewport.

## Actual acceleration

The baseline is production commit `cdf2ac931e444875dd400eafada7ee118702147f`. Original full garment solves use 12 substeps, 6 iterations, 360 frames per sewing stage and 480 released-support frames. These counts, sequential constraint order, material identities, UV rest metrics, ideal stitch groups and vertex/edge/face body-contact sites remain unchanged.

The new original `physics/kernel.ts` moves numerical projection loops into f64 WebAssembly storage. It shares stitched solver variables while retaining all material vertices. Trigonometric functions use the host's existing Math functions. In the validated bounded domain, Euclidean norms use square/sum/sqrt. Conservative Gershgorin bounds skip a strain projection only when both squared principal stretches are already inside the unchanged 0.985–1.015 interval. There is no new acceptance threshold. Physics geometry and exported results stay f64; only renderer packets use float32 metres, matching the existing renderer precision.

The [AssemblyScript compiler](https://www.assemblyscript.org/compiler.html), pinned 0.28.20, is a build tool. Its [Apache-2.0 license and notices](https://github.com/AssemblyScript/assemblyscript) are retained in `licenses/`. The compiled kernel is self-hosted. Three.js, CDT and robust-geometry dependencies reuse their existing versions and notices. No external runtime service is introduced.

## Measured native comparison

Same machine, same complete new parameter choices; this table is not a promise of phone or browser speed:

| Existing case | New dimensions | Original | Accelerated | Ratio |
|---|---|---:|---:|---:|
| Shorts | leg +30 mm, waist +10 mm | 233.62 s | 62.32 s | 3.75× |
| Sleeveless | length +20 mm, hem +40 mm | 177.19 s | 41.49 s | 4.27× |
| Short sleeve | length +30 mm, sleeve +20 mm | 361.94 s | 86.18 s | 4.20× |

All three retain identical paper snapshots and final stitch-group mappings. Final independent source-body face intersections and strict cloth self-intersections are zero in these trials. Material-area P95 strain changes are respectively 3.752→3.761%, 2.037→2.040%, and 6.480→6.607%. These figures do not certify unseen sizes.

Float64 operation ordering changes still produce different folds over long nonlinear trajectories. Vertex RMS / maximum differences are 1.56 / 13.81 mm for shorts, 2.00 / 12.39 mm for sleeveless, and 5.03 / 28.38 mm for short sleeve. The short-sleeve maximum is an internal lower-back material point. Its neckline centroid changes 0.34 mm and arc length −0.04 mm, with a local neckline point difference up to 11.61 mm; shoulder seam point maxima are 2.79 and 1.32 mm. Both sleeve-opening arc length changes stay below 0.7 mm. Shorts opening folds also differ locally; waist centroid changes 0.04 mm and waist arc length −0.02 mm. This is not bitwise or pointwise equivalence.

Browser measurements, actual front/back comparison images, all four viewport sizes, interruption/repeated-switch tests and old-route compatibility are separate release gates. A native pass alone is not a browser pass. The UI exposes measured compute, decode, metrics, final audit, rendering CPU and communication costs; rendering CPU is not a GPU timer.

## Existing limitations and provenance

The individual sources remain in `../garments-r03/SOURCES.md`, `../garments-r04/SOURCES.md`, `../garments-r05/SOURCES.md` and `../LEARNING.md`. Attributed MIT teacher patterns and the public synthetic adult body retain their original licenses. No private garment assets, photos, restricted teacher simulator, teacher fitted garment or training dataset is included.

Fixed body and pose; uncalibrated isotropic material; no actual seam allowance layers, thickness, bindings, moving-body or physical donning validation for the garment cases. Runtime self-contact response remains disabled. Strict final triangle checks exclude adjacent faces, coplanar overlap and continuous collision. Local shoulder/armhole strain remains substantial. A faster result has the same experimental boundaries as the original cases.
