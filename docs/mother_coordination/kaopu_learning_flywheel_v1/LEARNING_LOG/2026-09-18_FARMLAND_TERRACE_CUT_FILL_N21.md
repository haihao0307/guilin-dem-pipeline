# KAOPU Learning Note — N21 Farmland terrace cut/fill accounting

Date: 2026-09-18  
Bounded question: Does R045.32's existing “both cut and fill” gate establish a volume-balanced terrace surface, and what is the minimum transferable receipt?

Status: **Candidate partial / pinned R045.32 CPU area-integration and lattice-phase counterexample verified; continuous integral, soil mass, Mother adoption, device/public runtime and user acceptance Unknown**

## Observation roots

### Observation root A — actual Farmland Mother implementation

Farmland PR65 advanced after N20 to R045.31 and R045.32. R045.31 enables one localized synthetic bench+riser pilot; R045.32 expands it into three overlapping terrace groups while preserving drainage exclusions and keeping parcel generation, water state, production readiness and global visual acceptance locked.

The fixed R045.32 source is commit `888f6b190ca10b6b4ae3cf2739c0da2e38629194`. Its QA samples a `4 m × 4 m` lattice, separately sums positive and negative height deltas, and passes when both sums exceed a small threshold. Exact local replay passes `33/33` gates and reproduces `pos=57.3062146438` and `neg=57.5410027729`. Those quantities have units of sampled metres until multiplied by cell area; the current check proves both signs occur, not that volume or soil mass is conserved.

R045.32 is real Mother progress, but it does not acknowledge N19 or N20 guidance. The PR conversation still ends with the N20 route. Branch movement is therefore not treated as acknowledgement or adoption of earlier routing.

### Observation root B — pinned executable area and phase counterexample

The N21 probe imports the exact R045.32 kernel and keeps the implemented surface unchanged.

On the retained Mother lattice, multiplying the two sums by the declared `16 m²` sample-cell area gives:

- fill-like geometric volume `916.899434 m³`;
- cut-like geometric volume `920.656044 m³`;
- signed net `-3.756610 m³`.

That near-zero value is not a conservation certificate. Keeping the same `4 m` spacing and changing only lattice origin among four fixed phases changes the net estimate from `-171.073900 m³` to `+120.993493 m³`; the sign reverses and the range is `292.067393 m³`. Meanwhile sampled maximum absolute height change stays within `0.464291–0.492869 m`, so a stable-looking maximum displacement does not bound integrated earthwork error.

A bounded `1 m` midpoint estimate over the enclosing `360 m × 160 m` domain gives fill `917.263101 m³`, cut `904.842781 m³`, and net `+12.420320 m³` (`0.6816%` of moved volume). This is a denser estimate, **not an exact continuous integral**. Against it, the worst net difference among the fixed phase set grows from `64.587666 m³` at `2 m`, to `183.494220 m³` at `4 m`, to `310.606602 m³` at `8 m`.

All `8/8` N21 gates pass locally and on [GitHub Actions run 35342738951](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35342738951). This probe is derived from the same fixed Mother field, so it is not an independent terrain observation. It establishes a numerical counterexample to the sufficiency of the present gate; it does not prove that the final continuous R045.32 surface is materially unbalanced.

### Observation root C — mature-system contracts

[SideFX HeightField Terrace 2.0](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_terrace.html) describes a surface-shaping operator with variable step size, fade, smooth edges and separate `mesa`/`cliffs` masks. It does not claim that a terraced result conserves earthwork or soil mass. [SideFX HeightField Resample](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_resample.html) makes grid spacing, resolution and interpolation filter explicit, with spacing expressed in metres. These primary contracts support versioning the discretization beside any volume receipt; they do not validate N21's numerical thresholds or the Farmland morphology.

### Observation root D — inherited expert review boundary

The separate first-tier expert task added a finite N20 review at coordinator commit `5f9f2f5`. It distinguishes a named sample maximum from a region bound and a continuous derivative claim. N21 inherits that distinction when treating one grid integral as an estimate, not a continuous certificate. The review is a candidate mathematical interpretation, not independent terrain or R045.32 execution evidence, and this learning round did not call another expert.

## Candidate

A minimum geometric cut/fill receipt for a procedural heightfield should serially preserve:

1. baseline and comparison surface versions, coordinate reference, horizontal units and height units;
2. exact integration support, exclusions and boundary treatment;
3. discretization: grid spacing, lattice origin, interpolation/filter, cell area or mesh triangulation;
4. separate `fill = integral(max(delta,0))`, `cut = integral(max(-delta,0))`, signed net and moved volume;
5. at least one offset-grid and one finer-grid negative control, with a declared convergence tolerance;
6. physical/display surface ownership and whether the result changes the water bed or only presentation;
7. if soil mass is claimed, density, bulking/compaction, imported/exported material, spoil handling and construction sequence as separate state.

## Current Best View

R045.32's retained lattice happens to look nearly volume-balanced after area weighting, but that is phase-sensitive and cannot certify the continuous field. “Both signs exist” is weaker still. The correct next gate is a versioned, area-weighted, resolution/phase-aware geometric receipt; it must remain separate from soil-mass conservation, hydraulic truth and visual acceptance.

No automatic mean subtraction or amplitude change is recommended. A numerical rebalance could move terrace elevations, drainage clearances, risers and water capacity, and would require a new Mother version plus the same visual, geometric and hydraulic locks.

## Frozen

- Canonical Truth, Frozen R1 and all production Mother branches remain unchanged.
- R045.32's `visualAcceptance=false`, `parcelGenerationEnabled=false`, `waterStateKnown=false` and `productionReady=false` remain unchanged.
- Drainage carrier arrays, foreground receiver, terrace step amplitude and parcel/hydraulic locks are not modified.
- R045.32 remains synthetic morphology, not surveyed Yunnan terrace geometry.

## Rejected

- “Positive and negative height samples prove balanced cut and fill.”
- “The unweighted sums `pos` and `neg` are already cubic metres.”
- “A near-zero result on one `4 m` lattice proves conservation.”
- “A bounded maximum height delta bounds integrated earthwork error.”
- “Subtract the mean automatically until the number is zero.”
- “Geometric volume balance proves soil-mass, hydraulic, erosion or visual correctness.”

## Unknown

- The continuous-domain R045.32 cut/fill integrals and an accepted convergence tolerance.
- The actual renderer mesh/tessellation volume relative to the analytic height function.
- Soil density, bulking, compaction, import/export and construction history.
- Surveyed terrace sections and same-datum field microtopography.
- Hardware GPU, public runtime, Mother adoption and user acceptance.

## Routing recommendation

One incremental warning was [delivered to Farmland PR65](https://github.com/haihao0307/guilin-dem-pipeline/pull/65#issuecomment-5729787684): retain the current `pos/neg` diagnostic, but label its units and add area-weighted cut, fill and net with grid spacing/origin plus one offset and one finer-grid replay. Do not rebalance geometry, unlock water state, or call the result soil conservation from N21 alone. Delivery is not acknowledgement, implementation or adoption; all three remain Unknown.

No Landscape or Brick route is warranted from this R045.32-specific implementation counterexample. First-tier expert AI was not called in this learning round; routine cross-AI discussion remains owned by the separate expert task.
