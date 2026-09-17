# N04 — Domain-warp field, geometry and derivative boundary

## Bounded question

N02-1 asks: at identical object-space coordinates and base seed, what changes in the sampled field, actual geometry and derivative when domain warp is enabled?

This round studies only that question. Cellular, multiscale composition, psrdnoise, modular shaders and erosion remain separate queue items. It does not resume photo reconstruction or external ocean study.

## Fixed source and method

- Official implementation: [Auburn/FastNoiseLite](https://github.com/Auburn/FastNoiseLite/tree/785f37a9ad76e283586a379675085f2063ae03f7), revision `785f37a9ad76e283586a379675085f2063ae03f7`, MIT.
- Locked header: `Cpp/FastNoiseLite.h`, Git blob `c67f2e5…a697`, SHA-256 `bcba859a…df142`, declared version 1.1.1.
- Base seed `424242`, warp seed `31337`; base frequency `1/32 m^-1`, warp frequency `1/64 m^-1`, documented warp amplitude `8 m`, height scale `2.5 m`.
- The same 129×129 object-space grid was evaluated with the same base-noise object before and after `DomainWarp`. OpenSimplex2, Perlin and Value were tested separately.
- Geometry identity was hashed from float height bytes. A material-only branch intentionally retained the baseline height buffer; a displacement branch wrote the warped samples.
- The composed field `h(p)=n(q(p))` used central differences to compare the direct gradient with `J_q(p)^T ∇n(q(p))` and with the incomplete `∇n(q(p))` alternative.
- CPU cost is the median of three one-million-sample runs on this host. It is measurement, not a GPU forecast.

Probe: [`noise_domain_warp_probe_n04.cpp`](../PROBES/noise_domain_warp_probe_n04.cpp)  
Result: [`noise_domain_warp_result_n04.json`](../PROBES/noise_domain_warp_result_n04.json)  
Source receipt: [`SOURCE_LOCK.json`](../references/noise-domain-warp-n04/SOURCE_LOCK.json)

## Observation

All 24 predeclared CPU checks passed. A second local run was identical after removing timing fields.

| Base kernel | RMS field change | RMS height change | mean / max normal change | chain-rule RMS error | incomplete-gradient RMS error | local CPU ratio |
|---|---:|---:|---:|---:|---:|---:|
| OpenSimplex2 | 0.07314 | 0.18284 m | 2.314° / 8.739° | 0.0000294 | 0.0096607 | 3.23× |
| Perlin | 0.03187 | 0.07969 m | 0.686° / 2.232° | 0.00000984 | 0.0034729 | 3.16× |
| Value | 0.02100 | 0.05251 m | 0.424° / 1.438° | 0.00000583 | 0.0021736 | 3.66× |

- With fixed base seed and base kernel, warped coordinates produced a different sampled field for all three kernels.
- Material-only use preserved the exact baseline geometry hash. Writing the warped scalar to displacement changed the geometry hash for every kernel.
- Reversing evaluation order preserved all warped float values exactly, so the fixed source is coordinate/seed driven for this bounded call path.
- The full composed derivative matched the directly differenced warped field closely. Omitting the warp Jacobian was worse by factors of roughly 300–370 in these samples.
- The observed maximum displacement of sampling coordinates was `1.63893 m`, below the configured maximum `8 m`; the amplitude setting is a bound, not evidence that every sample moves by that amount.

The local and CI executions derive from the same locked implementation and test design. They establish replayability, not an independent algorithm or physical Observation Root.

## Candidate / Current Best View

1. Treat domain warp as an explicit coordinate transform, not as a replacement base-noise identity. Persist base kernel configuration and warp configuration separately.
2. “Same seed” does not imply the same field after the coordinates change. Identity receipts must include coordinate frame/units, seed, frequency, warp type/seed/frequency/amplitude, composition order, source revision and numerical path.
3. A warped material lookup does not change the object mesh. Geometry changes only where the warped scalar is deliberately assigned to authorized displacement.
4. When warped displacement does change geometry, shading normals need the derivative of the complete composition. Collision, silhouette, bounds and downstream caches remain separate consumers and require their own rebuild/acceptance checks.
5. CPU overhead is configuration- and implementation-specific. The measured ratios are useful only for this fixed CPU probe; GPU cost needs target shader/runtime evidence.

Status: **Candidate partial / pinned-source CPU verified**. N02-1 is complete at the source/CPU-method layer, not adopted or production-closed.

## Rejected

- “Enabling domain warp by itself changes actual geometry.”
- “The base-noise gradient at the warped point is sufficient for the warped surface normal.”
- “Using the same base seed guarantees the same field after coordinate warp.”
- “This host CPU ratio predicts browser, mobile or GPU cost.”
- “Domain warp is erosion, geology or a physically justified displacement model.”

## Unknown / required next acceptance

- Landscape and Farmland Mother implementation receipts are absent; their existing N02 guidance was not repeated.
- Brick/Tiles still has no verified current route.
- GPU shader equivalence, derivative availability, browser/iPhone performance, collision rebuild, LOD behavior, public runtime and user visual acceptance are unknown.
- Canonical Truth, Frozen R1 and all production Mother branches are unchanged.

## Next learning gap

Advance N02-2 independently: compare Cellular `CellValue`, nearest-distance and edge-distance (`F2-F1`) behavior, including discontinuities and the separation of material use from authorized geometry use.

First-tier expert AI was not called; routine expert discussion belongs to the separate night expert task.
