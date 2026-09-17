# KAOPU Learning Note — N14 portable integer cell/hash contract

Date: 2026-09-18  
Bounded question: Can the integer tile/cell identity required by N13 be given one bit-stable contract across CPU, GLSL ES and WGSL without relying on incompatible overflow, conversion or shift behavior?

Status: **Candidate partial / primary-source, CPU and WebGL2 SwiftShader runtime verified; WGSL runtime Unknown**

## Observation roots

### Observation root A — GLSL ES language contract

The official [GLSL ES 3.00.6 specification](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf) defines `highp` signed integers as 32-bit two's-complement values. Integer operations keep the low 32 bits on overflow or underflow; `int`/`uint` conversions preserve the bit pattern. Signed right shift sign-extends and unsigned right shift zero-fills. A shift count below zero or at least the operand width is undefined.

### Observation root B — WGSL language contract

The official [WGSL Candidate Recommendation Draft dated 15 September 2026](https://www.w3.org/TR/WGSL/) defines concrete `i32` and `u32` as 32-bit values, with `i32` represented in two's complement and concrete integer overflow reduced modulo `2^32`. `bitcast` reinterprets the bit representation. WGSL runtime shifts effectively reduce the count modulo the bit width, while constant and override counts at or above 32 are validation errors.

This differs from GLSL ES for out-of-range shift counts. Therefore a portable contract must reject such counts instead of selecting one language's behavior.

### Observation root C — executable CPU fixture

The probe defines one narrow ABI: encode each signed cell coordinate by its two's-complement bit pattern as `u32`; perform all mixing modulo `2^32`; use logical unsigned right shift; allow shift counts only from 0 through 31; preserve ordered `(x,y)` pair identity.

Eleven of eleven CPU checks passed over 12 fixed vectors spanning `INT_MIN`, `INT_MAX`, negative cells, zero, positive cells and the float32 exact-integer boundary. All fixture hashes are distinct, but that is only a fixture observation and does not prove collision freedom or hash quality.

The key negative controls were:

- float32 represents both cell `16777216` and `16777217` as `16777216`, while the integer ABI produces different hashes;
- signed `-1 >> 16` yields the all-one bit pattern, while unsigned `0xffffffffu >> 16` yields `0x0000ffff`;
- shift count 32 is undefined in GLSL ES but has different WGSL runtime/validation behavior, so the ABI rejects it before evaluation.

### Observation root D — WebGL2 runtime

The successful [Chrome 152 WebGL2 run](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35278939343) used `ANGLE Vulkan SwiftShader`. Eight of eight runtime gates passed: all 12 GLSL ES hashes exactly matched the CPU fixture and signed/unsigned right shifts reproduced their specified difference.

The first [WebGPU attempt](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35278446056) failed to initialize a Vulkan/WebGPU adapter. The WGSL module remains embedded and source-auditable, but no WGSL runtime result was obtained. This failure is evidence of a missing runtime route, not evidence against WGSL semantics.

CPU and SwiftShader are separate execution contexts using the same test design; they are not independent algorithm evidence.

## Candidate

Use a versioned integer-cell ABI wherever N13 splits large coordinates into stable cell identity plus bounded local fraction:

1. signed coordinates are restricted to `i32` and reinterpreted bit-for-bit as `u32`;
2. mixing is written only with `u32` addition, multiplication, xor and logical shifts;
3. overflow is explicitly modulo `2^32`;
4. every shift count is statically or dynamically checked to be within `0..31`;
5. pair order and coordinate axes are part of the ABI;
6. numeric values and byte serialization are separate contracts; byte order must be stated if values cross a file/network boundary;
7. a locked vector table accompanies every CPU/GLSL/WGSL implementation.

## Current Best View

N13 coordinate splitting is portable only if cell identity stays integer from its source and is validated with the same fixed vectors in every execution language. Converting a large cell index through float, using signed arithmetic shifts in a hash, depending on a language's out-of-range shift behavior, or silently changing pair order breaks the identity contract.

The 12-vector fixture is a conformance gate, not a claim that this mixer is the best hash or has acceptable collision/distribution behavior for production. Adoption still requires the selected Mother to expose its actual coordinate representation and target runtime.

## Frozen

- Canonical Truth, Frozen R1, N13 and all production Mother branches remain unchanged.
- No procedural implementation or production hash was replaced.
- No Mother route was repeated without acknowledgement.

## Rejected

- “Integer-looking float coordinates preserve every large cell identity.”
- “Signed and unsigned right shifts are interchangeable in a hash.”
- “Shift count 32 has one portable meaning across GLSL ES and WGSL.”
- “Matching 12 vectors proves collision resistance or good statistical distribution.”
- “The embedded WGSL module or normative specification is a WGSL runtime pass.”
- “SwiftShader proves mobile or iPhone behavior.”

## Unknown

- WGSL execution on an available WebGPU adapter.
- Target iPhone/mobile-GPU behavior and performance.
- The actual integer/float coordinate path, axis order and serialization used by Brick or Landscape.
- Hash distribution and collision suitability for a selected production workload.
- Mother acknowledgement, implementation, public/device verification and user acceptance.

## Routing recommendation

Prepare N14 as an addendum to the held N13 route for Brick Material and Landscape, but do not repeat-comment PR15 or PR79 before a Mother receipt. If either Mother adopts coordinate splitting, require its CPU/GLSL/WGSL or bake/runtime implementation to pass the locked vectors before any visual comparison. Farmland receives no new route without an exposed need.

The next gap is to execute the same vectors on a real WebGPU/WGSL adapter and target mobile hardware, then audit the selected Mother implementation's actual cell source and transport boundary.

First-tier expert AI was not called; routine cross-AI discussion remains owned by the separate expert task.
