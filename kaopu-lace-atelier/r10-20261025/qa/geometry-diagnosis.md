# R10 geometry diagnosis — frozen R09 surface, 2026-10-25

Status: **HOLD_LOCAL for nine cropped short stitches. R10 keeps R09 geometry.**
This report measures generated world-space geometry at 1 world unit per cm.
It is not a browser/GPU benchmark, a visual acceptance, or a craft certification.
`geometry-diagnosis.json` retains source hashes, recipe, distributions, exact
path points, abnormal normals and the reversed triangle. Reproduce with
`node tools/diagnose-yarn.mjs` from the R10 folder; the tool imports frozen R09
modules and writes only this dedicated QA JSON.

## Main appearance factors

- The actual fill cross-section is **0.1400 mm wide × 0.04520 mm thick** at the
  median: width/thickness **3.097:1**. The sweep multiplies core `flatten=.37`
  by material `flatten=.48/.55`, yielding `.32291`. The UI value alone does not
  describe the visible section. Outline median thickness/width is `.48473`.
- The six-sided ground net has median visible thickness/width `.58449`.
  Its ideal ellipse parameter is `.67491`, but its six sampled angles reach
  only `sin(60°)` of the ideal vertical extent. These are existing geometric
  choices, not evidence that normals should be arbitrarily softened.
- Of 30,576 fill paths, **5,300 (17.33%)** have less than 1° maximum XY turn.
  The rest already bend in XY. Median fill centreline interior turn is 7.95°;
  p95 is 15.65°. More centreline samples/bending should not be assumed to fix
  the whole rod-like appearance.
- The bulk of normals is consistent: no non-unit normals, tangent orthogonality
  failures or seam mismatch of practical size (maximum seam normal jump about
  0.0000021°). Fill longitudinal normal jump is p95 10.88°, p99 14.92°.
  High circumference changes (p95 78.87°) follow the thin, eight-sector ellipse
  and deserve a controlled material comparison; they are not a general seam bug.

## Local failure, retained explicitly

The radial-orientation check is
`dot(normal, vertexPosition - correspondingCentrelinePoint) <= 0`.
It found **34 inward-facing radial samples among 1,369,600 unique-sector fill
vertices (0.002482%)**, across **9 / 30,576 paths (0.02944%)**. All are cropped
three-point strokes, **0.01600–0.03503 mm** long with **0.07000 mm radius**.
They are far shorter than their 0.14 mm width. The negative radial cosine spans
approximately `-0.99997 .. -0.02841`.

| Fill path index | Element | Role | Inward samples | Reversed longitudinal edges |
| --- | --- | --- | --- | --- |
| 6308 | 289 | leaf-fill | 4 | 1 |
| 10121 | 378 | rose-fill | 1 | 0 |
| 10212 | 383 | leaf-fill | 1 | 0 |
| 15308 | 522 | leaf-fill | 1 | 0 |
| 19772 | 633 | leaf-fill | 9 | 6 |
| 20167 | 652 | rose-fill | 3 | 2 |
| 24563 | 742 | leaf-fill | 9 | 6 |
| 25694 | 799 | leaf-fill | 5 | 2 |
| 30092 | 952 | rose-fill | 1 | 0 |

Five of these paths have actual surface edges going backward against the local
centreline direction (worst signed projection **−0.006595 mm**). Thus at least
this subset has a sweep fold; the other four have radial-orientation anomalies
but this edge-direction test alone does not establish a fold.

The sole triangle whose winding opposes its mean vertex normal is **fill
triangle 452616** (zero-based), path **6308**, element **289**, vertex indices
**311368, 311369, 311377**. It is 1 / 2,249,984 fill triangles (0.00004445%).
Its world-space vertices in cm are:

```json
[
  [-3.735226631164551, -10.600739479064941, 0.021332956850528717],
  [-3.7333171367645264, -10.601463317871094, 0.019724804908037186],
  [-3.7356104850769043, -10.601783752441406, 0.02022147737443447]
]
```

Path 6308's three centreline samples in cm are:

```json
[
  [-3.7282515627708537, -10.602118142250083, 0.020193279999999997],
  [-3.7286355895542354, -10.603162565632541, 0.021332956849495353],
  [-3.7290196163376175, -10.604206989015001, 0.0202214782421875]
]
```

Its fitted three-point curvature radius is **0.01113 mm**, versus yarn radius
**0.07 mm**. Other held paths reach curvature radius **0.007244 mm**. A normal
sign flip would conceal rather than repair this geometry. Do not delete the
stitches, shrink them, reduce density, or alter R09 geometry during the current
lighting comparison.

## Cost and exact-display optimization opportunities

The frozen default botanical cotton specimen has **3,605,264 primary triangles
+ 600,200 fuzz triangles**. Actual typed buffers are **173,940,904 bytes primary
+ 33,929,304 bytes fuzz** (about 198.24 MiB combined). Fill contributes 2,249,984
primary triangles, 62.41% of the main surface. The accepted R09 flow adds
1,098,944 triangles; its cost is already substantial.

1. The R09 fuzz builder fills ordinary numeric arrays and then copies them into
   typed buffers. Its numeric payload alone is at least 68,422,800 temporary
   bytes before JS-array overhead. Preallocation can keep every root, attribute
   byte and index unchanged. **The root agent has independently implemented and
   verified this in R10; this report does not claim that implementation.**
2. The primary sweep recomputes the same ring-level `crossSectionNoise`, ply
   phase and amplitude inside each sector's normal loop. Hoist/reuse them once
   per ring without changing floating-point expression order. The current full
   specimen performs about **1,922,841 avoidable crossSectionNoise evaluations**
   across fill/outline/trim. Validate all attribute/index bytes before adoption.
3. A material-only edit already reuses unaffected mesh buffers, but
   `placeDisplayLayers()` still maps every layer before key checks. Moving the
   unchanged-layer check ahead of placement can avoid temporary coordinate
   copies without changing accepted geometry. Keep fill's outline-loft cache
   dependency and the staged failure-disposal contract.

## Next independent repair candidate

Freeze these nine path IDs, endpoints, radii and source coordinates as a small
regression specimen. Compare a local surface representation that handles the
union of very short swept segments against the existing self-overlapping sweep;
also study a separately authorized curvature/loft constraint with fixed
endpoints. The latter changes the interior shape and must stay an explicit
candidate. Require same-camera closeups, external surface/first-hit comparisons,
and no new winding/radial/attachment failures. Neither approach is implemented
or accepted here. The current R10 appearance comparison remains geometry-identical.
