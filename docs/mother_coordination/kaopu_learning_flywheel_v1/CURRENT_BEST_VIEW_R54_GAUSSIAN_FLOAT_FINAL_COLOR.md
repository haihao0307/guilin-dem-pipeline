# Current Best View R54 — direct Three.js stable-color float versus RGBA8 storage

Status: **Candidate partial**.

R54 separates stable color storage from the discontinuous Gaussian cutoff studied in R50-R53. Under pinned Three.js r186 / Chromium 143 software WebGL and WebGPU paths, 256 deterministic stable pixels were rendered once into offscreen RGBA32F and once into offscreen RGBA8 with no blending, no Gaussian cutoff, no tone mapping and target color space disabled.

Across 1024 RGBA channels, the maximum normalized float-to-RGBA8 error was `0.0019607962346544494`, approximately half an 8-bit code plus float epsilon; no channel exceeded one code. WebGL and WebGPU produced identical RGBA32F hashes and identical RGBA8 hashes, with exactly equal error metrics.

This establishes a candidate stable-storage baseline: in this locked no-transform fixture, ordinary RGBA8 storage alone does not explain R49's roughly 0.005 blended final-target discrepancy. The additional error must be sought in a different stage, especially per-draw blending/accumulation or later output transforms.

R54 does not establish blended Gaussian image accuracy, browser presentation accuracy, hardware GPU behavior, Apple target-device behavior, real-asset quality or human acceptance.

The next executable gap is a controlled direct-TSL two-splat blend using a blendable float intermediate and RGBA8 final target, with stable-storage error kept separate from blend accumulation.

Frozen R1, Canonical Truth and production Mother branches remain unchanged.
