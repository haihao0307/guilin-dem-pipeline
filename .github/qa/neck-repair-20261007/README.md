# Current published-neck repair checkpoint

This work addresses the user's two2026-10-07 images of a raised posterior-neck seam in the live skin workbench. It does not depend on the lost unpublished R02 package, or retry its pending mapping upload.

The pinned deployed commit iscdf2ac931e444875dd400eafada7ee118702147f. The skin workbench and common R01 currently have identical UnifiedModel, canonical topology and adapter blobs. The skin shader changes fragment color/roughness/micro-normal only; it has no vertex displacement. Neutral geometry has a real cross-section slope change at the neck bridge. The old contour/fairing reduce it but leave a visible geometric ridge.

recover.py restores only the40 needed public files, approximately80MB compressed teacher/canonical assets, never the full MHR model. All source URLs and downloaded hashes are saved in recovery-receipt.json; Anny parts/joined/raw and GNM binary hashes are independently checked. No input screenshots/private photos or heavy teacher assets are committed here.

fixtures.mjs evaluates the unchanged real model at the actual supported child1/3, young2/3, old1 age anchors through raw/contour/final stages. build_probe.py compares two local biharmonic fields in a fixed30mm geodesic neighborhood of the neck rings.1116 affected material vertices,334 boundary vertices; every protected face/oral vertex and all vertices outside that band are byte-identical. Uniform weights deform up to18mm and are diagnostic only. The cotangent/lumped-area candidate moves at most approximately7.3mm in these three cases; it is provisional pending images, pose/shape tests and intersections.

The browser diagnostic uses the actual pinned Three.js and SkinMaterial, unchanged lights, shared camera and published neutral procedural skin-reference field. It renders gray/skin/normal views for multiple ages and directions. It is not yet the final production integration test. UI/CSS ownership remains with the overview owner.

Reproduction: python recover.py; node fixtures.mjs; OPENBLAS_NUM_THREADS=1 python build_probe.py; python analyze.py. Run a static server at this directory root and qa/browser.cjs with pinned Playwright1.57.0. A generated kernel must be hash-pinned and tested before any publication; no production release is authorized by this checkpoint.
