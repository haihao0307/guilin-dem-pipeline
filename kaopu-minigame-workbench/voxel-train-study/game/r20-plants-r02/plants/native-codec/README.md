# Native plant .KaoPu codec R01

This is an independent experimental plant profile, `kaopu.functional-plant/0.1-experimental`, with operator `PLANT_FUNCTION_R04` and rule set `native-tropical78-ficus`. It is not FH88 driving settings and does not claim a universal KAOPU standard or compatibility with existing readers.

The .KaoPu file is a real SQLite database, not JSON with a renamed extension. The five existing envelope tables (`header`, `records`, `links`, `fields`, `assets`), application ID `0x4B505531`, user version `1`, and typed graph digest convention are retained. `objects/young-ficus.KaoPu` is 77,824 bytes and has passed native Python SQLite `integrity_check`.

## Small browser interface

Import `codec.mjs`; it imports only generated `template-data.mjs`. No new packages, SQLite engine, WASM, network, evaluation, or source code supplied in the imported file is used. WebCrypto requires HTTPS or localhost.

- `createPlantRecipe(options = {})` returns independent, validated data. Options may supply a complete `profile`, partial `instance`, or partial `motion`.
- `encode(recipe)` returns `Promise<Uint8Array>` containing SQLite bytes.
- `decode(Uint8Array | ArrayBuffer)` returns a validated recipe, without touching a scene.
- `decodeFile(File | Blob)` checks exact size before allocation, then decodes. Names and MIME types confer no trust.
- `verifyDependencyBytes({ [id]: Uint8Array | ArrayBuffer })` checks each actual release artifact's byte count and SHA256.
- `pinnedDependencies()` returns `{id, version, sha256, bytes}[]`, without filesystem paths or download URLs.
- `verifyResourceBytes({ [resourceId]: Uint8Array | ArrayBuffer })` checks all eight generated native RGBA resources before installation.
- `pinnedResources()`, `defaultProfile()`, `validateRecipe(recipe)`, and `formatInfo` are also available.

`recipe.profile` is the complete original Profile76. It is deliberately not `recipe.parameters.profile`. `recipe.instance` has `id`, `positionM`, and `yawRadians`. `recipe.units` is `{length: 'metre', up: 'Y_UP', rootScale: [1,1,1]}`. `recipe.motion` is `{timeSource: 'host.elapsed', timeUnit: 'second', model: 'native76', strength: 0.25}`. There are no saved animation frames or hidden per-frame sample arrays.

The one admitted profile is:

```json
{"profileVersion":8,"tropicalLibraryVersion":76,"productionSystemVersion":78,"leafNaturalismVersion":73,"treeLeafVersion":75,"condition76":"normal","reproductive76":false,"species":"ficus-microcarpa","seed":761014,"stage":"juvenile","habitatForm":"sheltered","material":"wild-reference"}
```

The default instance is `station-rear-young-ficus` at `[-56.2, 0.081, -9]` metres, yaw zero. The original full native generation uses `generateTropical78(profile, {compactBlades76: true})`. This release does not admit other seeds, habitats, adult trees or untested source versions. Placement is bounded to 100,000 metres per axis, yaw to ±2π radians, native wind strength to [0,1], and scale must stay [1,1,1].

## Safe consumer sequence

1. Read the file using `decodeFile`; keep the current plant in place.
2. Use an application-owned, fixed path mapping to read the deployed artifacts and call `verifyDependencyBytes`. Never construct an import URL from incoming recipe data. This function verifies supplied bytes; it does not fetch or promise that a separately cached/executed module is identical. The host must bind execution to the same pinned release and handle cache/version changes.
3. Build a candidate from `recipe.profile` using the trusted pinned operator. During construction pass `verifyResourceBytes` to validate the actual native resources.
4. Apply metre position, Y-axis yaw and root scale [1,1,1]. Drive native motion from the current host clock in seconds.
5. Install the new candidate only after all construction and verification succeed; atomically replace/dispose the previous plant. Dispose the rejected candidate on failure, leaving the previous plant intact.

The codec itself never executes this sequence and never mutates a scene. It validates and returns data only.

## Images, assets and provenance

The recipe contains resource identities, dimensions, SHA256s and source/licence metadata, but no meshes, vertices, pixel buffers, archives or animation samples. This does **not** mean the native plant is image-free. Its pinned rules include the original compressed `japanese_camphor_bark` proxy pixel tables and generate the native procedural resources. There are eight material resources totaling 2,932,736 decoded RGBA bytes. The two bark resources retain the original declared CC0-1.0 source at https://polyhaven.com/a/japanese_camphor_bark; the procedural support and foliage resources also retain their original CC0 declarations. The declaration is recorded from the supplied native proof, not independently re-licensed here.

Source head is `d5f6ed0f41bdd6a4e4d1163190d3cd2135e8b122`. `source.closureSha256` means SHA256 of the exact pinned source-closure manifest file bytes, not the deployment bundle hash. Those separate bundle hashes are in `dependencies`. The current final closure has 92 inputs; this does not assert that it alone enumerates the separate renderer's closure. Author, renderer, operator and both Three modules are pinned separately.

Surface acceptance remains pending review, visual acceptance pending user review. File correctness is not an assertion of botanical, visual, GPU or performance acceptance.

## Fixed-layout validation and safety

The Python builder uses the proven FH88 R04 fixed SQLite template / physical BLOB-fragment mechanism. The JavaScript writer changes only nine exact physical BLOB fragments and their one SHA256 field. The decoder compares every other byte to the compiled template, thereby rejecting changed schema, links, graph, fields, headers, overflow pointers and page layout. It then verifies the entire padded 32,768-byte payload and requires canonical JSON plus spaces. The independent Python verifier also recomputes the typed graph digest from SQL query results and checks full JSON equality against the expected file.

Unknown fields, unknown or changed dependency/resource pins, arbitrary URL/code/mesh/vertex/pixel fields, unsupported profile versions/seeds, nonfinite values, invalid object prototypes, prototype-pollution keys, getters, nonenumerable/symbol properties, sparse/extended arrays, duplicate JSON keys, noncanonical payloads, oversized input and corrupt bytes are rejected. Read-only provenance URLs are exact fixed metadata, never evaluated or fetched. Input buffers are snapshotted before asynchronous verification, including Node Buffer inputs.

SHA256 detects corruption and mismatch; it does not authenticate the author. This reader accepts only this release's exact layout and pins. A valid SQLite database rewritten with VACUUM or another SQLite library can still be incompatible. A dependency change intentionally requires rebuilding the template and object; silently loading a mismatched release is disallowed.

## Build and verify

`release-input.json` is a build-only explicit pin list supplied by the release owner. It contains:

- `sourceHead`
- `sourceClosure: {sha256, localPath}`
- `dependencies: [{id, version, sha256, localPath}]`
- `resourceProof: {sha256, localPath}`
- `resources`: the eight exact resource records from the pinned native proof
- Optional `releaseId`, default `native-tropical78-ficus-r01`

All hashes must match real readable artifacts before any template output is changed. Placeholders, missing files, missing pins and mismatches fail closed. Paths may be absolute for local builds, or relative to the input JSON. They are not placed in the recipe or browser manifest. Do not publish build-only local paths as user documentation.

```sh
python build_template.py
node tests/test-codec.mjs
python tests/verify_sqlite.py
python tests/test_builder.py
```

The Node test writes `objects/young-ficus.KaoPu`, a placement roundtrip fixture, their full expected JSON, and `JS_TEST_RESULTS.json`. It uses the exact installed native author bundle to check all eight generated resource hashes. Python reports are `SQLITE_TEST_RESULTS.json` and `BUILDER_TEST_RESULTS.json`. Tests do not require a browser and make no claims about live scene rendering; the host's scene integration is tested separately.

## Compatibility boundary

- FH88 R04 driving recipe readers remain unchanged and reject this plant envelope. This plant decoder rejects FH88 fixtures.
- The historical `kaopu.functional-rail/0.1-draft` reader rejects the distinct plant asset role/profile; its original image-free condition must not be relaxed or claimed for this plant.
- Old desktop PNG/image readers do not implement this profile.
- The original FH88 codec, rail reader, mother workbench and unrelated project files are not edited by this extension.
