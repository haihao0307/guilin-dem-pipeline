# Current Best View N24 — frame-aware terrace topology

Status: **Candidate partial**

R045.39 defines a stable terrace side only from samples at world `x +/- 6 m` and `x +/- 12 m`, while its fragmentation receipt also scans rows of increasing `x` at fixed `z`. Those are valid axis-specific diagnostics, but they do not by themselves prove that a continuation follows the local terrain contour or improves two-dimensional branching/merging topology.

On ten fixed R39 continuation-gain samples, six differ from the R30 local contour tangent by more than `30 degrees`; the maximum is `52.1135 degrees`. Three have no analogous two-sample support along the local contour tangent. Seven cross the active-mask threshold and two of those crossings are supported only by the world-X test; the stronger one is `42.7065 degrees` from the local tangent, with `0.6782` projection onto the terrain normal direction. A minimal 90-degree rotation control changes the same two-cell classifier from accepted to rejected.

The transferable rule is to separate axis-specific sampling diagnostics from topology claims. A contour-following continuation must either derive its neighborhood from a declared, versioned local terrain frame or use an orientation-independent component/graph representation. Receipts should include rotated and offset lattices, tangent-alignment and two-dimensional connectivity, while keeping drainage exclusions and low-gradient uncertainty explicit.

The local tangent used by N24 is an analysis diagnostic, not a selected production algorithm. It depends on the height version and derivative scale and becomes ill-conditioned on near-flat terrain. No R39 parameter, topology method or visual result is accepted yet.
