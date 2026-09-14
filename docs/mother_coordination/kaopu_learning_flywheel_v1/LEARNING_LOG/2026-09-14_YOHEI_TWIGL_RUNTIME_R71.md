# KAOPU learning log — R71 Yohei twigl fixed-runtime boundary

Date: 2026-09-14  
Question: What do the exact compact source, a componentwise-expanded kernel, and an explicitly initialized reinterpretation produce in one fixed software WebGL2 runtime?  
Status: **Candidate partial**. One revision-pinned executable condition passed; portability and author-recording identity remain Unknown.

## Inherited state and scope

R70 locked the author-linked 265-byte source fingerprint and mode 7, while leaving generated program, undefined state and pixels unresolved. The later expert geometry note at commit `a8d5b3c7c77a6a80f853121ce4a15e40761b9d1c` was read before execution and remains a separate Candidate theoretical record; it does not supply original shader pixels or alter this test.

This round advances only R70's declared runtime gate. It does not repeat the expert meeting, recreate the artwork, change geometry/material truth, or authorize production use.

## Locked executable condition

- Author snapshot source SHA-256: `5253b2a44baa9f99af79cd04d85747ac6bb515c021562c7558e841446a4c3fea`; mode `7`.
- Historical twigl commit: `969491b285ba217fd895132a466ee6b3128243f3`.
- `src/fragmen.js` Git blob: `8fdee9a542b31cc2e3f9a106885c9f529f3c05c9`; noise Git blob: `37f731ca606ca3d0998e5bc366b9c478246d13b2`.
- The exact compact fully preprocessed fragment is 9,038 UTF-8 bytes, SHA-256 `c11c4581f7e207f87563482dcb401abd6a3a85502f7d4e8a9e78846c150ffda8`.
- Chromium `143.0.7499.4`, ANGLE/Vulkan SwiftShader, WebGL 2 / GLSL ES 3.00, `32 x 32` RGBA32F target, followed by the historical one-to-one twigl post pass to default RGBA8.
- Fixed times: `0`, `1.25`, `7.5`. Four programs were compared: exact compact with undefined state, componentwise-expanded kernel with undefined state, exact compact with explicit zero seeds, and expanded kernel with the same seeds.
- Explicit reinterpretation seeds only `i/e/R/q/o` to zero. `p` and `s` remain assigned before first read. It is deliberately not called the author original.

The runner fetches the public source during CI, verifies its fingerprint, and emits no raw artwork source or preprocessed program.

## Observation

Workflow run [34840361289](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/34840361289) passed all source, wrapper, transform, compile/link, readback and source-free gates.

For each of the three times, all four programs produced identical RGBA32F hashes and identical RGBA8 hashes. That is `3 x 4,096` float channels per pairwise comparison, all finite. Observed float ranges were:

- `t=0`: `0.1909019649 ... 1.0024803877`;
- `t=1.25`: `0.1522829086 ... 1.0643767118`;
- `t=7.5`: `0.2129597217 ... 0.8987309337`.

The explicitly initialized program repeated bit-for-bit at `t=1.25`. Changing the float framebuffer clear from zero to `[0.75, 0.125, 0.5, 1]` did not change the compact undefined program's float or byte hash.

These are implementation observations inside one Chromium/SwiftShader evidence lineage. They are not observations of the author's recording GPU or a second independent physical root.

## Candidate interpretation

In this locked implementation, the undefined locals/output behave indistinguishably from the declared zero seeds for this shader and fixture. This makes the zero-seeded version a useful deterministic **reference reinterpretation** for subsequent differential probes in the same lineage.

The componentwise expansion of the one trigonometric dot term was also bit-exact in both undefined and initialized pairs at all three times. This supports using that expanded form for inspection in this revision-pinned fixture, but not as a universal compiler/GPU equivalence claim.

The clear-color control strengthens the narrower conclusion that framebuffer clear did not supply the observed local/output values in this run. Normatively, [GLSL ES 3.00 revision 6](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf) still classifies reads before writing as undefined; a stable implementation result cannot replace that contract.

## Current Best View

**Observation:** exact source/wrapper/noise identities; fully preprocessed program hashes; successful compilation and 14 fixed-runtime readbacks; bit-equal compact/expanded/zero-seeded outputs in the locked software renderer; clear-color independence; finite ranges.

**Candidate:** use the zero-seeded compact/expanded pair as a deterministic differential reference in this exact runtime, always labeled a reinterpretation.

**Frozen:** KAOPU Canonical Truth and Frozen R1.

**Rejected:**

- SwiftShader equality proves GLSL or twigl zero-initializes these variables.
- Compact/expanded equality in one compiler proves cross-compiler or cross-GPU bit identity.
- Compilation and finite pixels prove the author's recorded pixels, physical realism, geometry, material truth or visual acceptance.

**Unknown:** author-recording browser/GPU/compiler/pixels; hardware GPU; Safari/iPhone; other WebGL compilers; visual acceptance; artwork reuse permission; Mother adoption.

## Observation roots and failure modes

- `OR-AUTHOR-PUBLICATION` / `OR-TWIGL-SERVICE`: inherited source and mode identity.
- `OR-TWIGL-REPOSITORY`: historical wrapper/noise and render contract.
- `OR-R71-CHROMIUM-SWIFTSHADER`: one new executable condition, not a physical or cross-device root.
- `OR-KHRONOS-GLSL-ES-300`: normative undefined-state boundary.
- R71 hashes are derivations from these roots; repeated programs in one process are controls, not independent evidence roots.

Transferable failure mode: deterministic undefined behavior can perfectly imitate an explicit seed on one implementation. Differential equivalence should therefore be run on an explicitly seeded variant, while the exact undefined original is retained only as a provenance/control case.

## Routing and next gap

Prepared for Renderer / Three.js Mother and Landscape / Tile / Brick / Stone Mothers; no acknowledgment or adoption is claimed. For any authorized follow-up, keep exact compact, expanded, and seeded reinterpretation identities separate and require runtime identity plus float/byte hashes.

Next bounded gate: run the same source-free four-program matrix on a genuinely different WebGL implementation or hardware GPU. A second Chromium process or another SwiftShader flag is not independent enough. If unavailable, do not repeat this result or infer portability.

Gaussian R66 remains queued and is not superseded. Production Mother branches, Canonical Truth and Frozen R1 were not modified. First-tier expert AI was not called in this learning round.

