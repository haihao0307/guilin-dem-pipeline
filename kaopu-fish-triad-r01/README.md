# KAOPU Fish Triad R01 — Muskellunge-labelled Teacher Reconstruction

This project is the first Fish-domain implementation beside the GS/K2 score-instrument workbench. It follows the frozen three-system contract:

- **Composer KC1** imports evidence, freezes requirements, compiles Base + Source Score, and never owns a secret fish generator.
- **Resolved Score** explicitly stores this teacher object's axial stations, cross-sections, eyes, mouth, fins, appearance, bone positions, motion parameters, evidence and unknowns.
- **Fish Instrument KF1** contains only shared fish-domain operators: continuous axial loft, superellipse sections, score-defined fin extrusion, actual Three.js skeleton/skin weights, travelling-wave deformation, pectoral/jaw branch bones, procedural wet skin, measurement, snapshot and disposal.

## Reference audit

Input package: `muskellunge+fish+3d+model.zip`

- SHA-256: `b998f32ffe3fb5e0aa5c55b62eb0f894dfa0dc86397758846127898ff5656ef1`
- 1 static FBX, 5 PBR maps
- 482,095 vertices
- 964,285 triangles
- no deformer, skeleton or animation in the teacher file
- source axes measured as X length, Z vertical, Y lateral; formal score converts to metre, Y-up

The teacher mesh and original textures are not included in the formal instrument, Resolved Score, standalone player or public runtime. The workbench offers an optional local `.fbx` comparison input; that locally selected teacher is a translucent comparison layer only and is never written back as the formal result.

## Formal object

The first score contains:

- 18 measured axial stations;
- 8 explicit fin profiles;
- paired eyes, mouth opening, lower jaw, dentition, gill-cover curves and lateral line;
- 11 body-chain bones plus jaw and paired pectoral branch bones;
- static, cruise, burst, turn-left, turn-right and serial-rig diagnostic modes;
- evidence confidence and unresolved identity/motion questions.

The package name says “muskellunge”, but species identity is not independently validated. R01 reproduces the supplied visible teacher rather than using the name as a preset key.

## Files

```text
kaopu-fish-triad-r01/
├─ TASK_ANCHOR_R01.json
├─ contracts/
├─ scores/
│  ├─ base/FISH_AXIAL_BASE_KF1.json
│  ├─ source/MUSKELLUNGE_SOURCE_SCORE_R01.json
│  └─ resolved/MUSKELLUNGE_RESOLVED_SCORE_R01.json
├─ src/
│  ├─ composer.js
│  ├─ instrument.js
│  ├─ app.js
│  └─ player.js
├─ tests/
├─ scripts/build.mjs
└─ dist/ (generated)
```

Build output:

- `index.html` — one-file composer/workbench, no required network requests;
- `standalone-player.html` — independent formal replay;
- `KAOPU_FISH_COMPOSER_KC1.js` — separate Composer logic;
- `KAOPU_FISH_INSTRUMENT_KF1.js` — separate formal Fish Instrument;
- Base, Source and Resolved Score files;
- manifests and reference audit.

## Acceptance status

- engineering score/instrument separation: implemented;
- actual skinned body and branch bones: implemented;
- deterministic replay tests: implemented;
- external teacher assets in formal runtime: zero;
- natural biological motion acceptance: **not claimed**;
- `visualAcceptance`: `false`;
- `motionAcceptance`: `false`;
- `productionReady`: `false`.

Only the user can approve the visual and motion result.
