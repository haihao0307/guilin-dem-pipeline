# KAOPU Learning Note — N24 Farmland contour-direction contract

Date: 2026-09-19  
Bounded question: Does R045.39 world-X run support prove that its stable continuation follows local terrain contours?

Status: **Candidate partial / pinned R045.39 CPU semantic counterexample verified; Mother acknowledgement, implementation/adoption, hardware or public runtime and user acceptance Unknown**

## Observation roots

### Observation root A — actual Farmland Mother R045.39

Farmland PR65 advanced after N23 through R045.37, R045.38 and R045.39. N24 fixes R39 at commit `3f7eaf4f12a07d26c67c8e4659d8eceff5c691d5`. Those commits started after N23 was delivered, but the PR conversation contains no explicit acknowledgement; source movement is therefore new implementation evidence, not receipt or adoption.

R39 preserves R38's step, phase, raw stair response, drainage graph and locks, and adds a non-recursive second-shell continuation. Its `stableSide` samples only `(x +/- 6, z)` and `(x +/- 12, z)`. Its topology QA builds rows at fixed `z`, increments `x` by 6 m, and evaluates run count and longest run on those rows. The code accurately describes those operations, but the terms “stable same-family terrace ribbons” and “fragmentation” can be over-read as two-dimensional contour topology when the measurements privilege one world axis.

### Observation root B — pinned executable direction counterexample

The N24 probe imports the exact R30, R38 and R39 kernels without modifying Mother source. An initial 6 m discovery sweep found material R39 continuation-gain samples; the committed replay fixes ten of them so CI remains bounded. For each sample it derives the R30 local contour tangent as the normalized vector perpendicular to the terrain gradient, then compares R39's world-X direction with that frame. This tangent is diagnostic only, not a production proposal.

Results:

- all ten fixed samples retain R39 gains above `0.008`;
- six differ from the local contour tangent by more than `30 degrees`; two exceed `45 degrees`; maximum is `52.11350009 degrees`;
- three have no analogous two-sample support at 6 m and 12 m along the local contour tangent;
- seven cross R39's active-mask threshold of `0.12`; two of those crossings are axis-only under this bounded tangent check;
- the stronger axis-only active crossing is at `(104, -30)`: angle `42.70645858 degrees`, normal-direction projection `0.6782425076`, mask `0.09887149449 + 0.04674355909`, and no tangent-backed pair;
- at the maximum-angle sample `(-106, -108)`, the world-X direction has `0.7892288014` projection onto the terrain normal and no tangent-backed pair. Its height change is only about `-0.00338 m`, so N24 does not claim a large visible artifact from that sample.

A minimal classifier control keeps masks, family, step, index and 6/12 m spacing identical. A horizontal two-cell run is accepted; rotating the support 90 degrees makes the same world-X classifier reject it. This proves coordinate-axis dependence of the classifier. It does not prove the local-tangent diagnostic is the right production continuation.

Local replay passes `8/8` gates. CI is pending. Local and CI replay are the same analysis design, not independent evidence.

### Observation root C — mature primary contracts

[SideFX HeightField Terrace](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_terrace.html) creates steps from the height field and emits separate `mesa` and `cliffs` masks. [HeightField Mask by Feature](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_maskbyfeature.html) separates slope, height, curvature and local surface-facing direction, with an explicit angle spread. [HeightField Flow Field](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_flowfield.html) emits a vector direction layer converted from voxel space into geometry space.

These sources support keeping scalar masks, local direction fields and output morphology as separate contracts. They do not validate N24's tangent sampling distance, gradient scale or any Farmland topology.

### Observation root D — routing and acknowledgement state

N23 was delivered once and remains unacknowledged. R37-R39 are therefore not labelled implementation or adoption of N23. N24 routing is prepared after local verification and will be delivered once only if the coordinator CI replay succeeds.

## Candidate

For a contour-following procedural family, separate three receipts:

1. **axis-specific diagnostic:** row counts, run lengths and fixed-grid samples, explicitly labelled with grid axes, spacing and phase;
2. **local-frame diagnostic:** pin the source height version and derivative scale, save gradient magnitude and tangent orientation, and leave near-flat/critical points Unknown;
3. **orientation-independent topology:** connected components or an explicit graph for splits, merges and drainage-separated branches, tested under rotated and offset lattices.

If Mother continues support along a local direction, it must still reapply drainage/safety locks and demonstrate that interpolation, curvature and LOD do not introduce new gaps. The N24 tangent calculation is not a selected algorithm.

## Current Best View

A lower world-X row fragmentation score proves only improvement for that sampled row family. Same-family and stair-compatible X-neighbours do not by themselves prove contour-following continuation or better two-dimensional nested/branching/merging organization.

For a topology claim, either derive neighbourhood direction from a declared local terrain frame or use a representation that does not privilege a world axis. Preserve the axis diagnostic as useful evidence, but narrow its claim. Retain low-gradient uncertainty, drainage interruptions and all current production locks.

## Frozen

- Canonical Truth, Frozen R1 and production Mother branches are unchanged.
- R045.39 remains `visualAcceptance=false`, `parcelGenerationEnabled=false`, `waterStateKnown=false` and `productionReady=false`.
- Drainage carriers, parcel/shared-bund, hydraulic, visual and production locks remain unchanged.
- R045.39 remains synthetic morphology, not surveyed Yunnan terrace topology or hydraulic truth.

## Rejected

- “Same-family and stair-compatible world-X neighbours prove a contour-following continuation.”
- “Lower horizontal row fragmentation proves better two-dimensional topology.”
- “A fixed-view browser pass resolves the direction-frame question.”
- “N24's local tangent is automatically the correct production continuation.”
- “The small height change at the maximum-angle sample proves there is no topology problem.”

## Unknown

- Mother's intended orientation-independent representation and acceptance tolerances.
- Correct derivative scale, smoothing and low-gradient threshold for a local frame.
- Split/merge behaviour at critical points, curvature, real mesh and LOD transitions.
- Final R39 Mother report/receipt beyond the fixed source commit.
- Hardware GPU, persistent public runtime, Mother acknowledgement/implementation/adoption and user acceptance.
- Surveyed field microtopography and same-datum hydraulic controls.

## Routing recommendation

After CI, deliver one incremental Farmland gate: label current row metrics as axis-specific, add rotated/offset lattice checks and a two-dimensional component/graph receipt, and pin the height/derivative/low-gradient contract if a local frame is used. Do not prescribe the N24 tangent diagnostic, raise risers, smooth drainage locks or unlock parcels/hydraulics/production.

No Landscape or Brick route is warranted from this R39-specific counterexample. First-tier expert AI was not called; routine cross-AI discussion remains owned by the separate expert task.
