# Reproduce the component audit

These scripts isolate original clothing CPU dynamics and original shoe geometry. They do not create a complete rendered multi-NPC scene. Full scope, measurements and raw time values are embedded in the result JSON files.

## Frozen upstream source

`SOURCE_LOCK_AUDIT.json` lists the exact public GitHub URL, byte size, SHA-256 and Git blob SHA-1 of each upstream file. It downloads the component dependencies, two garment/reference-body inputs, the shoe-sharing material/scan dependencies and nine read-only clothing interface evidence files. It does not install the complete workbench frontend. The two commands below require no npm install. MP05's Three.js r170 has seven object-ID counter offsets relative to the shoe package. The downloader creates a separate dependency file by reversing exactly those seven lines, then verifies its SHA-256 against the original installed `three@0.170.0` package used for the recorded shoe counts. The MP05 vendor file remains unchanged.

```bash
python3 fetch-sources.py
node run-cloth.mjs
node run-shoes.mjs
```

Use Node **24.19.0** to reproduce the recorded environment. Run CPU measurements serially, with no competing benchmarks. The downloader uses Python standard-library modules. A local audit cache can be copied with `python3 fetch-sources.py --from-cache /absolute/path/to/perf-audit/garments`; hashes remain mandatory. `python3 fetch-sources.py --verify-only` performs no downloads.

The separate `shoe-sharing/` experiment, when included, resolves its bare Three import to the unchanged `mp05-r10/vendor/three.module.js` and uses `@napi-rs/canvas` for genuine source-image decoding. Follow its own pinned package installation and run instructions; do not substitute the derived Three module in that experiment. `runnerModuleResolution` records this difference explicitly. Its source files are shared with this root, including `shoe-workshop/r04/vendor/scan-data.json`.

Cloth output: `cloth-component-bench-r02.json`. Shoe output: `shoe-counts.json`. Preserve the supplied results before rerunning if historical values are required; the scripts write a new result to their corresponding filename.

## Test identity and limits

Cloth uses unchanged MP05 R10 `ReducedCloth`, T03 + P02, denim-bleach parameters and original `step` joint motion. Its actor is the retained common-person fit snapshot with 104 bones / 25,417 control vertices. It does not execute R07 grading or the released webpage's GPU/WASM joint-fit initialization. It is not a measurement of R07 wearing, hair, shoes, GPU drawing, browser workers, or complete-scene FPS.

The two test orders are `[1,2,4]` then `[4,2,1]`. Every case advances independent worlds sequentially on one JS thread, with dt=1/60, 60 warmup steps and 120 measured steps. Existing numeric safety/rollback gates stay active. Dense body and inter-garment contact samples occur only at steps **0 and 180**, outside timing. Their first occurrence between those snapshots is unknown. Recorded coordinates being finite is not a garment-quality pass.

The starting snapshot already has a negative inter-garment sample. At step 180 the body minimum is -0.2503 mm and the inter-garment minimum is -4.7440 mm; maximum edge-length ratios are 1.5830 (top) and 2.0362 (bottom). These results belong to this component fixture, which skipped joint-fit initialization. They must not be presented as exact defects measured on the published R07/MP05 webpage.

All six cases completed with no numeric rollback. Mean step wall times in the two orders were 16.09/16.12 ms for one world, 33.69/33.27 ms for two, and 68.38/75.15 ms for four. The fourth-world reverse-order p95 increased to 115.71 ms; raw values are retained. These are CPU wall times, not rendered frame rates or a capacity guarantee for the user's machine.

`shoe-counts.mjs` runs the unchanged R14 `buildStyle` for four styles and records one-shoe triangle, part, group-draw and geometry-buffer counts. R14 force dynamics and wearer fitting are absent. Same-recipe resources can potentially be shared; this probe does not itself change rendering or material quality.

## Archive policy

The source directories and verification receipt are ignored by `.gitignore`; commit the small scripts, lock, instructions and measured JSON. The immutable source URLs remain the reproducible authority. The original upstream files are not edited by this archive.

See [README.md](README.md) for the minimal native matrix/rendering contracts and the explicit boundary between these component results and a complete shared-renderer NPC scene.
