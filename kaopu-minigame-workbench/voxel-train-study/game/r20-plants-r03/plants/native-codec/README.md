# Native Musa .KaoPu codec R04

This independent experimental profile is `kaopu.functional-plant-musa/0.1-experimental`, operator `PLANT_FUNCTION_MUSA_R04`, rule set `native-tropical78-musa`. It accepts only the audited native78 *Musa balbisiana*, seed 761014, establishing, sheltered, material wild-reference, root scale [1,1,1]. The retained r02 Ficus codec is separate and unchanged. The two readers reject one another.

`objects/establishing-musa.KaoPu` is a real 77,824-byte SQLite database, not renamed JSON. The independent Python SQLite reader verifies integrity, all five envelope tables (`header`, `records`, `links`, `fields`, `assets`), application ID `0x4B505531`, user version 1, typed graph digest, and the entire recipe JSON. No universal KAOPU or legacy reader compatibility is claimed.

## Scope and resource contract

The native profile is fixed:

```json
{"profileVersion":8,"tropicalLibraryVersion":76,"productionSystemVersion":78,"leafNaturalismVersion":73,"treeLeafVersion":75,"condition76":"normal","reproductive76":false,"species":"musa-balbisiana","seed":761014,"stage":"establishing","habitatForm":"sheltered","material":"wild-reference"}
```

The audited generation has 28 leaves, 64 axes, 4 pseudostems, 20,632 vertices, 36,330 triangles and 92 geometry records. These are Musa measurements, not inherited Ficus counts. The recipe stores none of this generated geometry.

Exactly six RGBA resources are admitted: support/albedo, support/normal, support/roughness, foliage/albedo, foliage/normal, foliage/roughness. They total 835,584 decoded pixel bytes. Every ID, dimension, colorSpace, byte count, SHA256, source kind, license and full Musa generator string is fixed. All six sources declare procedural CC0-1.0. No wood proxy pixels or Ficus resource records are accepted. Actual colorSpace values were captured from the original full native generation and included in `rules/native78-source-proof.json`; the initial budget probe did not record that field.

The SQLite recipe contains resource identities and provenance, not pixels, meshes, vertices, archives or saved animation frames. The deployment runs its pinned native author rules to regenerate the geometry and procedural PBR resources. Original acceptance remains surface pending review, visual pending user review, hardware unmeasured. File tests do not establish botanical, visual, placement, GPU or performance acceptance.

The default instance is `station-rear-establishing-musa`, position [-35.32316911636920, 0.081, -10.5] metres, yaw zero. The host task checked this position against its building-gap measurements; visual/user acceptance remains pending. Placement is bounded to 100,000 metres per axis, yaw to ±2π, and native wind strength to [0,1]. Only instance placement/ID/yaw and wind strength can vary; profile, units, metadata and dependencies remain exact.

## Browser interface

`codec.mjs` imports only the generated `template-data.mjs`. No SQLite engine, WASM, new package, network request, evaluation or incoming source-code execution is involved. WebCrypto requires HTTPS or localhost.

- `createPlantRecipe(options={})`: independent validated recipe; optional complete profile, partial instance and partial motion.
- `encode(recipe)`: deterministic real SQLite `Uint8Array`.
- `decode(Uint8Array|ArrayBuffer)`: validates and returns data without scene mutation.
- `decodeFile(File|Blob)`: checks the exact file size before allocating bytes.
- `verifyDependencyBytes(map)`: checks the actual loaded bytes of all seven deployment artifacts.
- `verifyResourceBytes(map)`: checks all six actual regenerated RGBA resources.
- `pinnedDependencies()`, `pinnedResources()`, `defaultProfile()`, `validateRecipe()` and `formatInfo` expose copied data or format information.

Motion is `{timeSource:'host.elapsed', timeUnit:'second', model:'native76', strength:0.25}`. The host drives the current clock; there is no stored animation timeline.

## Consumer sequence and worker boundary

1. Decode while keeping the current scene intact.
2. Read deployed artifacts through application-owned fixed paths and verify their loaded byte sizes/hashes. Never create an import URL from incoming recipe content.
3. Invoke the pinned Musa R04 operator, whose host integration owns the single-use module-worker contract. Verify regenerated native material bytes before installation.
4. Apply the permitted metre placement, Y-axis yaw and unchanged [1,1,1] root scale. Drive native wind from host elapsed seconds.
5. Atomically install only a fully validated candidate; dispose failed candidates and preserve the old instance on failure.

The codec itself does not construct a Worker, fetch modules, build a plant, dispose a scene or swap instances. Worker cancellation, transfers, shared-clone ownership and installation are tested by the separate host/rules tests. Byte verification alone does not prove a separately cached/executed module has the same bytes; the host must bind execution to the pinned release.

## Source-closure verification

Source HEAD is `d5f6ed0f41bdd6a4e4d1163190d3cd2135e8b122`. `source.closureSha256` hashes the exact source-closure manifest file, independently from deployment bundle hashes.

The builder checks every one of the 92 closure inputs against its actual local source file: existence, file length and SHA256. It rejects a changed but correctly formatted digest, same-size source mutation, missing files, duplicate inputs, omitted inputs, unknown source classes, absolute/traversal paths and symlinks escaping their declared roots. This is not merely hash-string validation.

Build-only `sourceRoots` resolve canonical files in the recovered original checkout, adapter and npm inputs in the original probe workspace, and the transformed input in `rules/build-inputs`. No source-root paths enter recipes or browser manifests. The guarded Musa slice changes only the unused `BARK_DATA76` table to an empty array. The builder checks both the exact landed `BarkData76.musa.ts` bytes and a fresh deterministic transformation of the original bytes, preserving CRLF. An arbitrary transformed file with a newly matching hash is rejected.

The source closure's bundle name, byte count and SHA256 must match the actual mother-author dependency. This author source closure does not claim to enumerate the separate renderer's transitive inputs; renderer and operator deployment bytes are pinned separately. The builder fixes the audited closure and proof digests in addition to the six exact resource records, profile, seven dependency identities/versions and release ID. Updating an audited closure/proof is an explicit code review, not a silent repin.

## Fixed-layout safety

The fixed SQLite/BLOB-fragment mechanism retains the FH88 R04 envelope technique with a distinct Musa layout ID and marker. JavaScript writes only nine exact physical BLOB fragments and one SHA256 field. All other bytes, including schema, graph, headers, page layout and overflow pointers, must equal the compiled template. The padded 32,768-byte payload must be canonical JSON followed only by spaces.

Unknown keys, different profile/species/stage/seed, changed metadata or pins, arbitrary code/URL/mesh/pixel/sample fields, nonfinite numbers, invalid prototypes, prototype-pollution keys, getters, symbols, nonenumerable properties, sparse/extended arrays, duplicate JSON fields, noncanonical payloads, oversized files and corrupt bytes are rejected. Inputs are snapshotted before asynchronous hashing, including Node Buffer inputs. SHA256 detects corruption/mismatch; it is not author authentication.

## Build and tests

`release-input.json` is build-only. It has releaseId, sourceHead, sourceClosure, sourceRoots, dependencies, resourceProof and the six resources. All pins are verified against readable real files before outputs change. No dependency hash is invented or updated by the builder.

```sh
python build_template.py
node tests/test-codec.mjs
python tests/verify_sqlite.py
python tests/test_builder.py
```

Outputs include the establishing-Musa and placement-roundtrip SQLite fixtures, their full expected JSON, and three test reports. The current Node suite has 48 checks: 47 passed; the optional historical FH88 fixture test is skipped unless `KAOPU_FH88_CODEC` is provided. The retained r02 Ficus mutual-rejection test is mandatory and passed. Both independent SQLite fixtures passed. The builder suite has 46 passing negative checks plus the valid 92-source-input and exact-transform verification. Historical rail reader execution is optional via `KAOPU_RAIL_CODEC` and is not claimed when unavailable.

The original mother workbench, its runtime, the retained r02 candidate and unrelated projects are not changed by this codec adaptation. No browser, GitHub upload or publication is part of these tests.
