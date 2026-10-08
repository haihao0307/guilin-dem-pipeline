# R06.2 reference and delivery audit

Audit scope: deployed `gh-pages` base commit `6562c4677b1b14c58f00d686ceb700856118854d`, not the older main branch.

## Retained source and coverage

The repository contains MIT GarmentCode pinned at `d449629979028123a5c4dc9e732a2ec19b7fce31`, original source, notices, the design schema, and a live Python/WASM adapter. The declared 23 entry recipes, 23 paper thumbnails and 122 design fields are retained. These are starting recipes, not every possible garment or valid parameter combination. Three previously accepted restricted basic garment experiments are preserved separately with their original source, controls and solver settings.

Entry IDs: Shirt, FittedShirt, Pants, Skirt2, PencilSkirt, SkirtManyPanels, SkirtCircle, AsymmSkirtCircle, GodetSkirt, SkirtLevels, LongSleeve, Strapless, AsymmetricShirt, Turtle, SimpleLapel, Hood2Panels, CuffBand, CuffSkirt, CuffBandSkirt, StraightWB, FittedWB, MetaGarmentDress, MetaGarmentJumpsuit.

Historical provenance also names PatternGSL and GarmentCodeData. PatternGSL image inference and the full GarmentCodeData dataset are not integrated. The user's exact earlier reference message has not been uniquely recovered; these are verified repository references, not a claim to recall the missing message.

## Original failure

The catalogue UI hid its sewing button when `current.kind !== 'legacy'`. The worker returned `canSew:false` for all analytic entries and rejected their run requests. They generated paper and placed material, not wearable garments. Primary controls were below the 122 parameters. The analytic route did not display the retained human body.

## Additive R06.2 repair

Original application and all three accepted garment sources are unchanged. New entry: `r06/index.html`; additive generated application/worker/styles: `catalogue/r06-*`. Paper, three-dimensional view, sewing, pause, resume and cancel controls remain beside the viewport. The original body is displayed without scaling or surface changes.

Each new-style sewing request runs the live original pattern generator with current inputs, meshes original material coordinates and applies actual seam constraints. No precomputed garment is fetched on this route. Ordinary seams keep all edge samples. Declared gathering above 15% uses sparse numerical stitch sites, with free intervening material; neither lengths nor rest UV are shrunk. Numerical sites are not manufacturing needle spacing. Temporary shoulder-seam fixtures are released before gravity.

Existing f64 XPBD kernel is reused. A full original-body SDF replaces the cropped upper/lower fields only for new-style trials, using 5 mm spacing and 0.05 mm quantization. The original three families retain their original cropped fields and settings.

## Physical limitations

Callable sewing does not establish a wearable or certified garment. All new-style results remain unaccepted; failed intersection/strain diagnostics remain visible. Runtime cloth self-contact response and continuous collision detection are absent. Final strict triangle checks do not cover coplanar overlap or continuous motion. Fabric is uncalibrated; manufacturing seam allowance, thickness, bindings and animated dressing are not modeled. PPF is a separate native offline authoring reference, not this browser XPBD calculation.

First browser runtime transfer is about 25 MB; the full-body field adds approximately 7.7 MB. A worker calculation may take minutes; pause/cancel are exposed. No paid service, private assets, credential or file upload service was added. A fixed synthetic body and uncalibrated material currently prevent arbitrary-person production fitting.

## Existing reference paths

`../garment-pattern-catalogue-r01/README.md`, `browser/styles.json`, `browser/parameter-schema.json`, upstream source and notices; `../catalogue/README.md`; original `workbench-app.mjs` and `workbench-worker.bundle.mjs`; `../PROVENANCE.json` and `../LEARNING.md`.

GarmentCode: https://github.com/maria-korosteleva/GarmentCode
GarmentCodeData: https://igl.ethz.ch/projects/GarmentCodeData/
PatternGSL: https://github.com/Lagrangeli/PatternGSL

Actual generation, browser and public delivery evidence are saved separately with exact source commits. Mobile viewport checks are not physical-device tests.
