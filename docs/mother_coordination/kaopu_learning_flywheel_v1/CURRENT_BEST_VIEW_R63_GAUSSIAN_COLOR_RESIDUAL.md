# Current Best View R63 — color precision is ordered and channel-specific

Status: **Candidate partial**.

R63 holds one 1,941-splat alpha sequence and one RGB color multiset fixed, changing only which color is assigned to each write. All cases therefore share the same alpha state trace, 1,228 alpha stalls and Half alpha endpoint `0.97900390625`.

Their maximum internal RGB Half/Float errors nevertheless range from `0.0028208792` to `0.0063344836`. Alpha-only evidence therefore cannot certify RGB precision. A nearest-even per-channel replay matched the actual Half center bits exactly, and its signed local residual propagated through later transmittance reproduced Half-minus-ideal within `4.27e-16`.

The full ordered residual trace is an exact diagnostic decomposition for these three cases, not a compact predictor, perceptual threshold or production format decision. Default Half and paired Float remain candidates requiring real-asset and target-device comparison.

This is still the R55-R63 Chromium/SwiftShader software evidence lineage, not a new independent physical Observation Root. Off-center footprints, cutoff behavior, SH appearance, WebGPU, hardware GPU, Safari/iPhone, real reconstruction, performance/energy and human acceptance remain **Unknown**. Canonical Truth and Frozen R1 are unchanged.

Next: replay the full pixel grid with spatially varying Gaussian effective alpha and explicit cutoff-neighborhood classification.

