# KAOPU Learning Note — N11 shader-module continuity and derivative contract

Date: 2026-09-17  
Bounded question: When a modular scalar shader function uses `fract`, `floor`, `abs` or other non-smooth operations, when does a downstream screen-space derivative cease to be a valid filter-width estimate, and what must the module interface declare?

Status: **Candidate partial / primary-source and CPU semantic verified**

## Observation roots

### Observation root A — Khronos language contract

The [OpenGL ES Shading Language 3.00.6 specification](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf) defines `dFdx`, `dFdy` and `fwidth` as local-difference fragment functions. It explicitly permits approximate derivatives, says the implementation may assume the evaluated function is continuous, and makes derivatives undefined in non-uniform control flow. Therefore a derivative call is not a proof that its input is a continuous filterable field.

### Observation root B — mature modular implementation

[MaterialX 1.39.4 `mx_aastep.glsl`](https://github.com/AcademySoftwareFoundation/MaterialX/blob/v1.39.4/libraries/stdlib/genglsl/mx_aastep.glsl) uses the same compact Euclidean estimate as the N09 candidate: `length(vec2(dFdx(value), dFdy(value))) * 1/sqrt(2)`. This is useful mature-system corroboration for the helper form, but its scalar signature does not itself describe the upstream field's coordinate Jacobian, continuity class, seam locations or physical meaning.

### Observation root C — executable local-difference counterexamples

The N11 CPU probe models a forward local difference over four pixel-coordinate steps and sweeps 801 phases around an integer seam. Seven semantic gates pass locally and in [GitHub Actions run 35242603669](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35242603669); the tracked JSON reproduced without a diff.

At the smallest coordinate step `h=1/128`:

| Field | finite-difference range | seam maximum magnitude | interpretation |
|---|---:|---:|---|
| linear `x` | `1 … 1` | `1` | exact control |
| raw `fract(x)` | `-127 … 1` | `127` | discontinuous seam creates resolution-dependent spike |
| `floor(x)` cell identity | `0 … 128` | `128` | discrete identity is not a displacement/normal derivative |
| `sin(2π·fract(x))` | `6.235 … 6.283` | `6.283` | value and slope close across the wrap; RMSE `0.000630` |
| `abs(x)` | `-1 … 1` | `1` | value continuous, gradient branch changes at kink |
| triangle wave after `fract` | `-2 … 2` | `2` | value continuous, derivative direction changes at seam/apex |

Raw wrapping is therefore not automatically invalid. A downstream periodic function can close both value and slope. Conversely, a scalar may look bounded and still contain a derivative singularity or branch change.

The local run and Actions replay share one probe design. They establish a reproducible semantic counterexample across two CPU environments, not independent algorithm, GPU, material, geometry or perceptual evidence.

## Candidate

A reusable procedural shader module that may feed derivative filtering, normals or displacement should carry at least:

1. input coordinate space and scale/Jacobian contract;
2. output range and units;
3. continuity class (`discrete`, piecewise constant, C0, C1 or smoother);
4. discontinuity/kink loci and periodic value/slope closure requirements;
5. derivative ownership: analytic gradient, safe downstream local difference, or no derivative use;
6. shader profile, precision and uniform-control-flow requirement;
7. role boundary: classification, optics, normal, displacement or physical state.

## Current Best View

The N09/N10 Euclidean `aastep` remains a compact candidate only when its input is a suitably continuous scalar evaluated in uniform fragment flow. Module composition must validate the field contract before applying the helper. `CellValue`/`floor` identity belongs in classification unless explicitly reconstructed into a continuous distance field. `fract` may be used for coordinates only when the composed function's seam closure is demonstrated at the required derivative order.

## Frozen

- Canonical Truth, Frozen R1 and production Mother branches are unchanged.
- The N09 source pin and N10 straight-edge coverage result remain intact.
- No Mother route was repeated because Brick, Landscape and Farmland supplied no new N02 receipt.

## Rejected

- “A bounded scalar is automatically derivative-safe.”
- “`fract` is always unsafe” and the opposite claim “periodic coordinates are automatically seamless.”
- “A value-continuous field necessarily has a continuous normal/gradient.”
- “Cell identity can directly drive geometry because `dFdx`/`dFdy` exist.”
- “A scalar-only module signature is a complete procedural contract.”
- “CPU local differences prove GPU helper-lane, perspective, mobile or production behavior.”

## Unknown

- Real WebGL quad behavior for the nonlinear Brick R8 scalar chain.
- Precision, helper-lane, perspective and MSAA behavior across actual hardware GPUs.
- Whether current Landscape or Farmland shader modules already expose adequate continuity metadata.
- Mother acknowledgement, implementation, device/public verification and user acceptance.

## Routing recommendation

Keep N11 as a prepared contract addendum. Do not repeat-comment Brick PR15, Landscape PR79 or Farmland PR65 before new receipts. If Brick acknowledges the isolated N09 trial, first classify the selected mask's upstream operators and seam closure, then evaluate derivatives before divergent flow. A future module registry should reject direct geometry/normal use for discrete identity outputs unless a separately verified continuous reconstruction is present.

First-tier expert AI was not called; routine cross-AI discussion remains owned by the separate expert task.
