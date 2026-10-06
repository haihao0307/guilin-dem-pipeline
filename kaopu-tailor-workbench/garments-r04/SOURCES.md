# R04: basic sleeveless top learning loop

This page is an independent addition. Published R01, R02 and R03 are unchanged.

## Actual input paper

- Generator: [maria-korosteleva/GarmentCode](https://github.com/maria-korosteleva/GarmentCode/tree/d449629979028123a5c4dc9e732a2ec19b7fce31), pinned commit `d449629979028123a5c4dc9e732a2ec19b7fce31`, MIT
- The unchanged official `Shirt` generator produced this four-panel, six-stitch net pattern with `sleeveless=true`, width 1.05, length 1.2, flare 1, collar width 0, front depth 0.25, back depth 0, no separate collar component
- Original curves are sampled within 0.25 mm chord deviation; every source panel and stitch remains identifiable
- The browser uses original bounded 2D length and hem-ease functions. It is not a full browser port of the official procedural generator
- Body length delta: −50…+80 mm below the underarm datum. Hem circumference addition: 0…120 mm, distributed equally over four panels. Neck, shoulders and armholes are unchanged
- Nine parameter combinations pass paper/mesh/topology checks. These checks do not certify fit for all parameter choices

## Body and measurement definitions

- Public [Anny](https://github.com/naver/anny/tree/d6fc027ced5c17b6b0775dee944096ade7a9ef80) v0.6.1 source, commit `d6fc027ced5c17b6b0775dee944096ade7a9ef80`. Code: Apache-2.0; MakeHuman-derived model assets: CC0
- Same adult synthetic body used by R03: 13,718 source vertices, 27,420 triangles, ground Y=0, millimetres. No private scans or user photos
- Model SHA-256: `57cb642954bfee0c7589626a22726f5584490f74a1e38e7db8eb78a8392f57b1`
- Bust: convex tape envelope at the actual bust-peak line. Shoulder/nape/axillary/neck-side selections are explicit source-skin landmarks, not an externally validated automatic anthropometry system
- GarmentCode's body documentation points to [GarmentMeasurements](https://github.com/mbotsch/GarmentMeasurements/tree/04e9197c37197c5b05c1c86abf5ac503864e0d8f). That separate repository is GPL-3.0. Measurement semantics were reviewed; no GPL implementation or configuration is shipped here
- In particular, `armscye_depth` is the Euclidean shoulder-to-underarm landmark distance, 139.04 mm here. It is not the 189.42 mm mesh-edge surface path. Shoulder inclination uses neck-side to shoulder, 21.87°, not center-nape to shoulder
- Full spatial evidence and units are retained in the measurement JSON and visible body overlays

## Original computation and checks

- Immutable original flat material → constrained 2D Delaunay mesh → staged XPBD seams → source-triangle body SDF contact → release both shoulder fixtures → eight simulated seconds of gravity
- Completion is 1,560 steps at 60 Hz, 26 simulated seconds total. Actual wall time is longer and depends on the browser/device
- Ideal zero-width seam points share solver degrees of freedom after progressive sewing. Original material vertices, UVs, area/mass and rest edges remain available for audit
- SDF: original nearest-triangle BVH, 5 mm grid, 0.05 mm quantization. The web uses a byte-identical cropped grid covering this garment; all out-of-domain vertices remain explicit diagnostics. Delta/gzip is lossless and SHA-256 checked after decode
- Independent final triangle intersection audit and region-weighted original-UV strain reporting. Real seam allowance layers have zero modeled area, not hidden removed geometry
- Initial fitted mesh is explicitly a previous **own-engine** solve. Changing parameters invalidates it; a new mesh is cut and computed. Recipes rebuild flat material rather than replacing the scene with an old fitted mesh
- Baseline: body vertex/face intersections 0, strict self-intersections 0, original-UV area P95 strain 2.04%, area exceeding 5% 0.89%, local maximum 28.1% near a shoulder seam. Local strain and residual motion are limitations, not an industrial fabric certification

## Boundaries

Fixed adult synthetic body; uncalibrated isotropic material; distance-based bend approximation; no real allowances, thickness layers, edge bindings, closures, physical donning, or moving-body validation. Runtime cloth self-contact response is disabled. The final strict intersection check excludes adjacent faces and does not test coplanar overlap or continuous collision. No universal sizing or commercial manufacturing readiness is claimed.

Short-sleeve set-in construction remains a separate, unpublished fit diagnostic. Its high-strain trials were not relabeled as a validated short-sleeve result. The restricted official Warp research simulator and its simulated garments are not included in this package.

[PatternGSL](https://lagrangeli.github.io/PatternGSL/) informs the structured panel/curve/stitch representation only. No unreleased photo inference code or weights are claimed. No GarmentCodeData training dataset is included; its separate data license is not inferred from the code license.

## Runtime dependencies

- cdt2d 1.0.0 and bundled robust geometry dependencies: MIT, individual notices retained
- Three.js and OrbitControls: MIT, same self-hosted runtime as R03
- No external runtime requests, paid services, account creation, private assets, or restricted teacher runtime
