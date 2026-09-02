# Landscape Mother Karst V005 QA Report

## Approval state

- visualApproved: false
- userVisualAcceptance: pending
- productionReady: false
- deliveryMode: interactive 3D workbench only
- staticPreviewImages: 0

## Requested visual constraints

- Directly opens the interactive karst scene: PASS
- Clearly colored terrain material: PASS
- Strong readable lighting: PASS
- Distance haze or grey atmospheric veil: ABSENT
- Decorative distant mountains: ABSENT
- External terrain meshes: 0
- External terrain textures: 0
- Image elements: 0

## Runtime result

- Seed: 1847
- Total vertices: 408,288
- Total triangles: 136,096
- Runtime meshes: 3
- Build time in the QA browser: 2,021 ms
- Geometry hash: `99a70af5`
- Runtime LOD: false
- WebGL error: 0
- Console errors or warnings: 0
- Page errors: 0
- Failed requests: 0

## Karst body topology

The body was tested after welding identical positions at 0.00001 world-unit precision.

- Body triangles: 119,272
- Open boundary edges: 0
- Non-manifold edges: 0
- Near-zero transition slivers: 95

The retained transition slivers are coincident triangles generated where the tetrahedral iso-surface crosses grid vertices. They do not create open boundaries. Unresolved small subtraction features were removed, and the renderer no longer discards reverse-facing transition fragments.

## Frame-buffer checks

- Mean luminance: 0.4259
- Mean chroma: 0.3079
- Colorful-pixel ratio: 0.9995
- Near-black ratio: 0
- Clipped-bright ratio: 0
- Frame hash: `f6761e65`

## Reproducibility

- Seed 1847 first geometry hash: `99a70af5`
- Seed 1848 geometry hash: `c693dc1f`
- Seed 1847 repeated geometry hash: `99a70af5`
- Same-seed deterministic repeat: true
- Different seed changes geometry: true

## Publication

- stable entry: `https://haihao0307.github.io/guilin-dem-pipeline/landscape-mother/`
- versioned entry: `https://haihao0307.github.io/guilin-dem-pipeline/landscape-mother-v005/`
- source SHA256: `66e788144969fd5a1a776264d0c71002deba6ada24098df74570c61b846392fc`
- deployment gzip SHA256: `f749a3eeff0bba65a221f812e03c942eda022b6ec764d3741e3651da1ac06081`
- deployment payload chunks present: 9 of 9
