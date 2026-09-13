# Current Best View R64 — center precision does not certify the footprint

Status: **Candidate partial**.

For the fixed Three.js r186 Chromium/SwiftShader fixture, one-splat Float calibration measured the effective alpha of every pixel, including the `0.3` screen kernel and `r² > 4` cutoff. Nearest-even ordered replay then matched every one of the actual Half framebuffer's `4,356` channels exactly. Signed propagated residuals decomposed Half-minus-ideal within `1.11e-15`, and coverage matched the measured cutoff mask.

This extends the diagnostic mechanism from R63's center pixel to the locked full footprint, but rejects center-only certification: maximum RGB Half/Float error was `0.00940910` at center and `0.03287943` in the cutoff-inside class. Final presentation differed by up to `18` eight-bit codes.

A separate first-run counterexample rejected generic JavaScript Float replay as a bit-exact renderer oracle: its maximum deviation was `9.2983e-6`, above the preregistered `1e-6` gate. The failed gate remains provenance; it was not converted into a pass by widening the threshold.

The full per-pixel/channel residual trace is an exact revision-pinned diagnostic for this fixture, not a compact predictor, perceptual threshold or production format decision. This remains the R55-R64 software-browser evidence lineage. Multiple spatial centers, anisotropic overlaps, SH, WebGPU, hardware GPU, Safari/iPhone, real reconstruction, performance/energy and human acceptance are **Unknown**. Canonical Truth and Frozen R1 are unchanged.

Next: test a preregistered unsigned Half-ULP/transmittance bound against the exact spatial residual.

