# Exterior-only join proposal, not activated

The source and current map remain separate versions. This package does not alter or integrate into the frozen main scene. The raw outer DSM must not be used to restore the story's removed lakes/rivers or overwrite local high-resolution terrain.

Measured on the existing boundary's land nodes:
- Identical projected 30m lattice, exactly coincident node coordinates.
- New independently reprojected source minus frozen display height: max absolute 3.202507m, RMS0.399610m over2299 nodes.
- Full overlap max22.453291m also includes previously authored story terrain. It is not an estimated datum difference and must never become a global correction.
- An independent rewarp at the old extent also differs; this audit has not established a single root cause. Do not claim an exact old pipeline reproduction.

Priority: existing local2m/5m DTM and authored station surfaces, then frozen background/story edits, then this outer field. The current module defaults to exterior-only queries and refuses the old owned rectangle.

Optional next integration, if selected: a separately labelled120m-wide exterior display-only transition. For a point q outside the old rectangle, let p be its nearest point on the old boundary and d=distance(q,p). Define w=1-smoothstep(0,120m,d). Then display H(q)=H_outer(q)+w*[H_old_boundary(p)-H_outer(p)]. The correction is zero at/after120m and never modifies old samples, source DSM, spectrum coefficients, original shore masks, or story events. It is an explicit derived join layer, not a surveyed height or datum transform.

Apply only where both boundary and exterior supports are known non-water and no higher-priority geometry owns the point. Ocean, lake, river, unknown, mask-conflict and shoreline cells retain their independent classification; unresolved joins remain flagged instead of silently converting water to land. At corners use clamped nearest boundary coordinates for a continuous correction definition. Do not extrapolate old land masks into the exterior. Any selected join must receive its own image, mask-complement, slope, collision-support and island-preservation QA before integration acceptance.

For height LOD between outer chunks, use a shared edge at the finer neighbor level or a tested stitch. Same-LOD chunk boundaries already reconstruct identically. Avoid arbitrary vertical skirts around islands or coastal silhouettes.
