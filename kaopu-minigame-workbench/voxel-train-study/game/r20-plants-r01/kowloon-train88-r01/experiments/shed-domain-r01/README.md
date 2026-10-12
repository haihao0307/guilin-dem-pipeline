# Shed-empty-domain execution certificate, R01

This isolated experiment can omit the **compact trace executions of groups 4–8** only where their original source guard cannot run. It does not replace a distance, surface, material, normal, lettering curve, construction member, or ray advance. Group 3 and its exterior proxy always remain. Full metadata queries are outside this optimization's scope.

## Exact source fact and merge obligation

`geometry-groups.mjs:13–25` splits the original shed construction without changing `if(shedBox<2.)`. The original expression is:

```
box(p - vec3<f32>(0,7,SHED_CENTER), vec3<f32>(34,8,SHED_HALF+2.2))
SHED_CENTER = -77.5
SHED_HALF = 67.5
```

Only group 3 retains `else{recordPart(p,shedBox,0u,p,0.);}`. When the guard is false, groups 4–8 execute the common reset, record no candidates, and resolve to `HitField(10000,0,p,0,10000,[1,1,1],0)`. Raw count is zero; local overflow is false. `resolveStationState(p)` has no externally observable mutation. No material-bearing candidate is evaluated in that empty path.

This empty result is **not an identity for arbitrary previous texture contents**. For example, a previous distance of +Infinity or 10001 can be replaced by the empty 10000 result and its invalidity can be cleared. Omission therefore requires the existing canonical current-query prefix: group 0 initializes distance to 10000; winners replace it only on strict `<`; overflow sets it to 0. By induction its distance never exceeds 10000 and cannot become NaN via a winning comparison. Counts are nonnegative finite integers, flags are normalized, and the empty merge cannot replace a strict-tie winner or change invalidity. Zero raw contribution preserves exactly-96 and overflow behavior. The original physical material ID, seed, base distance and all subsequent winning comparisons are unchanged.

Nonfinite external trace contents or stale/uninitialized prefix textures are not authorized inputs to this certificate. The owner must keep canonical initialization, current-query rectangle coverage, source identity and frame immutability. A source/contract change must disable or re-audit the optimization; the source-lock test catches the audited guard/constants/reset/proxy changes.

## API and scope

`createShedRayCertificate({inverseProjection,cameraToLocal,width,height,flipY=0,precision})` snapshots both 16-element matrices to f32 and returns:

- `eligible(x,y)` / `pixelEligible(x,y)`: true means retain original construction; false means a certified whole-ray miss
- `partitionRects(rects)`: `{rects,totalPixels,queriedPixels,eligiblePixels,excludedPixels}`
- `key`, `qualified`, `reason`, and counters in `stats`

`clipShedEligibleRects(rects,certificate)` is also exported. Rectangles use original bottom-left integer pixels. Pixel centers remain `x+.5,y+.5` in the full viewport; no crop-relative ray, viewport change, or sampling-quad phase change occurs. Row runs merge vertically only when x and width match. The resulting rectangles are the exact disjoint eligible union. Empty arrays mean no draws. Null rectangles mean the full viewport.

The certificate is for offset=0 compact trace queries only. The caller must not reuse it for normal offsets, full geometry metadata, a changed frame, a different viewport, changed source, or noncanonical trace inputs. The cache key includes f32 matrix snapshots, dimensions, flip and reported precision. No persistent world field or new GPU attachment is created.

## Numerical model and fail-closed limits

The arithmetic model is the highp binary32 behavior of the generated GLSL ES 3.00 expressions. The relevant precision specification is [GLSL ES 3.00 revision 6, sections 4.5.1, 5.10–5.11 and 8.5](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf). Highp capability alone is not evidence that a particular driver is bug-free. Actual GPU comparison remains a separate acceptance gate.

The model admits rounded basic operations, arbitrary dot-product reduction order/FMA contraction, division errors up to 3 ULP (enclosing the 2.5-ULP specification), inverse-square-root errors up to 2 ULP, and three normalization lowerings: `v/length(v)`, `v*(1/length(v))`, and `v*inversesqrt(dot(v,v))`. Length encloses the reciprocal/inverse-square-root construction, including its division error. Both matrix associations `(camera*inverse)*v` and `camera*(inverse*v)` are enclosed. It does not claim to validate an arbitrary nonconforming driver, an unrelated shader rewrite, or new transcendental operations.

Every real interval endpoint is rounded outward by one binary64 successor/predecessor. Shader rounding expands by an absolute binary32 ULP bound derived from the exact binary64 exponent, without a hard-coded geometric epsilon. This ULP bound is at least twice the binary32 spacing for the largest endpoint magnitude; a minimum-normal floor also encloses subnormal flush-to-zero. For an n-term dot product, at most `2n-1` product/add roundings can occur; every intermediate magnitude is below twice the outward sum of absolute products S. The implemented `2n * ULPBound(2S)` expansion encloses those errors, including FMA paths with fewer roundings. Denominator intervals crossing zero immediately fail closed.

Qualification requires reported precision=23 and exponent ranges at least 127, viewport dimensions 1–16384, finite matrix entries with magnitude at most 2048, a nonzero unprojection-w interval separated from zero by at least 2^-32, finite positive ray length no greater than 4096, and a complete query-coordinate bound within ±2048. Any uncertain pixel stays eligible. NaN/Infinity, unknown capabilities, large coordinates, unbounded projection, degenerate normalization, unsupported viewport inputs, or arithmetic overflow never permit omission.

### Source-guard enclosure

The actual f32 shed z half-extent is 69.69999694824219. The certificate derives an outward AABB rather than treating decimal bounds as exact.

If any box q component is positive, the signed-box inner term is exactly zero. For max(q)>=2, the length computation's lower bound exceeds `max(q)*(1-32*2^-23)`: the three-term dot product has at most five elementary roundings; square root via inverse-square-root and reciprocal adds the bounded 2-ULP and 3-ULP errors. The 32-unit relative allowance strictly dominates their composition and possible subnormal flush terms in this range. Thus `shedBox<2` requires each positive q component to be less than `2/(1-32*2^-23)`.

For each axis, add separate ULP bounds for `p-center` and `abs(...)-half` over the qualified ±2048 coordinate range. The generated guard enclosure is approximately:

```
lo = [-36.00098419192365, -3.00098419192364, -149.20098114016585]
hi = [ 36.00098419192365, 17.00098419192364,   -5.79901885983416]
```

The additional query-coordinate error is derived per ray from the allowed t range and the multiply/add/+zero-offset operations. It inflates this box further, by computed ULP quantities. These are consequences of the arithmetic model, not a guessed .01 m margin.

### Entire ray, not its final hit

The original canonical initialization/advance ensure a queried active trace has `0 <= t <= stationFar <= hostRayLength`; escaped rays do not run construction on the next query. The certificate uses the larger interval `0 <= t <= upper(hostRayLength)`, avoiding a separate CPU reproduction of station slab clipping.

It computes intervals for the actual GPU origin, normalized direction and length. A slab interval uses the *lowest possible* entry and *highest possible* exit over admitted origins/directions, against the query-error-expanded guard box. Only an empty intersection across axes and the entire allowed t interval proves a miss. Parallel or sign-uncertain directions retain an axis unless its complete position interval is disjoint. Touching or overlapping bounds remain eligible. All three coordinate ranges are qualified before any early miss is accepted.

## Compact ping-pong protocol

The independently tested proposed mixed-domain protocol is:

1. Execute original groups 0–3 on all current query rectangles.
2. Copy group 3's compact prefix into the opposite existing one-attachment target on all those rectangles.
3. Execute original groups 4–8, with original index parity, only on the conservative eligible rectangle union.
4. Execute original groups 9–11 on all current rectangles, using the original parity.

Outside the eligible union, both targets retain the same canonical group-3 prefix, so the five empty merges can be absent. Inside it, all original merges execute in order. Group 9 therefore always reads the correct prefix. The copy must not read its own destination. Without the copy, skipping an odd number of passes while retaining original index parity would create feedback/stale-input errors. A whole-query no-copy optimization would instead need executed-pass parity and must not mix the two protocols.

## Current evidence and limits

Read-only analysis of saved `25c46099` attachment matrices, at the actual 640×426 pixel centers:

- Stone-arch 18×18 halo: nominal minimum rounded-box distance about 6.79581 across full station ray segments; the conservative interval certificate excludes all 324 rays.
- Inner-iron halo: nominal full-segment AABB intersections 16/324; three rays actually cross the rounded `<2` domain, with minima 1.97728, 1.92330 and 1.86913. The conservative certificate retains 167 rays and excludes 157. Its larger uncertainty is deliberate.
- Those three rays eventually hit at t about 85.8, before hypothetical shed entry around 158.2. Saved final traces are diagnostic only and are never runtime certificate inputs.
- Under recorded shrinking query rectangles, the conservative certificate excludes 77/144 iron pixels at checkpoint 112 and its remaining single pixel at checkpoint 128.

`node --test experiments/shed-domain-r01/ray-certificate.test.mjs` covers source identity, both halos, snapshots, nonfinite/precision/large-input fallback, boundary/inside/parallel/backward rays, 216 separate/FMA/division-perturbed/normalize cases, over 20,000 sampled f32 positions, exact rectangle unions and the two-target copy/merge proof, including invalidity, overflow and strict ties.

CPU tests establish a bounded numerical/model and scheduling contract. They do not establish GPU execution equivalence, all allowed backend implementations, performance benefit, whole-scene visual quality or native-hardware acceptance. Retain original execution whenever capability/source/model assumptions cannot be established. The parent integration must still compare all trace bytes and final retained attachments against the unchanged execution.
