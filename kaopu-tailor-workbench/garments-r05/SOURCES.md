# R05: short-sleeve construction learning loop

An independent case with eight real flat panels and sixteen directed stitch pairs. R01–R04 are unchanged. It shares frozen R04 display, body and original solver resources; `MANIFEST.json` identifies those dependencies by hash.

## Pattern, curves and flat mesh

- The unchanged [GarmentCode Shirt generator](https://github.com/maria-korosteleva/GarmentCode/tree/d449629979028123a5c4dc9e732a2ec19b7fce31), commit `d449629979028123a5c4dc9e732a2ec19b7fce31`, supplied the attributed pattern. Its MIT notice is retained
- Four torso panels and four sleeve panels, including the original analytic neckline, armhole and sleeve-cap curves. No teacher fitted 3D garment is an input
- The flat triangulation was generated offline by the MIT BoxMesh wrapper with CGAL. [CGAL has separate GPL/LGPL/commercial licenses](https://www.cgal.org/license.html); it is not made MIT by the wrapper. The browser contains only input-derived flat coordinates and triangle indices, no CGAL source, library or runtime. The [GNU output FAQ](https://www.gnu.org/licenses/gpl-faq.en.html#WhatCaseIsOutputGPL) distinguishes program code from output that does not copy program material
- Original browser functions grade every material UV below the underarm datum or in the distal straight sleeve strip. Body length delta −50…+80 mm; sleeve length delta −30…+50 mm. Curved boundaries and fixture material points stay unchanged
- Connectivity is deliberately retained from the high-quality flat template. This is bounded 2D grading, not a new online Delaunay triangulation or 3D garment scaling. Triangle orientation, angle, panel boundary and seam topology are rechecked on every cut
- Nine bounded paper combinations pass structural tests, with minimum angles above 21.27°. This does not certify nine finished fits
- The SVG retains analytic curves at millimetre scale. The simulation uses sampled boundaries; a 4097-sample-per-curve check found maximum deviation 0.45587 mm. This is a sampled estimate, not a formal interval bound
- Grain arrows are original suggested annotations; the isotropic solver does not model directional textile properties. N1/N2 are normalized paired alignment marks, not physical cut notches. Seam allowance is explicitly 0 mm in this net-pattern model

## Body and actual reconstruction

The same public synthetic adult [Anny model](https://github.com/naver/anny/tree/d6fc027ced5c17b6b0775dee944096ade7a9ef80) and reviewed measurement selections as [R04](../garments-r04/SOURCES.md) are reused: 13,718 vertices, 27,420 triangles, millimetres, ground Y=0. Model assets are MakeHuman-derived CC0; Anny code is Apache-2.0. No private scan or photo is present.

The browser runs the original R04 XPBD implementation from new flat material: centers → sleeve tubes → shoulders → armholes → sides → release both temporary shoulder fixtures → eight simulated seconds under full gravity. Total: 2,280 frames / 38 simulated seconds. Actual device wall time is substantially longer.

The full upper-body collision field has 201 × 161 × 131 samples at 5 mm spacing and 0.05 mm quantization. Lossless delta/gzip transport is hash-checked. Contact comes from the actual source body triangles, not a fitted analytic body proxy. Independent final source-body and strict cloth triangle intersection checks remain visible.

Initial appearance is explicitly a prior **own-engine** solve, saved for quick inspection. Changing either size invalidates that record. The recipe rebuilds the identical flat material and rest metrics; it does not load an old fitted garment. Mesh size staying at 3,090 material particles / 5,582 triangles is intentional template reuse.

Baseline own solve: source-body intersections 0, strict cloth self-intersections 0, original-UV area-weighted P95 strain 6.44%, local maximum 37.23%. The +40 mm body / +30 mm sleeve native trial gives P95 6.71% and local maximum 39.93%, with both intersection counts 0. Shoulder and armhole hotspots are substantial and are not concealed by smooth shading. Browser acceptance is recorded separately from these native results.

## Model limitations and comparison boundary

Fixed adult synthetic body and pose; uncalibrated isotropic material, areal density 0.2 kg/m², extension compliance 1e−7 m/N, bend-distance proxy compliance 20 m/N. Ideal zero-width sewn points share solver degrees of freedom. Original UVs, rest edges, material mass, panel identities and seam mapping remain available.

No real seam-allowance layers, thickness, collar/cuff bindings, closures, moving-body or physical donning validation. Cloth self-contact response is disabled; final strict intersections exclude adjacent faces and do not establish coplanar-overlap or continuous-collision safety. This is an observable basic garment experiment, not validated production tailoring.

The official restricted Warp research simulator was used only for isolated offline comparison. Neither that runtime nor its simulated garment is included here. Failed adaptive-remeshing trials remain diagnostics rather than accepted cases. [PatternGSL](https://lagrangeli.github.io/PatternGSL/) informs structured panel/curve/stitch thinking; no photo inference implementation or weights are claimed. No GarmentCodeData training dataset is included.

Shared Three.js and OrbitControls are MIT with existing R04 notices. All runtime requests stay on this same self-hosted site. No paid service, account, private asset or new permission is required.
