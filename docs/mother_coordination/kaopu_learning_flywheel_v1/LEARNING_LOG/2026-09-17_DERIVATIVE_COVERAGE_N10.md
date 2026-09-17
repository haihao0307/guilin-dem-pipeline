# KAOPU Learning Note — N10 derivative edge-width coverage contract

Date: 2026-09-17  
Question: For a modular shader threshold, which derivative-width estimate best approximates one-pixel box coverage across rotation and scale, and what constraints must travel with it?

Status: **Candidate partial / analytic CPU reference verified**

## Observation roots

### Observation root A — Khronos language contract

The [OpenGL ES Shading Language 3.00.6 specification](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf) defines `fwidth(p)` as `abs(dFdx(p)) + abs(dFdy(p))`. It describes derivatives as local differencing commonly used to *estimate* procedural filter width, permits approximate and location-dependent methods, and makes derivatives undefined in non-uniform control flow. This source does not claim exact pixel coverage.

### Observation root B — pinned candidate implementation

N09 pinned [glslify/glsl-aastep @ 49d5967](https://github.com/glslify/glsl-aastep/blob/49d59670789be4b9863c3991baa3a58b9bff8c05/aastep.glsl). Its active derivative path uses `length(vec2(dFdx(value), dFdy(value))) * 1/sqrt(2)` as the `smoothstep` half-width. This is a Euclidean-gradient heuristic, not the GLSL `fwidth` definition.

### Observation root C — exact CPU coverage counterexample

The N10 probe clips a unit pixel square against a linear half-plane and uses the clipped polygon area as exact box-filter coverage. It sweeps 19 orientations, 321 subpixel offsets and five scalar-gradient scales, then compares:

- pixel-centre hard step;
- fixed scalar-space `smoothstep` width;
- the pinned `glsl-aastep` Euclidean width;
- `0.5 * fwidth` with `smoothstep`;
- a linear ramp spanning one `fwidth`.

All 7 semantic checks pass locally and in [GitHub Actions run 35229418843](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35229418843); the tracked JSON reproduced without a byte-level diff. Aggregate RMSE is:

| Method | RMSE | maximum absolute error | scale RMSE range |
|---|---:|---:|---:|
| hard step | 0.2203185 | 0.5000000 | 0 |
| fixed smooth width | 0.1452640 | 0.3803280 | 0.1717402 |
| Euclidean derivative + smoothstep | **0.0193914** | **0.0580583** | 0 |
| `0.5*fwidth` + smoothstep | 0.0269961 | 0.0962220 | 0 |
| one-`fwidth` linear ramp | 0.0607914 | 0.1249979 | 0 |

The linear `fwidth` ramp is exact for the axis-aligned straight edge but becomes the worst derivative estimator near 45 degrees. The pinned Euclidean/smoothstep heuristic has the lowest aggregate and maximum error of the tested compact formulas, yet is still not exact. Fixed scalar width changes error materially with scale.

The local CPU probe and Actions replay share one analytic design. They establish reproducible mathematics across two execution environments, not an independent algorithm, GPU or perceptual Observation root.

## Candidate

For one isolated WebGL2 Brick Material mask trial, retain N09's pinned Euclidean derivative width as the current compact candidate rather than replacing it with `fwidth` merely because `fwidth` is the language built-in. Compute derivatives before any fragment-divergent branch or discard. Treat its result as an opacity/coverage approximation only.

## Current Best View

An antialiased threshold contract needs five explicit parts:

1. scalar field and coordinate space;
2. derivative estimator and transition transfer function;
3. shader profile and control-flow location;
4. locked scale/orientation/camera acceptance matrix;
5. separation of analytic coverage, GPU execution, performance and human visual acceptance.

N09's Euclidean helper is a defensible small candidate for the isolated mask, not a universal replacement for `smoothstep`, MSAA, texture filtering or geometry.

## Frozen

- Canonical Truth and Frozen R1 are unchanged.
- Brick geometry, canonical material parameters and production Mother branches are unchanged.
- N09 source/license pin and its one SwiftShader WebGL2 execution remain unchanged.
- No new route was sent while N09 acknowledgement is absent.

## Rejected

- “`fwidth` is defined by GLSL, therefore it equals exact pixel coverage.”
- “A linear one-`fwidth` ramp is orientation independent.”
- “A fixed scalar-space width is stable under scale.”
- “The best straight-edge CPU estimator is automatically best for curved, noisy, perspective or multisampled production masks.”
- “Calling derivatives after divergent flow or discard is portable.”

## Unknown

- Brick Material Mother's acknowledgement, implementation and adoption.
- Behavior on the real R8 nonlinear pore/fissure scalar field, locked cameras and composited material stack.
- Hardware GPU, mobile/public runtime, precision and fragment cost.
- MSAA, perspective, curved boundaries, temporal stability and postprocessing.
- User visual acceptance.

## Routing recommendation

Hold this as an addendum to the already-delivered N09 Brick Material trial. Do not repeat-comment PR15 before a Mother receipt. When the Mother implements the isolated A/B, record the exact helper/profile, confirm derivatives execute in uniform flow, and compare locked views at multiple scales and orientations. That receipt remains distinct from adoption and user acceptance.

First-tier expert AI was not called; routine cross-AI discussion belongs to the separate expert task.
