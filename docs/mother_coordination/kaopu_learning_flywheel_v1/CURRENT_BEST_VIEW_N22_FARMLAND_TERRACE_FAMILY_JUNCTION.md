# Current Best View N22 — multi-family terrace junctions

Status: **Candidate partial**

R045.33 demonstrates that support continuity and output-height continuity are different contracts. Its smooth maximum support envelope feeds a hard dominant-family selector; the selected family's step/phase frame can therefore jump at equal-weight boundaries. The pinned N22 replay finds an actual `0.797561 m` epsilon-scale output discontinuity on an essentially unchanged substrate.

Replacing the selector with interpolation of completed, quantized heights is not neutral. In the tested overlaps, `68.678%` of samples are more than `0.05 m` from every materially active family's own height delta. That may be an intentional transition surface, but it does not preserve either family's terrace-level identity.

The current best method is to keep these versioned separately:

1. family/branch topology and level correspondence;
2. quantization frame and level index;
3. named junction compositor;
4. support, family, junction, mesa and riser/cliff diagnostics;
5. epsilon value/gradient checks, N21 cut/fill convergence, fixed-view evidence and existing locks.

No compositor is accepted yet. Production geometry, Canonical Truth, Frozen R1, parcels and hydraulics remain unchanged.
