# R07 exact source codec and loader evidence

Task: FISH_MATH_MEMORY_PERFORMANCE_R07_20261003. This lane changes storage and load ownership only. It does not create a replacement fish shape, simplify samples, edit material/sampler/eye metadata, alter animation or resample any image.

## FSP7 version 1 layout

The outer carrier is gzip. Uncompressed bytes begin with ASCII FSP7, little-endian uint32 version 1, UTF8 header byte length and combined numeric/image block length (16 bytes total). UTF8 JSON follows and is padded to 8-byte alignment. Header schema FSP7_TYPED_SOURCE_1 contains score, blocks and images. Numeric block descriptors contain primitive, field, type, length and offset relative to storage. Image descriptors contain texture, original data URI prefix, length and offset. Images are the original encoded image bytes, not recompressed images. Header metadata textures retain their original property order with uri:null until restored on the main thread.

| Field | Stored type | Equivalence |
| --- | --- | --- |
| positions, normals, uvs, finWeight, finGradient | Float32 | Exact R06 upload bytes |
| indices, finId | Uint32 | Exact R06 integer bytes |
| base, paramAddress, residual | Float64 | Exact original JSON number Float64 bits |
| coefficients, rig, eyes, materials, sampler, source provenance, other metadata | JSON UTF8 | All original values retained |
| texture encoded payload | Uint8 view | Every original encoded byte retained |

The codec returns {score,format,images}. Before worker transfer, no URI getter exists: structuredClone would eagerly expand getters into large strings. The main loader restores an enumerable lazy original uri getter plus nonenumerable encodedBytes. Existing numeric texture.bytes metadata and MIME fields remain unchanged. Material loading must prefer Blob([texture.encodedBytes],{type:texture.mimeType}); the R06 URI path remains available. URI access reconstructs the exact original string only for source diagnostics and is not cached. Neither worker transfer nor production texture upload constructs base64 image strings.

All numeric and image views share one numeric/image ArrayBuffer. Decoder copies only the numeric/image region out of decompressed source, so the transferred storage retains no UTF8 header or giant JSON number lists. Actual CPU Worker proof confirms one transferred buffer, sender detachment and uri:null before transfer. Normal worker termination after successful delivery or failure releases compressed bytes, decompressed bytes, header text and local metadata; cancellation terminates the worker immediately.

## Manifest and integration

Use data/r07/registry.json items.file (relative to data/) instead of original items.file. Each new carrier has format:FSP7_GZIP, bytes and its own compressed sha256. sourceScoreSha identifies the immutable original JSON gzip; it must never be confused with the new carrier hash. metadataFile continues to name the original untouched metadata. Online and inline carriers should expose data-format=FSP7_GZIP. Decoder explicitly returns R06_JSON_GZIP for an old JSON carrier and rejects a carrier/format mismatch or unknown magic; there is no silent fallback.

createSourceLoader().load(id,{signal}={}) remains compatible with load(id). Optional signal belongs to the initial pending job; another load of the same active id reuses that promise. releaseExcept(id) synchronously cancels all other jobs and drops other decoded cache entries. cancelPendingExcept(id) cancels jobs while retaining current cache for a scene still on screen. clear() rejects pending jobs with AbortError and releases all loader cache references. dispose() additionally revokes the worker Blob URL and disallows future loads. stats()/stat() expose cachedIds, pendingIds, pendingTokens, workers, typedBytes, numericBytes, encodedImageBytes, formats, decoded, cancelled and disposed. typedBytes includes images and any alignment padding; it excludes JS metadata and all app/GPU allocations.

At selection start, call cancelPendingExcept(id); after a committed first frame, call releaseExcept(id). On legacy barracuda commit, clear() or releaseExcept('barracuda') leaves no five-source cache. The app must separately dispose abandoned geometries/materials/textures. readCarrierBytes uses the per-job AbortSignal and token guards before worker creation/resolve/cache insertion; obsolete same-id fetch cleanup cannot delete a new job. No cache stores pending promises after completion and no decoder Worker stays alive after transfer.

## Measured sizes and CPU evidence

All bytes below are actual; heap values are a single isolated Node --expose-gc sample, not browser/GPU guarantees.

| Species | R06 gzip | FSP7 gzip | JSON header | Numeric | Encoded images | Retained JS heap R06 → R07 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| herring | 2206335 | 1961191 | 22258 | 606288 | 1624011 | 7617576 → 5345568 |
| tuna-yellow-label | 47361706 | 46604961 | 36227 | 633224 | 46219248 | 67124120 → 5414640 |
| tuna-blue-label | 513438 | 419111 | 28948 | 254376 | 259930 | 5753552 → 5355096 |
| colorful | 2216243 | 1778603 | 28156 | 1075832 | 1037883 | 6967976 → 5938336 |
| picasso | 1440448 | 987487 | 14436 | 1236512 | 252304 | 5955096 → 5330056 |

Total gzip 53738170 → 51751353 bytes, saving 1986817 (3.70%). Large yellow-tuna images are already six lossless-pixel-verified WebP images at 4096×4096, totaling 46,219,248 encoded bytes. Removing base64 from its header reduces header bytes from 61,661,512 (first FSP7 numeric-only experiment) to 36,227. Original JPEG/WebP encoding, dimensions, sampler, provenance and preexisting source pixel hashes remain exact. There is no original GLB or extra full geometry string inside the source header and no unknown primitive number arrays; source-sampled base/chart/residual intentionally remain because their exact Float64 proof is required.

EXACT_PRESERVATION_PROOF.json contains per-field bytes and SHA, complete metadata equality, source URI/encoded-payload equality, exact procedural reconstructed Float32 equality, unchanged original gzip SHA, field size inventory, deterministic cancellation/retry/failure tests, explicit format rejection tests, actual serialized Worker decode/transfer proof and isolated Node time/heap/RSS measurements. TEXTURE_AND_HEADER_INVENTORY.json records original field sizes and texture payload hashes. The pack command is: node --expose-gc fish-five-r01/scripts/pack-sources-r07.mjs. It writes only data/r07 and never alters original source files.

## Remaining acceptance gates

- [x] No generated image or static replacement for the actual workbench.
- [x] Production codec and loader source actually changed.
- [ ] Interactive real-time workbench integration and browser equivalence: parent/verifier lane.
- [ ] Public final HTTPS/version/resources/browser proof: parent lane.
- [ ] User visualAcceptance and productionReady remain false.

CPU representation PASS does not approve appearance, GPU behavior or public release. No GPU/browser, commit, build or publication was performed by this lane.
