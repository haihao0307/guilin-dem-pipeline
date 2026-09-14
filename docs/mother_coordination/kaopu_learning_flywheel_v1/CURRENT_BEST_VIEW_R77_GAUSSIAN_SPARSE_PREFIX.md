# Current Best View R77 — Gaussian Half replay checkpoint scope

Status: **Candidate partial**.

## Observation

- On the fixed Three.js r186 nominal-45-degree SwiftShader fixture, seven independent full-frame prefixes (`1/32/128/512/1024/1536/1941`) match both Float-calibrated Float32 replay variants across all 4,356 decoded Half channels.
- Prefix 1,941 independently reproduces the complete-frame control bit for bit.
- The two replay variants produce identical Half states across every modeled channel at every one of the 1,941 steps, so this fixture contains no test point capable of separating them.

## Current Best View

Declare replay arithmetic explicitly as Float32 before nearest-even Half storage. R77 supports this as a sampled diagnostic model for one software fixture, not as a formal or cross-backend rule.

Terminal equality, sparse-prefix equality, all-write equivalence, formal bounds and device acceptance remain separate gates. A fixture may validate a class of Float32 replay while being structurally incapable of selecting a particular Float32 operation ordering.

## Rejected

- Reuse the invalid R76 scissored sequence.
- Treat prediction-equivalent models as independently corroborated alternatives.
- Promote seven sampled writes to all-write or production authority.

## Unknown

Fixed-function fusion/order, unobserved actual prefixes, hardware GPU, WebGPU, Safari/iPhone, real assets, performance, visual acceptance and Mother adoption.

Canonical Truth, production Mothers and Frozen R1 remain unchanged.
