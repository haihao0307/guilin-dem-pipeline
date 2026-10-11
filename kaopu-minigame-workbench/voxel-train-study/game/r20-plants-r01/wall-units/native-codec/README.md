# Wall-only experimental SQLite.KaoPu codec

This is a real SQLite container for original procedural wall-unit scores. It is an independent experimental profile, **kaopu.functional-wall/0.1-experimental**, and does not claim compatibility with general KaoPu files, plant recipes, rail driving files, or desktop image readers.

The file is not JSON with a changed extension. Standard Python SQLite opens the five tables (`header`, `records`, `links`, `fields`, `assets`) and returns `ok` from `PRAGMA integrity_check`.

## Public API

- `encode(partialOrCompleteWallScore)` asynchronously returns a `Uint8Array` containing actual SQLite bytes. It reuses `../wall-score.mjs`'s `normalizeWallScore` and stores the complete `canonicalWallScore`.
- `decode(Uint8Array | ArrayBuffer)` asynchronously returns the full normalized wall score. No source fetching, code execution, object generation, or scene changes occur.
- `decodeFile(File | Blob)` checks the exact size before reading.
- `validateScoreData(fullScore)` checks JSON safety and the same domain schema the wall generator uses. Missing default fields are not allowed in a decoded score.
- `pinnedDependencies()` returns a copy of the release dependency identifiers, versions, sizes and SHA256 pins.
- `verifyDependencyBytes({dependencyId: alreadyLoadedBytes})` checks trusted host module bytes. It never fetches paths or URLs from incoming files. It refuses an unbound development template.
- `formatInfo` describes the narrow format and verification status.

The wall material integration additionally requires injected materials to report `sourceRevision` / `street.revision` equal to `KST1-surfaces-2` before committing a restore candidate. This requirement is exposed as `formatInfo.requiredHostMaterialRevision` and stored in the immutable envelope. A revision token is a compatibility gate, not a cryptographic proof of the external material library. The dependency pins cover six standalone wall source modules plus the exact original host `street/materials.mjs` bytes. The host must supply that already-trusted material factory and the matching bytes. The renderer is separately trusted. None of these modules is loaded from the score. This module does not adopt the old whole-building street schema.

The score schema is `kaopu.street.wall-unit/1`, its public host operator is `kaopu.street.wall-unit`, and the envelope's fixed allowlisted operator is `WALL_UNIT_FUNCTION_R01`. The current kinds are `plaster-window`, `tile-door`, and `cage-window`. A file cannot select another operator or supply source code.

## Contents and integrity

The SQLite layout is generated once by `build_template.py` using standard-library `sqlite3`. Browser encoding changes only a reserved 16 KiB BLOB and its checksum text fields. All other bytes must match the trusted generated template. In particular, SQLite schema, SQL text, rows, links, graph metadata, operator, resource list and dependency pins are immutable.

- The unique asset is `functional_wall_score`, with MIME `application/json`.
- Its data is the canonical full score in UTF-8, padded with ASCII spaces to 16 KiB.
- CRC32 (IEEE) and SHA256 cover the entire padded BLOB.
- `graph_sha256` covers `records`, `links`, and `fields`, in that order, each table name followed by rows ordered by the first column. Each cell has a type tag (`n`, `b`, `i`, `s`), an unsigned little-endian 64-bit byte length, and its bytes. Integer cell data is signed little-endian 64-bit.
- The generated layout records the SHA256 of the entire template and all physical BLOB fragments.
- Incoming JSON with duplicate/noncanonical keys, unknown score fields, unsupported profile data, getters, prototype keys, executable values, nonfinite numbers, mesh/texture/code/URL payloads, or invalid domain values is rejected.

CRC32 and SHA256 detect corruption and consistency problems. **They are not author authentication or a signature.** An actor who knows the format can create another valid, permitted wall score. A valid score's acceptance does not authorize arbitrary external data, resources or code.

No geometry, pixel texture, executable source, animation samples, plant resource, or plant executor is stored. The trusted host reconstructs a wall from the data score and its already-approved local implementation. Host integration should verify release dependency bytes before regeneration, construct a candidate, and replace the live object only after all validation and generation succeed.

This fixed profile deliberately rejects otherwise valid SQLite files that have been rewritten (for example by `VACUUM`) or contain extra tables. Edit the score through the codec rather than editing the database with an arbitrary SQL tool.

## Building release pins

This release is pinned to seven verified local source files (six wall modules and the original host materials implementation). An initial integration template can explicitly say `unbound-development`; that is not a production dependency verification claim and `verifyDependencyBytes` refuses it. Once the source modules are final, prepare a JSON array with each dependency's `id`, `version`, exact `sha256`, and builder-local `localPath`. Run:

    python native-codec/build_template.py --dependencies native-codec/release-input.json

The builder verifies every input hash and size before replacing output files. Only id/version/size/hash are embedded, never local paths. Keep those hashes in this generated envelope, not in the main source modules, to avoid circular source hashes. Rebuild the three `.KaoPu` files when dependency pins change, using the final author-supplied JSON array:

    node native-codec/write_samples.mjs --input native-codec/samples-input.json

Each sample is stored at its own local origin, independently of any host QA display arrangement. The pin set covers the wall functional module closure and the host material implementation. The host's existing renderer is separately trusted rather than loaded from the recipe. Running the builder without arguments uses `release-input.json` when present, and does not silently downgrade this release to an unbound template.

`template.sqlite` is the build template containing marker bytes, not a usable wall recipe. Use `encode` or the packaged sample files for actual scores.

## Verification

    node native-codec/tests/test-codec.mjs
    python native-codec/tests/test_builder.py
    WALL_HOST_GAME_ROOT=/absolute/path/to/game/r20-plants-r01 node --test native-codec/tests/test-restore.mjs
    python native-codec/tests/verify_sqlite.py native-codec/samples/*.KaoPu

The Node suite covers all three kinds, shared score normalization, deterministic encoding, File/Blob handling, independent SQLite reads, immutable graph bytes, checksum damage, truncation, renamed JSON, rehashed invalid inputs, unsupported resources/operators, JSON safety and asynchronous input mutation. The Python suites independently recompute the graph/BLOB digests and exercise local dependency pin checks. The integration suite invokes the production `wall-native.mjs` load/replace/three-object fixture APIs with the actual sample files through the existing real Three/KST1 host, compares geometry digests, checks closed-door restoration, and demonstrates atomic replacement that leaves the old scene object intact on corruption or generation failure. This is CPU, geometry and shader-hook evidence, not GPU shader compilation or visual acceptance. No software downloads or package installs are required.
