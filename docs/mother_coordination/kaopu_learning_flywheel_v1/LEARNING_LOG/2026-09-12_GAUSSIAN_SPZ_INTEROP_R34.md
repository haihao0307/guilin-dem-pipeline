# KAOPU learning cycle R34 — real SPZ v4 to Three.js r186 CPU interoperability

Date: 2026-09-12  
Status: **Candidate partial**  
Production Mother mutation: **none**  
Frozen R1 mutation: **none**

## Highest-value bounded question

Can R33's constrained `SPZ v4 + default RUB + no extension + SH<=3` profile survive an actual pinned Niantic encoder/unpacker to actual Three.js r186 loader handoff, and which fail-closed checks remain necessary before a real-photo pilot?

This question was selected after reading coordinator HEAD `7c32766b64c64a98878c1d5daaef89ded9323948` and the 2026-09-12 Mother meeting review. That review correctly limited R33: only two R33 checks had executed real Three loader paths, the simplified declaration check missed invalid types, and no real SPZ v4 encoder had run. No original Mother supplied a new acknowledgement; this cycle applies the meeting feedback without claiming Mother adoption.

## Source locks and evidence relation

- Niantic SPZ: `affd0ecea7fbb4c265ee119475af7ee5b2997482`.
- Three.js r186: `148ef33ecb6d2502ff796d4554abd1549c95d519`, package `0.186.0`.
- Full lock: `references/gaussian-spz-interop-r34/SOURCE_LOCK.json`.

The two repositories are distinct primary software roots but one dependent interchange chain. Their agreement is interoperability evidence, not independent physical observation. The executable probe is derived engineering evidence. The temporary AI meeting reviews were candidate critique, not Observation Roots.

## Executed fixture

The C++ harness compiled the pinned Niantic `load-spz.cc`, `splat-c-types.cc` and `splat-types.cc`, linked the available zlib and libzstd runtimes, and generated two actual SPZ v4 files:

1. A two-splat positive fixture with distinct positions, anisotropic log-scales, non-trivial `xyzw` rotations, opacity/DC differences and non-zero SH1–SH3. Input coordinates were RDF; the packer stored the default RUB representation.
2. A one-splat negative fixture with position `x=2048` stored units at 12 fractional bits and log-scales `-11`, `6`, `0`.

The actual Niantic unpacker produced the reference decoded attribute arrays. The actual asynchronous Three.js r186 `SPZLoader.parse()` loaded both files. The run was repeated from the committed runner and produced byte-identical fixture hashes and result JSON.

## Observation

### O-R34-1 — constrained positive interop passed

The real Niantic v4 encoder output was accepted by the real r186 loader. The positive fixture matched as follows:

- RDF input arrived as the expected default RUB centers; maximum difference from Niantic's own unpacker was `6.250000517127319e-10` stored units.
- Three covariance matched covariance independently reconstructed from Niantic-unpacked log-scales and `xyzw` quaternions with maximum absolute error `1.0828237373416982e-7`.
- Three exposed exactly SH1, SH2 and SH3. Every packed SH byte matched the bytes reconstructed from Niantic's unpacked coefficients; maximum byte error was `0`.
- The file header declared v4, SH3, six streams, fractionalBits 12 and no extension flag.

This closes the narrow synthetic CPU interoperability gap identified by the meeting. It does not validate photos, COLMAP, Brush, a GPU renderer or a device.

### O-R34-2 — parser success does not prove envelope integrity

The actual pinned r186 loader accepted both:

- the positive file with its final byte removed; and
- the same file with one trailing byte appended.

The loader's v4 path reads the TOC and slices the declared streams, but it does not first require the sum of compressed stream lengths to equal the input byte length. In this fixture, the ZSTD decoder still returned data after one-byte truncation. Therefore `await SPZLoader.parse()` success is not sufficient evidence that the delivered byte envelope is complete or canonical.

The R34 candidate gate rejected both negative controls with `compressed-streams-do-not-exactly-cover-file`. This is a fail-closed delivery check, not a claim that every corrupt ZSTD stream can be diagnosed without decompression or hashing.

### O-R34-3 — real packer confirms destructive out-of-range behavior

The pinned Niantic packer accepted the negative fixture rather than rejecting it:

- position `2048` decoded as `-2048` stored units because the rounded fixed-point integer was emitted through its low 24 bits;
- log-scale `-11` decoded as `-10`;
- log-scale `6` decoded as `5.9375`.

This upgrades the meeting's toy int24 wrap and ideal saturation calculations to actual pinned-encoder evidence for these exact inputs. It does **not** show that normal in-range reconstructions are faulty. It shows that pre-pack range/type validation is mandatory because a valid post-pack file can already have lost source intent.

### O-R34-4 — quantization remains lossy even in the positive fixture

The positive fixture's maximum position change from the float source was `0.00012114062500001577` stored units, within the theoretical half-step `0.0001220703125`. This remains a stored-unit result. It is not a millimetre or reconstruction-accuracy statement without an explicit positive finite `metersPerStoredUnit` derived from a validated scale anchor.

## Candidate

### C-R34-1 — two-stage SPZ ingress/delivery gate

Before packing:

- require finite typed attributes and normalized valid quaternions;
- require positions to fit the rounded signed-int24 domain for the chosen fractional bits;
- reject or explicitly budget log-scale saturation;
- require a positive finite `metersPerStoredUnit` only when metric claims are intended;
- preserve the float reconstruction checkpoint and its hash.

After packing, before viewer decode:

- require a typed declaration: SPZ, version 4, RUB, no extension, integer SH degree 0–3 and positive finite unit declaration;
- compare declaration with the binary header;
- validate TOC bounds, expected stream count and uncompressed sizes;
- require compressed streams to cover the file exactly, excluding truncation and trailing bytes;
- bind the file to a cryptographic hash;
- await the actual loader, then compare decoded semantic attributes with the float/unpacked checkpoint under channel-specific budgets.

Candidate adapter: `ADAPTERS/gaussian_spz_delivery_gate_r34.mjs`.

## Rejected

- **Rejected:** “If Three.js parses it, the file is complete and canonical.” The one-byte truncation and trailing-byte controls are counterexamples.
- **Rejected:** “A post-pack header/TOC gate can detect all destructive source values.” The actual packer produced structurally valid bytes after position wrap and scale saturation.
- **Rejected:** “The half-step position bound is a real-world metric reconstruction bound.” It excludes scale-anchor, camera, training, cleanup and renderer error.
- **Rejected:** “This CPU pass proves RealityScan can be retired.” No photo reconstruction or user acceptance occurred.

## Current Best View

The R33 safe candidate profile is now supported by one reproducible synthetic encoder-to-viewer CPU fixture, but only when surrounded by explicit pre-pack source validation, post-pack envelope validation, awaited decode and semantic comparison. SPZ remains a lossy delivery derivative; the float checkpoint and upstream evidence remain authoritative for error analysis.

## Frozen

- Formal R1 remains frozen and unchanged.
- No production Mother branch or asset changed.
- No external source was adopted as KAOPU core architecture.
- RealityScan remains available; no new Mother was created.

## Unknown

- No user photo set is available.
- COLMAP pose solving, registration/reprojection quality and metric anchoring are untested.
- Brush training, cleanup and PLY export are untested.
- RGBA equivalence was not promoted in this cycle; the primary new positive comparisons are center, covariance and SH1–SH3.
- GPU sorting/rendering, load time, peak memory, frame time, Safari/iPhone behavior and human visual acceptance remain untested.
- The candidate gate has not been integrated or acknowledged by an actual Mother.

## Result and routing

- Probe result: `PROBES/gaussian_spz_three_interop_result_r34.json` — 12/12 checks passed.
- Tool routing: `TOOL_ROUTING_R34_GAUSSIAN_SPZ_INTEROP.json`.
- Mother routing: `MOTHER_ROUTING_R34_GAUSSIAN_SPZ_INTEROP.json` — prepared, all feedback null and acknowledgements false.

The next promotion gate is still one small static-object real-photo pilot after a user dataset exists. It must preserve source photos, pose solution, float checkpoint and cleanup history; report pre-pack rejection counts, pack/unpack attribute and fixed-view image errors; then separately test the target macOS and 390x844 iPhone/Safari runtime and human acceptance. It must not alter production assets or retire RealityScan beforehand.
