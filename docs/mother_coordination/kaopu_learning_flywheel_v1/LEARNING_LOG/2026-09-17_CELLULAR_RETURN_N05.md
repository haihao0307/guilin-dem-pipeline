# N05 — Cellular return types, seams and geometry boundary

## Bounded question

N02-2 asks which Cellular return type provides useful value, edge and gradient behavior for soil grains and rock details. This round compares only `CellValue`, Euclidean nearest distance (`F1`) and FastNoiseLite `Distance2Sub` (`F2-F1`, shifted by minus one). It does not advance multiscale composition, psrdnoise or erosion.

## Fixed source and method

- Official implementation: [Auburn/FastNoiseLite](https://github.com/Auburn/FastNoiseLite/tree/785f37a9ad76e283586a379675085f2063ae03f7), revision `785f37a…03f7`, MIT.
- Header raw-byte SHA-256 `47a29750…5dc2`, declared version 1.1.1.
- Fixed seed `424242`, frequency `1`, jitter `1`, Euclidean distance, 193×193 grid.
- 1,200 detected transitions between closest cells were refined by bisection. Values at successively smaller offsets and finite-difference gradients on both sides were compared.
- Material-only lookup retained baseline geometry bytes. Each field was also deliberately assigned as a small displacement and hashed separately.
- Timings are medians of three one-million-sample CPU runs and are not GPU forecasts.

Probe: [`cellular_return_probe_n05.cpp`](../PROBES/cellular_return_probe_n05.cpp)  
Result: [`cellular_return_result_n05.json`](../PROBES/cellular_return_result_n05.json)  
Source receipt: [`SOURCE_LOCK.json`](../references/cellular-return-n05/SOURCE_LOCK.json)

## Observation

All 15 predeclared CPU checks passed. A second local run matched every non-timing field.

- `CellValue` is a closest-cell identity value. Across refined boundaries its fine/coarse jump ratio was exactly `1.0`; shrinking the offset did not shrink the value cliff. Its numerical gradient was zero at `99.106%` of grid samples but reached `583.97` at sampled cliffs.
- `F1-1` was value-continuous: the fine/coarse cross-boundary difference ratio was `0.2499`. Its median gradient-vector change across boundaries was `1.772`, so continuous height does not imply a continuous normal.
- `(F2-F1)-1` was also value-continuous and its raw gap `(return+1)` approached zero at boundaries (`p95=0.000971`). Its measured local slope coefficient of variation was `0.374`, rejecting treatment as a globally unit-slope Euclidean edge distance.
- Material-only sampling preserved the baseline geometry hash. Explicitly assigning any of the three outputs to displacement changed geometry bytes.
- Local CPU medians were approximately `24.6 ms` for CellValue, `25.4 ms` for F1 and `26.5 ms` for F2-F1 per million calls on this host. These close values are not a cross-platform performance contract.

### Source-contract correction

The pinned constructor explicitly defaults to `EuclideanSq + Distance`, and the executable default path exactly matched that explicit configuration. The adjacent setter remarks have those default labels inverted: “Distance” appears under the distance-function setter and “EuclideanSq” under the return-type setter. This is recorded as an upstream documentation defect; constructor state and execution, not the swapped remarks, govern the receipt.

## Candidate / Current Best View

1. Use `CellValue` as a stable per-cell mask or selector when hard categorical regions are intended. Do not feed it directly to geometric displacement unless vertical cliffs and undefined boundary normals are explicitly desired and accepted.
2. Use `F1` for smooth radial variation within cells, while treating nearest-feature boundaries as normal/crease seams. Geometry use requires derivative, silhouette, collision and sampling checks.
3. Use `F2-F1` as an unsigned edge-gap proxy: add one to undo FastNoiseLite’s output shift, then remap thickness explicitly. It is useful for material boundary bands but is not a signed distance, a normalized thickness or proof of real grains/joints.
4. Grain or rock identity, orientation, size distribution and spatial support must come from the target material contract or observations. Cellular noise supplies a procedural partition only.
5. Material lookup and authorized geometry displacement remain separate routes. Anti-aliasing and derivative behavior must be verified in the target shader/runtime.

Status: **Candidate partial / pinned-source CPU verified**. N02-2 is complete only at source and CPU-method level.

## Rejected

- “CellValue is a smooth grain-height field.”
- “F1 is fully smooth because its values are continuous.”
- “F2-F1 is an exact signed or unit-slope distance to the cell edge.”
- “The default labels in both setter comments can be copied without checking the constructor.”
- “A cellular partition is evidence of physical soil grains, masonry joints, weathering or erosion.”
- “CPU timings establish browser, mobile or GPU cost.”

## Unknown / routing state

- Landscape PR79 and Farmland PR65 still have no feedback after the existing N02 publication; no message was repeated.
- Brick material entry PR15, Brick shape entry PR17 and Tiles/building entry PR11 were found read-only. Routing is prepared but not delivered; no adoption is claimed.
- Shader filtering, GPU derivatives, browser/iPhone runtime, geometry collision, LOD, public delivery and user visual acceptance remain Unknown.
- Canonical Truth, Frozen R1 and all production branches remain unchanged.

## Next learning gap

Advance N02-3 independently: compare fBm/ridged multiscale amplitude and frequency schedules under resampling, including pre/post-clamp distributions, silhouette retention and aliasing/LOD boundaries.

First-tier expert AI was not called; routine expert discussion remains owned by the separate night expert task.
