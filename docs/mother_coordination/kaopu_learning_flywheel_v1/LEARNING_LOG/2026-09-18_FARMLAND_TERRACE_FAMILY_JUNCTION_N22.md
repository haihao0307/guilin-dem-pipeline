# KAOPU Learning Note — N22 Farmland terrace-family junction contract

Date: 2026-09-18  
Bounded question: Does R045.33's continuous overlap mask make the composed multi-family terrace height continuous, and is direct height blending a sufficient repair?

Status: **Candidate partial / pinned R045.33 CPU semantic counterexample verified; Mother implementation/adoption, hardware or public runtime and user acceptance Unknown**

## Observation roots

### Observation root A — actual Farmland Mother R045.33

Farmland PR65 advanced after N21 to R045.33 at fixed source commit `f8b180f1b1bda01885bdef6e3a2ab25e0c2257f8`. The round correctly preserves its first failed `36/37` attempt, then isolates one variable: it narrows the synthetic drainage-clearance shoulder while keeping the R32 family envelopes and quantization frame. Final R33 reports `37/37` machine gates and real Chrome startup, but manual fixed-view acceptance remains `false` and the next defect is explicitly the family organization across branches, merges and drainage interruptions.

The implemented composition has two different semantics:

- support is the continuous maximum of three smooth family weights;
- terrace `step`, `phase` and quantized response come from `dominantTerraceGroup`, a hard winner selected by the largest weight.

Therefore the mask can be continuous while the selected quantization frame changes discontinuously. R33's existing 4 m neighbor gate limits one sampled difference but does not evaluate the epsilon-scale limit on each side of a family-label boundary.

R33 still does not acknowledge or implement N21's area/phase-aware cut/fill receipt. Branch progress is not counted as acknowledgement or adoption of that earlier route.

### Observation root B — pinned executable junction counterexample

The N22 probe imports the exact R30–R33 kernels and does not modify the Mother surface. On R33's retained audit region and a 4 m discovery lattice it finds:

- `696` samples where at least two family supports are materially active;
- `126` neighboring pairs where the dominant family changes;
- all `126` switch pairs refine by 40 bisections to an epsilon-scale label change;
- `112/126` refined switches have more than `0.05 m` terrace-delta discontinuity;
- the maximum discontinuity is `0.797561 m` while the underlying R30 height changes only `5.32e-8 m` across the same epsilon interval.

The maximum seam is not caused by a changed integer terrace index: both sides retain index `11`. The middle frame yields `+0.384244 m` terrace delta and the upper frame yields `-0.413318 m`; small frame differences put the smoothed stair response on opposite sides of its transition. Only `19/126` refined seams change the integer index, so checking index identity alone is insufficient.

A second bounded counterexample interpolates the already-quantized family deltas using the continuous support weights. This removes the hard selector by construction but does not preserve family-level identity: `478/696` (`68.678%`) overlap samples land more than `0.05 m` from every materially active family's own delta. The largest off-family distance is `0.430071 m`; at that sample the two active family deltas are `+0.429642 m` and `-0.488010 m`, while their blend is `-0.057939 m`.

All `8/8` gates pass locally. The first GitHub Actions run `35353093785` preserved a useful instrumentation failure: every gate executed, but byte comparison differed in the last serialized digits of the epsilon-side substrate delta. Reducing general serialization from 12 to 9 significant digits still left the intentionally tiny `baseJump` platform-sensitive in run `35353355332`. The semantic gate was not relaxed: the exact transient value was replaced in the persisted receipt by its tested class, `baseJump < 1e-6 m`; the local diagnostic value remains reported above. Final CI receipt: **pending corrected commit**. Local and CI replay are the same analysis design, not independent evidence.

### Observation root C — mature primary contracts

[SideFX HeightField Terrace 2.0](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_terrace.html) keeps variable step size, global fade, edge smoothing and the generated `mesa`/`cliffs` masks distinct. [HeightField Layer](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_layer.html) defines Blend as explicit interpolation between two height layers and treats optional masking separately. [HeightField Blur](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_blur.html) exposes a mask-aware mode specifically because ordinary blur at a mask boundary can cause sharp changes.

These are transferable compositing contracts, not evidence that any particular R33 alternative is correct. They support separating height composition, support masks and cliff/mesa diagnostics instead of assuming a smooth weight field automatically preserves the semantics of quantized levels.

### Observation root D — routing and acknowledgement state

The latest PR65 conversation contains the N19, N20 and N21 delivered guidance but no Mother reply acknowledging any of them. R045.33 is new implementation evidence, not an acknowledgement receipt. N22 routing is initially prepared only; its final delivery receipt is appended after the coordinator evidence is published.

## Candidate

For a multi-family quantized heightfield, version and test four separate objects:

1. **family topology:** connected family/branch identity and explicit junction or level-correspondence rules;
2. **quantization frame:** height coordinate, step, phase, smoothing interval and level index for each family;
3. **compositor:** hard selection, pre-quantization control blend, post-quantization height blend or an explicit junction corridor—named rather than hidden inside one weight;
4. **diagnostics:** support, family identity, `mesa`, `cliff/riser`, junction and exclusion masks.

At every materially active junction, serialize epsilon-side value and gradient checks, a coarser visual/runtime check, cut/fill with the N21 discretization receipt, and the existing visual/hydraulic locks. A method may intentionally create an intermediate transition surface, but it must not call that result “the same terrace level” without an explicit level mapping.

## Current Best View

R045.33's overlap masks are continuous, but its complete composed height is not. The defect arises from switching a discrete quantization frame after support evaluation. Directly blending completed terrace heights trades the hard seam for intermediate heights that do not belong to either active family; it is a different construction, not a semantic no-op.

No replacement algorithm is promoted from N22. The next Mother trial should first declare whether a junction preserves one shared terrace frame, maps levels between two branches, or intentionally creates a transition corridor. Only then should it compare hard selection, frame/control blending and height blending under the same seam, gradient, cut/fill, fixed-view and lock receipts.

## Frozen

- Canonical Truth, Frozen R1 and production Mother branches are unchanged.
- R045.33 remains `visualAcceptance=false`, `parcelGenerationEnabled=false`, `waterStateKnown=false` and `productionReady=false`.
- Drainage carriers, water graph, parcel/shared-bund locks and user-approved production constraints remain unchanged.
- R045.33 remains synthetic morphology, not surveyed Yunnan terrace geometry or hydraulic truth.

## Rejected

- “Smooth overlapping weights guarantee a continuous composed height.”
- “A max-envelope mask makes the dominant family label continuous.”
- “A 4 m neighbor bound detects epsilon-scale family seams.”
- “Matching integer terrace indices prove two family frames meet continuously.”
- “Linear height blending preserves either family's terrace-level identity.”
- “N22 selects a production algorithm or validates agricultural construction.”

## Unknown

- The topology and level-correspondence rule Mother will choose at real branch/merge junctions.
- Accepted value, gradient, cut/fill and screen-space tolerances for this task.
- Whether the maximum analytic seams are visible at the fixed production camera and final mesh/LOD.
- Hardware GPU, persistent public runtime, actual Mother implementation/adoption and user acceptance.
- Surveyed field microtopography, terrace sections and same-datum hydraulic controls.

## Routing recommendation

Send one incremental Farmland warning after publication: before changing R33's family organization, add an epsilon-side family-switch gate and name the junction compositor. Preserve separate family/junction/riser masks and retain N21's area/phase cut/fill receipt. Do not respond by relaxing the current bound, globally blending all quantized heights, raising riser amplitude or unlocking parcels/water.

No Landscape or Brick route is warranted from this R33-specific counterexample. First-tier expert AI was not called; routine cross-AI discussion remains owned by the separate expert task.
