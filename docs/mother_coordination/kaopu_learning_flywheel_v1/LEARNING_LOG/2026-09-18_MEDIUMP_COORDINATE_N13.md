# KAOPU Learning Note — N13 mediump coordinate magnitude contract

Date: 2026-09-18  
Bounded question: At what coordinate magnitude can a mobile-class `mediump` path lose a `1/128` sampling step, and can the current desktop WebGL2/SwiftShader QA reveal that failure?

Status: **Candidate partial / primary-source, binary16 counterexample and SwiftShader runtime verified**

## Observation roots

### Observation root A — Khronos precision contract

The [GLSL ES 3.00.6 specification](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf) requires `highp` float to use IEEE-754 single precision. `mediump` has only a minimum range of approximately `(-2^14, 2^14)` and minimum relative precision `2^-10`; an implementation may provide more. The spec also says actual range and precision can vary within and between shaders and can be queried through the API.

The [WebGL specification](https://registry.khronos.org/webgl/specs/latest/1.0/#5.14.9) defines `getShaderPrecisionFormat`; its returned `rangeMin`, `rangeMax` and `precision` describe the implementation's numeric format. They are capability metadata, not a command to emulate the minimum format in every executed expression.

### Observation root B — conservative binary16 counterexample

The CPU probe quantized coordinates to IEEE binary16, a conservative candidate matching the `mediump` minimum relative-precision class while exceeding its minimum range. It is not claimed as the representation of every GPU.

For a sampling step `h=1/128`, 256 samples produced:

| integer offset | binary16 ULP | unique direct coordinates | adjacent collapse | value-noise RMSE |
|---:|---:|---:|---:|---:|
| 0 | `2^-24` | 256 | 0% | 0 |
| 8 | `1/128` | 256 | 0% | 0 |
| 16 | `1/64` | 129 | 49.80% | `0.002659` |
| 64 | `1/16` | 33 | 87.45% | `0.026684` |
| 256 | `1/4` | 9 | 96.86% | `0.021855` |
| 1024 | `1` | 3 | 99.22% | `0.243177` |
| 4096 | `4` | 1 | 100% | `0.339475` |
| 8192 | `8` | 1 | 100% | `0.210349` |

At offset 1024 the direct `fract` phase had only one unique value. Splitting exact integer cell identity from a bounded binary16 local coordinate preserved the phase and the fixture's integer-hashed value noise exactly at all tested offsets. This split worked because it occurred before precision loss and retained cell identity explicitly; subtracting an origin after quantization would not recover lost samples.

### Observation root C — actual WebGL2/SwiftShader behavior

The first runtime gate [failed](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35267268696) because it assumed a declared `mediump` expression would reproduce the binary16 collapse. The failure was retained and the assumption was replaced with an observation gate.

In the successful [Chrome 152 WebGL2 run](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35267368739), `getShaderPrecisionFormat` reported fragment `mediump = range ±15, precision 10` and `highp = range ±127, precision 23`. Nevertheless, declared `mediump` and `highp` shader phase matrices were byte-for-byte equal from offsets 0 through 8192: both retained 128 periodic phase values with zero RMSE. Thus this SwiftShader path does not emulate the conservative mobile-class failure even though its query reports the lower mediump guarantee.

The CPU and browser observations have different roles. Binary16 proves a permitted failure class; SwiftShader proves that the current CI backend can hide it. Neither is an actual iPhone or mobile-GPU result.

## Candidate

A modular procedural coordinate contract should add:

1. precision tier for coordinate formation, storage and downstream operations;
2. maximum scaled-coordinate magnitude and minimum meaningful increment;
3. explicit origin/tile/cell decomposition performed before narrowing precision;
4. integer cell/hash identity kept separate from bounded local interpolation coordinates;
5. a device precision receipt rather than inferring mobile behavior from desktop SwiftShader.

For a binary16-class path, the local spacing near magnitude `M` grows roughly with `M/1024`. A design should require that spacing to remain below the smallest needed coordinate increment with margin. For `h=1/128`, the tested boundary is between offsets 8 and 16. This is a design estimate, not a universal GLSL threshold.

## Current Best View

Large world coordinates must not be passed directly into a `mediump` modular noise/warp chain when sub-unit phase matters. Form local coordinates in `highp` or split the coordinate into stable integer tile/cell identity plus a bounded local fraction before narrowing. The split must preserve non-periodic cell/hash semantics; camera-relative subtraction alone is insufficient if it changes identity or occurs after precision loss.

`getShaderPrecisionFormat` should be saved as a capability receipt, but desktop CI success cannot replace a minimum-precision emulator or target-device run. N09–N12 continuity and derivative gates remain necessary after the coordinate precision gate passes.

## Frozen

- Canonical Truth, Frozen R1, N09–N12 results and all production Mother branches remain unchanged.
- No existing procedural implementation was replaced.
- No Mother route was repeated without acknowledgement.

## Rejected

- “Declaring `mediump` in SwiftShader proves the shader survives minimum mobile precision.”
- “The precision-query result proves every expression is executed at exactly that precision.”
- “Values inside the mediump numeric range retain arbitrary small spatial increments.”
- “Subtracting an origin after quantization restores lost phase.”
- “Local rebasing may discard tile/cell identity without changing non-periodic noise.”
- “The binary16 probe is an iPhone or universal GPU measurement.”

## Unknown

- Actual iPhone/mobile-GPU precision, compiler lowering and performance.
- Precision and coordinate magnitudes of the selected Brick R8, Landscape G3.T2 or Farmland material chains.
- Cross-language integer-hash equivalence if tile/cell identity is routed through GLSL, WGSL, CPU or asset baking.
- Mother acknowledgement, implementation, device/public verification and user acceptance.

## Routing recommendation

Prepare N13 for Brick Material and Landscape because both can use large procedural coordinates, but do not repeat-comment PR15 or PR79 before a Mother receipt. When a real implementation is returned, record its scaled-coordinate magnitude and minimum feature step, then run the same locked view on target hardware. Farmland receives no new delivery unless its material path exposes the same coordinate pattern.

The next tightly coupled learning gap is the bit-stability and overflow contract for integer tile/cell hashes across CPU, GLSL ES and WGSL; that identity is required by the safe split proposed here.

First-tier expert AI was not called; routine cross-AI discussion remains owned by the separate expert task.
