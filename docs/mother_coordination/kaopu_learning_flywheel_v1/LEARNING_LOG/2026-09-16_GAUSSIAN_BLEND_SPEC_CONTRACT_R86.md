# KAOPU Learning R86 — WebGL / OpenGL ES blend precision contract audit

Date: 2026-09-16  
Status: **Candidate partial**, with a passed **Observation** source-contract audit.

## Bounded question

Do the normative WebGL 2 / OpenGL ES sources require the exact per-operation Float32 staging and bitwise RGBA16F result selected empirically by R85, or must R85 remain runtime-specific?

## Source lock and executable evidence

The probe is preregistered in `PROBES/gaussian_blend_spec_contract_prereg_r86.json` and executed by the R86 workflow. The final artifact records byte lengths and SHA-256 receipts for:

- OpenGL ES 3.0.6 at KhronosGroup/OpenGL-Registry commit `1cdd228e34966dd6b95bd203e9f84faba0f371a1`.
- `EXT_color_buffer_float` and `EXT_float_blend` from the same locked OpenGL Registry commit.
- WebGL 2.0.0, its matching extension declarations, and the WebGL conformance fixture at KhronosGroup/WebGL commit `714857a28445e8f5d8d6ae1c78498578009534d8`.

Fourteen machine checks passed in workflow run 35004160706. The result is `PROBES/gaussian_blend_spec_contract_result_r86.json`.

## Observation roots

### Root A — normative Khronos standards lineage

OpenGL ES 3.0.6 specifies the blend equations and says blend computation precision and dynamic range must be no lower than the destination components. It also says otherwise-unspecified floating-point representation and operation details are not specified and implementations need not agree pixel-for-pixel.

The float color-buffer extensions add renderability or blending applicability. They do not add a rule requiring Float32 intermediates, per-operation Float32 rounding, a particular staging order, or bitwise-identical RGBA16F results.

WebGL 2 derives from OpenGL ES 3.0 and leaves OpenGL ES authoritative where WebGL does not override it. No inspected WebGL override mandates the R85 staging pattern.

These documents are one standards lineage, not several independent empirical roots.

### Root B — non-normative Khronos WebGL repository receipt

The locked WebGL conformance fixture includes RGBA16F and compares rendered values with a nonzero `[12,12,12,12]` threshold through `bilinearCompare`. This is useful evidence about the official test policy, but it is not an independent normative source and does not authorize arbitrary tolerance or bitwise cache reuse.

### Root C — inherited R85 runtime observation

R85 remains a separate empirical Observation Root: on locked Three.js r186, Chromium 143 and ANGLE Vulkan SwiftShader, the three decoded-aware cases select `f32-staged` as the tested input/output-equivalent model. R86 did not rerun or upgrade that runtime observation.

## Current Best View delta

**Candidate:** `f32-staged` remains the best model for the exact R85 runtime root only. Normative conformance does not require that exact bit pattern.

A hardware replay is a new runtime Observation Root, not a “conformance proof” of R85. For bit-exact replay, cache or bound reuse, receipts must bind at least backend, driver/runtime, blend path and output format.

## Rejected

- RGBA16F storage implies half-precision blend arithmetic.
- Floating-point renderability implies cross-implementation bitwise portability.
- `EXT_float_blend` mandates Float32 staging for RGBA16F.
- Algebraically equivalent blend equations must round identically.
- Passing a conformance threshold authorizes bit-exact cross-backend cache reuse.

## Frozen / Unknown

Frozen R1, Canonical Truth, production Mother branches and production assets are unchanged.

Unknown: unchanged R85 matrix on a genuinely different hardware-backed WebGL implementation; WebGPU; Safari/iPhone; real assets; performance; human visual acceptance; and Mother adoption.

## Preserved failures

- Run 35003700747 failed before evidence because `pdftotext` was absent.
- Run 35003821726 failed before evidence because the runner received HTTP 403 from `registry.khronos.org`; the final audit used commit-pinned official KhronosGroup GitHub mirrors from the same standards lineage.
- Run 35004015637 downloaded all sources and passed 13/14 checks, but the gate expected the wrong helper name (`thresholdCompare` rather than `bilinearCompare`). The nonzero-tolerance claim was unchanged; the identifier was corrected and the failure retained.

## Next gate

Replay the unchanged R85 matrix on one genuinely different hardware-backed WebGL implementation. Capture browser/version, GL vendor/renderer, driver/runtime, extension set, blend path, output format and exact target bits. Another SwiftShader run is not a new runtime root.

Mother routing is prepared only; acknowledgement, implementation and acceptance remain Unknown. First-tier expert AI was not called in this learning round.
