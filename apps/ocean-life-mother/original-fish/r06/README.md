# Original Fish R06 — first native whole-fish production line

Date: 2026-09-20  
Branch: `work/original-fish-r06-first-native-fish-20260920`

R01–R05 established measurement identity, evidence-bounded interpolation, the 20–100 mm game-visible scope, a 71 mm `Amphiprion ocellaris` measurement card and a measured 20.82–34.50 mm size series. They did **not** yet form a visible whole-fish generator.

R06 adds the first executable Original Fish registry and whole-fish workbench.

## What now exists

- one shared registry for multiple species and evidence states;
- `MEASUREMENT_ONLY` entries refuse to fabricate 3D when width/cross-section evidence is missing;
- one source-independent whole-body candidate for `Micropterus salmoides`;
- generated body, structural lower jaw, mouth cavity, upper/lower lips, opercula, eyes, caudal/dorsal/anal/pectoral/pelvic fins;
- mouth opening, opercular opening and continuous tail-body bending;
- procedural wet-skin candidate and thin-fin translucency candidate;
- fixed side, three-quarter, front and top views;
- desktop and phone-sized workbench target.

## Evidence boundary

The black-bass candidate is `N2_TRANSITIONAL_REFERENCE` and `ENGINEERING_PREVIEW` because the exact source model has no trustworthy physical millimetre scale. The runtime stores only low-dimensional section stations, anchors, fin outlines and independent functions. It does not load the source mesh, source textures, source skin or source animation.

The 71 mm clown anemonefish card remains `N1_SCIENTIFIC_NATURE` but `MEASUREMENT_ONLY`. It is not rendered as a fake 3D fish because top-view width and cross-section functions remain unknown.

This split is deliberate: having a clear image or a 3D asset does not make its biology true, while having some scientific rulers does not justify inventing missing 3D structure.

## Direct entry

Open:

```text
apps/ocean-life-mother/original-fish/r06/index.html
```

The loader verifies the exact candidate SHA-256 before opening it.

## Current acceptance

- registry and evidence gate: implemented and tested;
- numerical geometry tests: `44 assertions passed`;
- local browser QA: desktop `1440×1000` and mobile `390×844` pass with WebGL error `0`;
- visual acceptance: false;
- user acceptance: false;
- nature-derived claim: false;
- production ready: false.
