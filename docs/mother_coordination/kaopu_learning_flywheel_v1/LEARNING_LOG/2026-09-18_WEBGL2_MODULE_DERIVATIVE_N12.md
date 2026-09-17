# KAOPU Learning Note — N12 WebGL2 modular-field derivative runtime

Date: 2026-09-18  
Bounded question: Does the N11 continuity matrix reproduce inside an actual WebGL2 fragment quad, and which conclusions survive that runtime boundary?

Status: **Candidate partial / WebGL2 SwiftShader runtime verified**

## Observation roots

### Observation root A — normative language contract

The [OpenGL ES Shading Language 3.00.6 specification](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf) remains the governing source: fragment derivatives may be approximate, implementations may assume continuity, and results in non-uniform control flow are undefined. This source defines permitted behavior; it does not predict one implementation's exact local difference.

### Observation root B — N11 CPU semantic model

N11 constructed explicit local differences for `fract`, `floor`, a value-and-slope-closed sine, `abs` and a triangle wave. That probe is a mathematical counterexample and expected-value root, not GPU/runtime evidence.

### Observation root C — WebGL2 runtime observation

[GitHub Actions run 35254768156](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35254768156) executed the same field family in Headless Chrome 152, WebGL2 / GLSL ES 3.00, through ANGLE Vulkan SwiftShader. The probe used a `256×4` fragment target, seven subpixel seam phases, coordinate step `h=1/128`, and an `RGBA8UI` framebuffer with `floatBitsToUint` packing so derivative values were not inferred from a screenshot. All 10 runtime gates passed.

Normalized by `h`, the observed derivative ranges were:

| Field | seam `dFdx/h` range | result |
|---|---:|---|
| linear `x` | `1 … 1` | control exact |
| raw `fract(x)` | `-127 … 1` | wrap discontinuity becomes a resolution-scaled spike |
| `floor(x)` | `0 … 128` | discrete identity jump, not a geometry gradient |
| `sin(2π·fract(x))` | `6.129612 … 6.281209` | no wrap spike for this value-and-slope-closed composition |
| `abs(x)` | `-1 … 1` | bounded but branch-changing kink |
| triangle after `fract` | `-2 … 2` | bounded, direction-switching seam/apex |

All captured `dFdy/h` values were zero for the y-constant fields. The runtime therefore reproduces the N11 categories, but the CPU and WebGL probes share the same synthetic construction and are not independent evidence of production correctness.

## Candidate

For a modular scalar that may feed `aastep`, normals or displacement:

1. reject raw discontinuous identities or wraps as downstream derivative-width inputs;
2. carry the coordinate Jacobian so a derivative has declared units;
3. allow periodic coordinates only after the composed function demonstrates the required value and derivative closure;
4. distinguish a bounded kink from a smooth field: absence of an unbounded spike does not imply continuous normals;
5. evaluate derivatives in uniform flow before discard or divergent branches.

## Current Best View

N11 is strengthened, not replaced. A derivative helper is valid only together with an upstream field contract. In the tested WebGL2 runtime, raw `fract` and `floor` reproduce exactly the seam failures predicted by the CPU model, while the specifically closed sine avoids the wrap spike. The reusable rule is to classify the composed field, not the operator name alone.

## Frozen

- Canonical Truth, Frozen R1, N09 source pin and the N10/N11 results are unchanged.
- No production Mother branch or asset was modified.
- Brick PR15, Landscape PR79 and Farmland PR65 received no repeated comment because no new acknowledgement was present.

## Rejected

- “The N11 spikes are only a CPU artifact and cannot occur in WebGL2.”
- “A successful `dFdx` call converts `floor` identity into a meaningful geometry gradient.”
- “All uses of `fract` are invalid”; the closed sine is a concrete counterexample.
- “Bounded derivative magnitude proves C1 continuity”; `abs` and the triangle wave remain branch-changing.
- “SwiftShader success proves hardware GPU, mobile, production-mask or perceptual correctness.”

## Unknown

- Brick R8's actual nonlinear mask graph, locked cameras and helper-lane behavior.
- Hardware GPU, mobile precision, MSAA and target-device cost.
- Whether the selected Mother implementation carries coordinate/Jacobian and continuity metadata.
- Mother acknowledgement, implementation, public/device verification and user acceptance.

## Routing recommendation

Keep N12 as a prepared N09–N11 addendum for Brick Material. Do not repeat-comment PR15 before acknowledgement. After a real isolated mask implementation is returned, capture its operator chain and coordinate transform, then test the locked R8 views on hardware. Landscape and Farmland need no new delivery from this synthetic runtime confirmation.

If no Mother receipt arrives, the next generic module-contract gap is how `mediump` precision and large coordinate magnitude affect repetition, seam placement and derivative stability on mobile-class shaders.

First-tier expert AI was not called; routine cross-AI discussion remains owned by the separate expert task.
