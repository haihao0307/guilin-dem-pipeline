# Current Best View — N20 Farmland aspect sampling

Status: **Candidate partial**

R045.30's published `32.384274°` maximum is correct for its declared `10 × 6 m` lattice, but it is not a continuous-field bound. The fixed implementation reaches `35.641409°` on a `5 × 4 m` lattice, just beyond the unchanged `<35°` gate. The missed location has old/new gradient magnitudes only `0.014555/0.019349`, so angle is also near-flat and ill-conditioned.

Current candidate contract:

- version the finite-difference stencil, units, sample spacing and lattice origin;
- preserve old/new gradient magnitudes and vector delta beside angle;
- use signed `atan2(cross,dot)` only after both gradients pass a declared, purpose-specific magnitude floor;
- run an offset or denser negative-control lattice around maxima and thresholds;
- mark near-flat direction as `Unknown` rather than manufacturing a stable aspect;
- do not raise thresholds merely to absorb a newly discovered counterexample.

The correct Farmland slope floor and a continuous-support bound remain Unknown. R045.30's visual, terrace, parcel, water and production locks remain unchanged.
