# R11 short-stitch guard — one bounded repair candidate

Date: 2026-10-25. Status: numeric/sweep regression checks passed; **visual
acceptance remains separate**. Frozen R10 is unchanged.

## Control and exact preservation boundary

`shortStitchGuard`: normalized `0..1`, core default **0**, recommended repair
candidate value **1**. Core generator ID is `procedural-lace-r11`.

Missing/zero control preserves the complete frozen R10 layer JSON and statistics
byte for byte across the three original presets. The added parameter and version
identifier intentionally differ. Positive control is an explicit, local change
to interior Z; it is not claimed to preserve the old displayed surface.

The guard examines only **cropped three-point fill paths with collinear XY**.
It triggers when the actual three-point curvature radius is smaller than
**four times the complete yarn radius**. At full strength, it limits the middle
sample's Z deviation from the endpoint straight line to

`chordXY² / (64 × complete yarn radius)`.

This gives a conservative curvature margin for the supported display loft and
cross-section extremes, then actual placed/bound Float32 geometry is checked.
It never changes XY, either endpoint, radius, seed, element ID, path count,
sample count, index topology or the net/outline/trim geometry. It neither deletes
stitches nor flips normals. Intermediate strength interpolates this explicit
candidate and is not certified to remove every defect; value 1 is the checked
repair setting.

## Original nine defects versus preventive changes

For the complete default botanical specimen:

- **9** paths had measured radial/winding/direction defects in frozen R10.
- **49** cropped paths meet the radius-aware guard criterion. These include the
  original nine and **40 preventive adjustments**. The latter are not relabelled
  as previously observed defects.
- Maximum interior Z movement across all 49 is **0.01548212 mm**.
- The full bound middle-sample Z range after repair is
  **0.20215054–0.22805532 mm**. Actual geometry coordinates and original large
  world positions are retained in the local comparison payload.

The actual default-cotton generated → placed → bound → Float32 sweep changes:

| Measurement | Frozen R10 | Guard 1 |
| --- | ---: | ---: |
| Inward radial normal samples | 34 | 0 |
| Longitudinal surface edges going backward | 17 | 0 |
| Triangles whose winding opposes mean vertex normal | 1 | 0 |
| Degenerate triangles | 0 | 0 |
| Non-finite position/normal components | 0 | 0 |
| Fill paths | 30,576 | 30,576 |
| Fill triangles | 2,249,984 | 2,249,984 |

The original nine's full points, seeds, roles and frozen diagnostic evidence are
preserved in `fixtures/r10-short-stitches.json`. All 49 IDs, criteria, exact
before/after lofts and limits are in `short-stitch-views.json` and
`r11-short-stitches.json`. `short-stitch-views.json.cases` contains nine complete
`before` and `after` **actual bound paths** for same-camera micro-scale QA,
plus source/placed records. No HTML, production-camera change or display
thickness adjustment is included in this lane.

The sweep still has **open end faces**. The root task's independent micro-view
review observed visible tube openings, especially on paths 19772 and 24563.
This is an inherited representation limit; this candidate does not add caps or
claim a closed solid/verified craft construction. The accepted scope is the
local curvature/folding defect only.

## Checked matrix and limits

**21 actual full-sweep cases** passed with zero remaining inward/reversed/
winding/degenerate/non-finite defects:

- The complete botanical, rosette and ribbon specimens with all three material
  profiles. Botanical changes 49 paths, rosette 31, ribbon 0.
- Twelve bounded generation/display extremes: all three motifs, seeds 0 and
  4294967295, variation .65, fill diameter .10/.32 mm, repeat 2.8/7.2 cm,
  mesh .8/4 mm, needle spacing .08/.5 mm, stitch relief 2 and fan 1; display
  fill loft .2/2, outline loft 2/.2, section control .25/.95, irregularity 0/1,
  and ply OFF/2.5.

The check does not establish all possible combinations, cloth mechanics,
appearance quality or craft topology. Zero-XY chords retain their original
geometry with an explicit hold reason; the generated checked matrix has none.
No second repair increment was needed.

## Reproduction

```text
node --test tests/r11-short-stitches.test.mjs
node tools/verify-r11-short-stitches.mjs
```

Seven regression tests passed. The second command records source hashes and
regenerates the 21-case numeric report plus the independent comparison payload.
Use `--views-only` to refresh just the actual-path payload without repeating the
full matrix. The standalone/browser comparison remains the root task's gate.
