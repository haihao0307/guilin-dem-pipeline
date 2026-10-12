# Host station finite-envelope audit

Audited 2026-10-12, before the next GPU run. This is a read-only source/CPU containment audit; no shader, construction parameter, original mother, or GPU state was changed. The only added artifact is this document.

## Result and scope

For the current default host binding and finite material age in [0,1], the station-local box

`X=[-61,70], Y=[-4,49], Z=[-224,30]`

contains every **real station-field zero surface** in the reviewed source. No omitted station ingredient was found. The following conservative union of domain/ingredient enclosures is itself strictly inside that box:

`X=[-58.124,69.5], Y=[-3.2,48], Z=[-221.130274,26.004]`.

These are conservative enclosure extrema, not asserted attained surface extrema. In particular, X=69.5, Y=-3.2 and Y=48 are limits of existing active-domain gates, deliberately looser than the physical objects.

Minimum lower/upper margins to the proposed box, by axis:

| Axis | Lower margin | Upper margin |
|---|---:|---:|
| X | 2.876m | 0.500m |
| Y | 0.800m | 1.000m |
| Z | 2.869726m | 3.996m |

Excluded as requested: `groundRay`'s land/sea/coast planes, sky, retained host terrain and street district, train and passengers. Id0 domain proxies are not surfaces. Id999 candidate overflow is a failure sentinel, not station geometry; it must continue to fail closed rather than be counted as an actual surface.

The score's hotel reservation is unbuilt and berth boats are unbuilt. Neither creates station-field candidate geometry. This proof does not authorize cropping them if future code adds them.

## Source snapshot

| File | SHA-256 at audit |
|---|---|
| `kowloon-station-r04/station-field.mjs` | `53aeb64f3d1eb769aab7bbdecd20c2734457f4109781ac06da7c55bfa6e20ad8` |
| `kowloon-station-r04/station-score.mjs` | `e4ba201e06037232536dff03ab3ff46a98fe4f813713e4df05af44fb5a3ac04b` |
| `kowloon-train88-r01/host-construction.mjs` | `f8fc83dfd2968fdbc9c6336d7edf90f1b0487473808b1bf168468c5a4c3ccbde` |
| `kowloon-train88-r01/runtime-entries.mjs` | `fe07176e29d7e0026d71b0fc97f2be3badc8ef08c398205210e5556584498efc` |

The source reader checked every call site of `recordPart`, `recordCoated` and `recordTimber` in `stationDomain`. The table below accounts for the five guarded domains and all candidate families outside those guards. Host parameters were evaluated by the actual `createStationBinding` using `qa/host-datums.json`, not re-created from a second railway model. The source snapshot was refreshed after the renderer owner shifted the six boarding-row benches to X=8.8; that change remains within the same audited shed gate and does not alter the envelope.

The runtime is `stationRayInterval` in `runtime-entries.mjs:13–16`, with the proposed box declared at line14. The comments at line11 currently list nominal architectural extrema. Their numbers such as -221.13 and 26 should not be read as including material displacement: the inflated values are -221.130274 and 26.004 in this enclosure.

## Domain-by-domain enclosure

Coordinates and dimensions below are station-local SI metres. An interval is conservatively closed even when the underlying branch inequality is strict. Source lines refer to the snapshot above.

### Existing guarded domains

If `box(p-center,half)<2`, then each coordinate lies strictly between `center-half-2` and `center+half+2`. Every actual candidate in that branch is evaluated only there. The else branch emits an id0 proxy with distance>=2, not an additional physical surface. Consequently this gate encloses all actual zeros of that branch, independent of the detailed material displacement or angular field inside it.

| Domain / candidate coverage | X | Y | Z | Source gate |
|---|---|---|---|---|
| Hall: brick walls, coated piers/bands/arches, roof/pediment/oculus, hall benches and legs | [-33.5,33.5] | [-3.2,17.2] | [-12.5,12.5] | `hallBound`, field lines42–69 |
| Tower: core/openings, frames, bands, all four clock faces/hands, belfry, dome and spire | [17.2,30.8] | [-2,48] | [-2.8,10.8] | `tb`, field lines71–89 |
| Shed: all three barrels/trusses, all 76 posts, longitudinal beams, platforms/copings, within-shed rails/sleepers, all 24 benches/legs, signs/lamps | [-36,36] | [-3,17] | [-149.2,-5.8] | `shedBox`, field lines91–118 |
| Goods shed/dock: slab, masonry piers and wall, coated lintels, roof and steel members | [32.5,50.5] | [-2.8,8.8] | [-103,-13] | `gb`, field lines123–134 |
| Covered passenger walk: slab, columns, roof and longitudinal members | [28.5,69.5] | [-2.1,7.1] | [8.8,17.2] | `wb`, field lines139–145 |

The gate proof establishes that adding the new global box does not remove any currently evaluated real zero. It is not a separate assertion that every existing domain gate perfectly covers all intended architecture before that gate was introduced.

### Candidates outside the guarded domains

Material amplitude arguments are in `material-envelope-proof.md` and its CPU assertions. For outward support we only need the negative side of `Delta=F-d`: concrete grows at most .00021m, stone at most .004m, and current adapted wood is bounded by .0002733515m. The table rounds the wood allowance upward to .000274m. Unpainted rail/truss iron has nonnegative Delta and does not enlarge its nominal support.

| Candidate family | X enclosure | Y enclosure | Z enclosure | Source |
|---|---|---|---|---|
| Hall floor | [-31.20021,31.20021] | [-.55021,.85021] | [-8.80021,8.80021] | field38 |
| Forecourt floor | [-31.20021,31.20021] | [-.25021,.85021] | [8.79979,14.80021] | field39 |
| Four entrance steps | [-4.704,4.704] | [-.154,.714] | [14.676,16.324] | field40 |
| Landward approach rails | [-25.78735,25.78735] | [-.0335,.0985] | [-221,-145] | field120 |
| Landward approach sleepers | [-26.230274,26.230274] | [-.165274,-.054726] | [-221.130274,-145] | field120 |
| Working-siding rails | [49.21265,50.78735] | [-.0335,.0985] | [-170,-12] | field136 |
| Working-siding sleepers | [48.769726,51.230274] | [-.165274,-.054726] | [-169.780274,-12.219726] | field137 |
| Quay solid | [57.596,60.004] | [-1.084,-.216] | [-175.004,26.004] | field147 |
| Left road curb | [-58.124,-57.876] | [-.344,-.016] | [-175.004,26.004] | field148 |
| Right road curb | [-43.124,-42.876] | [-.344,-.016] | [-175.004,26.004] | field148 |
| Host transfer-truss chords | [-10.15,30.15] | [9.155,10.945] | [-70.11,-17.39] | field155–158 |
| Host transfer-truss diagonals | [-11.294,31.294] | [9.206,10.894] | [-70.044,-17.456] | field159 |
| Host exit0/apron | [11.149790,13.416156] | [-.400210,.850325] | [-51.180931,-35.545119] | field162–168 |
| Host exit1/apron | [11.149790,13.416156] | [-.400210,.850325] | [-30.393931,-14.758119] | field162–168 |

Displayed exit bounds are rounded **outward** to six decimals. The combined union above used unrounded values except the intentionally enlarged wood allowance.

## Details requiring explicit checks

### Finite repetition does not create infinite approach rails

`rep(x,pitch,lo,hi)` clamps the selected integer cell index. A zero of a repeated finite box must therefore lie within the union of boxes at the finite allowed centers. Beyond the endpoint, the residual coordinate grows; it does not continue to repeat indefinitely.

The shed back is -145m. Approach steel center is -183m with half-length38m, giving [-221,-145]. Sleeper centers use index range `floor((-145-76)/.65)=-340` through `ceil(-145/.65)=-223`; the first center is -221m. Adding sleeper half-length .13m and the wood allowance gives -221.130274m. The branch `p.z<SHED_BACK` clips the approach family's upper endpoint to -145m. A CPU f32 conversion of the current first-index division also gives -340, not -341; the analytic containment does not rely on random surface samples.

The host omits the coincident active track from this station field in favor of the retained train/track render path. Its local remapping does not introduce any new extreme rail or sleeper centers; the outer centers remain -25 and25m. Host rail offset .752425m and head half-width .034925m give the X endpoints in the table. Rail crown is .0985m locally after the .25m vertical adapter.

### Relocated posts and benches remain in the shed domain

Actual evaluated host parameters contain 19 boarding-row post centers plus three unchanged rows of19, retaining76 total posts. The boarding-row centers range from -145 to -10m; the eight relocated centers are [-81.25,-88.75,-96.25,-103.75,-111.25,-118.75,-126.25,-133.75]. Neither the originals nor these relocated members approach the new global box.

All six boarding-row benches remain, giving24 across four rows. Their current centers are [-81.25,-88.75,-103.75,-111.25,-126.25,-133.75]. Their half-length1.7m, iron legs and wood relief all remain in the shed's existing active domain.

The initial read found all six boarding-row benches intersecting same-Z posts at X=10m. The renderer owner has since moved the full benches to X=8.8; the updated generator consumes `HOST_BENCH_ROW_X` and keeps the posts at X=10. The nominal transverse clearance is 1.2-.4-.42=.38m. Both old and new placements lie within the same shed gate. This update does not enlarge the proposed station box, and the bbox audit is not a broader collision-free furniture certification.

### Transfer truss exceeds its nominal endpoint span slightly

The transfer chord boxes extend to X=-10.15 and30.15m. Repeated diagonal cells have centers from -20 to20 in q.x, endpoints +/-1.25 and capsule radius .044; adding the q.x world offset10 gives X=[-11.294,31.294]. Therefore simply treating the words “40m span” as an exact X bound would omit diagonal tips. The actual tips are nevertheless well within the proposed box.

The truss bay gate selects centers from -70 through -17.5m. Material id3/seed97 has erosion only, so these iron bounds do not need an outward corrosion allowance.

### Exit profile top needs slope-aware vertical inflation

The exit is `max(top,bottom,bounds)` where top=(y-height)/sqrt(1+slope²), bottom=-.4-y, and bounds includes explicit X and Z planes. At a concrete zero, the nominal max is <=.00021m. Thus X/Z can extend by at most .00021m and y cannot fall below -.40021m. The greatest absolute slope is .33/.28, so the vertical allowance is `.00021*sqrt(1+(.33/.28)^2)=.000324586275...`m. The height profile's maximum .85 gives the conservative .850325m upper endpoint. No unbounded plane remains because the X/Z/bottom max terms are present.

## CPU verification performed

The local Node audit constructed the19 enclosures in the two tables and asserted each minimum/maximum lies strictly inside [-61,-4,-224]..[70,49,30]. It evaluated current host constructor output, checked post/bench counts and endpoint ranges, and printed the union and six margins recorded above. Every containment assertion passed. No CPU random ray/surface sampling was used as a substitute for the domain and primitive arguments.

The following minimal assertion reproduces the final enclosure arithmetic; the detailed numbers are derived in the table above:

```js
import assert from 'node:assert/strict';
const outerLo=[-61,-4,-224], outerHi=[70,49,30];
const provedLo=[-58.124,-3.2,-221.130274];
const provedHi=[69.5,48,26.004];
for(let a=0;a<3;a++) {
  assert(provedLo[a]>outerLo[a]);
  assert(provedHi[a]<outerHi[a]);
}
```

The test is arithmetic support for the source-derived proof, not an automated discovery of all geometry.

## Consequence for `stationRayInterval`

In real arithmetic, along any normalized station-local ray, no reviewed station zero exists before entrance to or after exit from the proposed box. Jumping only the outside segment to box entrance and terminating after box exit therefore removes empty space, not station solids. This reasoning does not alter the material field inside the box and does not depend on its local Lipschitz constant.

The implementation treats |direction component|<1e-7 as parallel. The preserved main camera's far distance is320m (`app.mjs:28`) and the sun shadow camera's far distance is90m (`morning-atmosphere.mjs:23`). In320m such an ignored component moves less than0.000032m, far smaller than the smallest0.5m clearance from the outer box to the conservative occupied enclosure. For these configured limits the near-parallel shortcut cannot turn an outside-slab ray into a missed station solid. An arbitrarily increased far range or nonfinite direction would need a fresh check.

The margins are large compared with ordinary f32 roundoff at this site's hundred-metre scale. This is not a formal bound on arbitrary float errors, invalid values or compiler behavior. It also does not prove the subsequent in-box ray-march step, candidate overflow behavior, shadow compositing or visual quality. Those remain separate checks.

Any added geometry, changed repetition limit, larger shed/site recipe, changed material amplitude beyond the documented envelope, or relocation outside the audited domains must invalidate/recompute this bound before reusing the skip.
