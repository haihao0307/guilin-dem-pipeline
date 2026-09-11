# Current Best View — Gaussian SH quantization R37 candidate

1. R36's RDF-to-RUB direction convention remains valid, but its zero coefficient error applied only to deliberately grid-aligned values.
2. The pinned Niantic encoder uses two rounding stages. For in-domain coefficients, use conservative per-coefficient bounds `0.03515625` for SH1 and `0.06640625` for SH2/SH3, not the naive reduced-grid half-steps `0.03125` and `0.0625`.
3. In the deterministic 64-splat, 2,054-direction fixture, maximum linear SH-contribution channel error was `0.131709381` and RMSE was `0.037017868`. These are fixture-specific pre-rasterization values, not universal image or acceptance thresholds.
4. The actual packer mapped converted source `+1.25` to `0.9921875` and `-1.25` to `-1`; this profile must fail closed outside the declared `[-1,1]` SH domain.
5. A future real-photo pilot must preserve the float checkpoint, record learned coefficient histograms, run actual encode/decode comparison, evaluate declared camera directions and compare independent fixed-view images. Coefficient, directional-function, rendered-image and human-acceptance budgets stay separate.
6. R34 envelope/range, R35 DC-domain and R36 direction gates remain in force. No photo reconstruction, Brush runtime, GPU/device test or human acceptance occurred; Frozen R1 and production Mothers remain unchanged.
