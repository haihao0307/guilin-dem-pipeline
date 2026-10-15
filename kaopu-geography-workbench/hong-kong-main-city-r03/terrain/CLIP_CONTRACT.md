# R03 background triangle subtraction contract

## Scope and files

This is an independent render-cache module. It subtracts the union of four new CEDD rectangles from the existing background triangles. It does not edit the host, R02, source height arrays, source masks, existing detail patches, coastline/story data, or floor samplers. It creates no joining surface and performs no blending or inward feathering.

- Runtime: `clip-background-rects.js` (standalone browser global and CommonJS)
- Unit/property tests: `clip-background-rects.test.cjs`
- Pinned real-host audit: `validate-clip-host.cjs`
- Audit result: `clip-background-rects.host-validation.json`

The pinned host is `hong-kong-map-sea-r03/publish-final/index.html`, SHA256 `54487b03d7314edb19ed3ed37aab47bb662c8633e05cf96fdef7d28ac10a4117`. The top-level R03 HTML is not the tested host.

## API

```js
const { clipTerrainOutsideRects, rectanglesFromManifest } = HKBackgroundRectClip;
const rectangles = rectanglesFromManifest(candidateManifest);
const outside = clipTerrainOutsideRects(hkV, hkI, rectangles);
```

`clipTerrainOutsideRects(positions, indices, rectangles, options = {})`:

- `positions`: Array, Float32Array or Float64Array, fixed interleaved stride 7: X, Y, Z, NX, NY, NZ, mask.
- `indices`: Array, Uint16Array or Uint32Array, three indices per triangle.
- `rectangles`: array of objects `{minX, minZ, maxX, maxZ}` in the same local XZ coordinates. Minima must be strictly below maxima; all bounds must be finite. No hidden padding, cell-center conversion or epsilon expansion.
- `options.traceSources`: optional boolean; requests a Uint32Array mapping each output triangle to its input triangle ordinal. Leave off in the live cache unless needed for QA.
- Result `positions`: a new Float64Array. The entire old vertex buffer is preserved as its exact numerical prefix; appended vertices follow it. Original vertices whose triangles were removed remain unused in this prefix. Coverage must be measured from indexed triangles, not unreferenced vertices.
- Result `indices`: a new Uint32Array. Every untouched nondegenerate triangle retains its original three indices and ordering. Input triangle order is retained with each cut triangle replaced in place by its outside fragments.
- Result `stats`: input/output counts, bbox candidates, clipped/removed triangles, degenerate/roundoff filtering counts, appended vertices and compensated projected-XZ area sums.
- Result `triangleSources`: present only when requested.

Both APIs are available through `require('./clip-background-rects.js')` in Node. The module has no fetch, DOM, WebGL or external-write dependencies.

## Exact host insertion point and required upload conversion

Run once after the original `hkV/hkI` generation, before `hkMeshData` is created:

```js
const candidateRects = HKBackgroundRectClip.rectanglesFromManifest(candidateManifest);
const outsideCache = HKBackgroundRectClip.clipTerrainOutsideRects(hkV, hkI, candidateRects);
const hkMeshData = hkMesh(Float32Array.from(outsideCache.positions), outsideCache.indices, 7);
```

**The explicit Float32Array conversion is required.** The pinned host's `hkMesh` uploads the supplied buffer directly and interprets its attributes as `gl.FLOAT`; passing the Float64Array directly would corrupt rendering. Float64 is retained through clipping and numerical QA to keep the original affine surface; GPU storage has the normal separately measured Float32 rounding. The pinned four integer-boundary patches and the old 30 m diagonal grid remain exactly outside the rectangles after that conversion.

Do not replace `hkHeights`, `hkMask`, `hkV`, `hkI` or the raw-source floor sampler with the cropped render geometry. This module does not change the sampling precedence for old versus new detail surfaces. The host integrator owns that separately.

**Prerequisite:** while building `hkI`, the existing cell-center `insideDetail` test must continue to include existing detail patches but must exclude these four new candidate patches. Otherwise complete 30 m cells are already missing before clipping, and exact subtraction cannot restore the missing outside parts. The module takes the intact old background index buffer, then removes only exact triangle/rectangle intersections.

## Geometry rules

1. A strict XZ bounding-box test avoids polygon allocation for distant triangles. In the pinned map only 1,106 of 1,458,866 input triangles reach clipping.
2. Each intersected convex polygon is partitioned against the four exact rectangle half-planes. Outside pieces are retained; the inside piece is discarded. Applying this to every rectangle computes the union subtraction, including adjacent, duplicate, nested and overlapping rectangles.
3. A bbox hit with only an edge/point touch, or with no triangle-area intersection, returns the original triangle without splitting it.
4. Rectangle-boundary vertices can exist in both closed polygon representations, but those edges carry zero area. This is compatible with half-open patch ownership and does not create duplicate interior coverage along adjacent patches.
5. New vertex height, three normal components and water-mask value are evaluated barycentrically from the original input triangle, not from a new terrain sample. Normals are not renormalized, masks are not rounded or reassigned. X/Z of an intersection is pinned exactly to the clipping bound.
6. Output fragments are convex and triangulated as fans. Winding must match the source triangle; zero-area fragments and wrong-sign roundoff fragments are filtered. Both input windings are legal. In this host, an upward-facing triangle has **negative signed XZ area**, so deleting all globally negative XZ areas would remove correct ground.
7. Zero-area source triangles are filtered, even outside the edited region; all other untouched source values/indices are preserved. The pinned host contains no filtered degenerate or wrong-sign fragments.
8. Boundary classification has no geometric epsilon. A narrow positive-width cut is not silently discarded. This is double-precision floating-point geometric clipping, not symbolic/rational arithmetic.
9. The cache contains only parts of original triangles. It never bridges to a new detail edge. A height discontinuity remains a separate explicit seam-design issue.

## Validation commands

From the workspace root:

```sh
node --test research/hk-main-map-next-r03/terrain/clip-background-rects.test.cjs
node research/hk-main-map-next-r03/terrain/validate-clip-host.cjs
```

The real-host audit defaults to `/workspace/shared/hk_kowloon_cedd_ground_r01/terrain-increment/manifest.json`; an explicit manifest path may be passed as its first CLI argument. It checks the exact host hash, reconstructs its existing background-generation loop, uses only existing patches in `insideDetail`, and writes only its local JSON receipt.

The 20 unit/property tests cover both windings, full removal, interior holes, bbox false positives, no-cut identity, touching vertices/edges, collinearity, thin cuts, four adjacent rectangles, overlapping/duplicate/nested rectangles, idempotence, degenerate filtering, large offsets, browser/CommonJS exports, invalid inputs, input immutability, independent output buffers, affine normals/masks/heights, and 600 deterministic random triangle/four-rectangle cases. Expected union area uses independent rectangle-intersection inclusion/exclusion.

## Pinned host result

- Source: 1,061,250 vertices, 1,458,866 triangles
- Bbox candidates: 1,106; positive-area cuts: 1,105
- Untouched original index triples: 1,457,761
- Fully removed source triangles: 926
- Appended vertices: 383; outside replacement triangles: 288
- Total output triangles: 1,458,049
- Removed union area: exactly 452,684 m²; area conservation passed
- Maximum indexed area remaining inside any new rectangle: 0 m²
- Maximum indexed area remaining after Float32 upload conversion: 0 m²
- New Float64 vertex height/attribute error against the original triangle: 0 in this audit
- Maximum Float32 height-plane rounding: approximately 0.0000017166 m
- 1,028 raw-source triangle-floor queries unchanged
- Raw heights, masks, source vertex/index arrays and pinned host bytes unchanged
- Zero degenerate or wrong-winding fragments in the pinned host
- Measured clip time: about 186 ms in the recorded Node run, with source tracing enabled; this is not a browser performance guarantee

This is geometry/source-preservation acceptance only. Browser rendering, host integration, new terrain data acceptance, building foundations, and any seam/joining design are outside this module's acceptance.
