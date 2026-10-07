# Current published-neck repair checkpoint

This work addresses the user's two 2026-10-07 images of a raised posterior-neck seam in the live skin workbench. It does not depend on the lost unpublished R02 package, or retry its pending mapping upload.

The pinned deployed commit is cdf2ac931e444875dd400eafada7ee118702147f. The skin workbench and common R01 currently have identical UnifiedModel, canonical topology and adapter blobs. The skin shader changes fragment color/roughness/micro-normal only; it has no vertex displacement. Neutral geometry has a real cross-section slope change at the neck bridge. The old contour/fairing reduce it but leave a visible geometric ridge.

recover.py restores only the40 needed public files, approximately 80 MB compressed teacher/canonical assets, never the full MHR model. All source URLs and downloaded hashes are saved in recovery-receipt.json; Anny parts/joined/raw and GNM binary hashes are independently checked. No input screenshots/private photos or heavy teacher assets are committed here.

fixtures.mjs evaluates the unchanged real model at the actual supported child1/3, young2/3, old1 age anchors through raw/contour/final stages. build_probe.py compares two local biharmonic fields in a fixed 30 mm geodesic neighborhood of the neck rings. 1116 affected material vertices, 334 boundary vertices; every protected face/oral vertex and all vertices outside that band are byte-identical. Uniform weights deform up to18mm and are diagnostic only. The cotangent/lumped-area candidate has now passed 18 local runtime cases, the original 15-case geometric check and 8 neck-to-all-model intersection scans. Every case retains the same topology and exact protected face/exterior coordinates.

The browser diagnostic uses the actual pinned Three.js and SkinMaterial, unchanged lights, shared camera and published neutral procedural skin-reference field. It renders gray/skin/normal views for multiple ages and directions. It is not yet the final production integration test. UI/CSS ownership remains with the overview owner.

Reproduction: python recover.py; node fixtures.mjs; OPENBLAS_NUM_THREADS=1 python build_probe.py; python analyze.py. Run a static server at this directory root and qa/browser.cjs with pinned Playwright 1.57.0. A generated kernel must be hash-pinned and tested before any publication; no production release is authorized by this checkpoint.

## Frozen integration candidate

frozen/neck-cotangent.bin.gz is the exact selected asset, Git blob d85dc1a0a9f143f8ce123ab6b8a01909a272b028 and SHA256 457c06ddda3d3556098b609ca3fabb095934e9a9f99395a930f6f875af50ebaf. Both workbenches use the same kernel. Teacher data and canonical topology remain unchanged. build_integration.py creates only the geometry/loader/asset/profile-contract edits over the immutable deployed source; it does not edit HTML or CSS.

The closed local-neck-patch volume changes between +0.02% and -4.22% in the 18 sampled states, including -2.09% in the neutral state. This is explicitly not exact volume preservation or whole-body volume. Do not restore the old ridge merely to force its volume back.

The current adapter fingerprint is 55467d5e5fef904ca9999231fde71a720ae411bcd8cb1f581de4f36cf84618b1. Only the pinned previous R01 parameter fingerprint is accepted for explicit migration; the UI identifies the repaired neck connection, preserves all face/body coefficients, and writes the new fingerprint on export. Unknown versions remain rejected.

qa/workbenches.cjs tests the actual baseline skin page plus both candidate workbenches at 18 real states, in gray and skin under the same lighting/cameras. It compares protected/exterior and full-mesh hashes, real saved/imported profiles, legacy migration, rejection without mutation, and exact OBJ output. The initial diagnostic browser run37562982219 is retained separately; production is unchanged until the integrated gate and visual review pass.
