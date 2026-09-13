# Current Best View R61 — splat precision risk is sequence/state aware

Status: **Candidate partial**.

R61 refines R60: effective optical depth and `sum(alpha^2)` may both be useful screening features, but their unordered pair is insufficient to certify HalfFloat accumulation precision.

Four actual Three.js r186 renders used exactly the same 1,941-splat alpha multiset, so calibrated `tau=7.9909139785` and `sum(alpha^2)=0.0588358475` were identical. Only the fixed source order changed. Center Half/Float error ranged from `0.0084507465` to `0.0729035139`; ascending versus descending Half differed by `0.064453125`, while Float differed by only `3.57628e-7`. Final sRGB pair differences ranged from 6 to 29 codes.

Current decision contract:

- unordered aggregate statistics may identify a possible risk domain but cannot certify precision;
- retain actual draw/sort order or an equivalent order-sensitive state trace;
- on the r186 WebGL fallback, call and verify `updateSort()` once before disabling automatic sorting, because the material always reads `CountingSort.orderRead` and the update initializes the WebGL/PBO order route;
- keep default Half as the unmodified validation start and Float as a paired numerical counterfactual;
- promote neither format without real-domain image criteria and measured target-device cost.

The proposed increment-to-Half-ULP mechanism remains **Candidate**, not established. R61 is a synthetic same-center, same-color stress fixture in the R55–R60 Chromium/SwiftShader evidence lineage; it is not an independent physical Observation Root. WebGPU, hardware GPU, Safari/iPhone, real-photo reconstruction, performance/energy and human acceptance remain **Unknown**. Frozen R1 and Canonical Truth are unchanged.

Next: test one running, order-sensitive Half-ULP margin statistic against these four sequences and a targeted counterexample.

