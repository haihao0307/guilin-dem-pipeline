# KAOPU Learning Note — N17 u32-to-float mapping contract

Date: 2026-09-18  
Bounded question: What endpoint and precision contract should map a 32-bit procedural hash to a floating value?

Status: **Candidate partial / fixed-source audit, CPU and native WGSL software-runtime verified; GLSL ES runtime divergence preserved; target hardware, production implementation and Mother adoption Unknown**

## Observation roots

### Observation root A — language contracts

[GLSL ES 3.00.6](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf) defines numeric conversion between `uint` and `float` and bit reinterpretation through `uintBitsToFloat`/`floatBitsToUint`. [WGSL](https://www.w3.org/TR/WGSL/) separately defines `u32` to `f32` conversion and `bitcast`. Neither specification makes a chosen random interval, precision budget or downstream index policy correct; those are application contracts.

### Observation root B — fixed V2.6 transfer-package source

The Brick V2.6 transfer package at HOUSE commit `c6223d36ceeb827e3894fc181340c284b1cbfa73` states independent deterministic seed layers. Its fixed event kernel blob `b28e0daf...` implements `RNG.next()` as `state / 0xffffffff`; its transfer kernel blob `cb84cae8...` uses the same denominator in `hash3i`.

That JavaScript expression defines a closed interval. When the hash is `0xffffffff`, the result is exactly `1.0`. Consequently `range(a,b)` may return exactly `b`. `pick` contains an explicit clamp and remains in bounds, but that local defense does not make every downstream consumer safe. The package tests deterministic isolation; they do not state or test the numeric interval.

This audit is a source observation, not evidence that Landscape has implemented or adopted the package. The withdrawn Landscape PR #80 remains prohibited.

### Observation root C — executable endpoint and precision fixture

The N17 C++20 probe passed `8/8` local and CI gates on eight boundary hashes. It reproduces the JavaScript upper endpoint and three float32 mappings.

- On the C++ reference path, `float(h) / 4294967295.0f` is not merely the JavaScript formula at lower precision. The denominator rounds to `2^32`, and every hash from `0xffffff80` through `0xffffffff`—128 input states—rounds to `1.0`.
- `float(h >> 8) * 2^-24` yields exactly `2^24` possible values in `[0,1)`, with maximum `1 - 2^-24`; it intentionally discards eight low bits.
- `uintBitsToFloat(0x3f800000 | (h >> 9)) - 1` yields `2^23` values in `[0,1)`, with maximum `1 - 2^-23`; it intentionally discards nine low bits.

The first WebGL2 run correctly rejected the expectation of exact agreement. Chrome 152 / ANGLE Vulkan SwiftShader mapped `0xffffff7f` to `1.0`, while C++ and native WGSL mapped it to the next float below one. The two half-open candidates matched bit-for-bit across all tested CPU, GLSL ES and native WGSL vectors. The initial failed runs are retained as evidence; the gate now requires this observed closed-form divergence rather than hiding it. The corrected [GitHub Actions run 35304991328](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35304991328) passed CPU `8/8`, WebGL2 `8/8` and native WGSL `4/4` gates.

Native WGSL executed through pinned `wgpu 29.0.0`, Vulkan and Mesa llvmpipe. These are software runtimes, not hardware GPU or mobile evidence. All runtime paths share one test design and are not independent algorithm evidence.

## Candidate

Every procedural module should declare its hash-to-value ABI explicitly:

1. interval: `[0,1]`, `[0,1)`, `(0,1)` or another range;
2. retained hash bits and resulting number of distinct values;
3. conversion/bitcast formula and shader precision;
4. endpoint behavior for `range`, array indexing, thresholds and angle construction;
5. mapping version, because changing it changes every derived field even when the integer hash is unchanged.

For a strict `[0,1)` shader contract, `top24` is the current compact candidate because it preserves one more random bit than the mantissa construction and uses ordinary numeric conversion. The mantissa construction remains a valid alternative where its bitcast contract is preferred. This is not authorization to replace the V2.6 package or any production implementation.

If a receiver intentionally wants a closed `[0,1]` interval, division by `0xffffffff` can be retained only with an explicit endpoint policy. Porting that expression to float32 changes endpoint multiplicity and can differ across conforming runtime paths at a rounding boundary, so a direct textual port is not semantically identical.

## Current Best View

N16 established that a 32-bit hash is a seed/fingerprint rather than a unique Cell identity. N17 adds that the integer hash alone is still not a complete procedural-noise ABI: the integer-to-value mapping controls interval, resolution, endpoint multiplicity and downstream safety.

The V2.6 source is deterministic but presently has an undocumented closed interval. Its seed-layer labels demonstrate separation in its own tests, not statistical independence, receiving-domain truth or production adoption.

## Frozen

- Canonical Truth, Frozen R1 and every production Mother branch remain unchanged.
- The Brick V2.6 transfer package remains a prepared transfer artifact, not Landscape implementation or adoption.
- The withdrawn Landscape PR #80 remains rejected for adoption.
- N14–N16 integer vectors and identity conclusions remain valid; N17 does not change their mixer.

## Rejected

- “`uint / 0xffffffff` always produces a half-open random interval.”
- “Copying the JavaScript division into float32 preserves endpoint behavior.”
- “CPU float32 boundary bits are automatically identical to every GLSL ES implementation.”
- “A deterministic integer hash completely specifies the procedural noise source.”
- “Discarding low bits is automatically a defect”; it is an explicit precision tradeoff for exact float representability.
- “Independent seed names prove statistical or physical independence.”
- “The existence of a transfer package proves receiving-Mother implementation or acceptance.”

## Unknown

- Which mapping, if any, Landscape or Brick production code actually uses.
- Hardware GPU, iPhone/mobile precision, performance and browser-public behavior.
- Visual sensitivity of the real surface fields to top-24 versus mantissa-23 mapping.
- Mother acknowledgement, implementation version, device/public checks and user acceptance.

## Routing recommendation

One incremental warning was delivered to the existing Landscape PR79 thread as [comment 5724930016](https://github.com/haihao0307/guilin-dem-pipeline/pull/79#issuecomment-5724930016) because its newly fixed V2.6 transfer pack contains the audited expression: preserve the source's closed-interval behavior only if intentional; otherwise test a versioned `top24` half-open mapping. Delivery is not acknowledgement, implementation or adoption. Do not revive PR #80, and do not repeat the older N02 instructions. Brick PR15 and Farmland PR65 need no repeat delivery.

First-tier expert AI was not called; routine cross-AI discussion remains owned by the separate expert task.
