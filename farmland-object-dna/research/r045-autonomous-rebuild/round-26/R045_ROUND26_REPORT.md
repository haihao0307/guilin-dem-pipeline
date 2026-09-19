# Farmland Mother R045.26 — nested receiving hierarchy

## Fixed result

- verified implementation: `a4976282d7c3e43369e5a19d87c888f526447bfb`
- machine-evidence commit: `90a1e78774ca85a6657824fc97513781171310d8`
- prior verified baseline: R045.25
- stage remains: one-sided agricultural slope + footslope receiving plain
- visualAcceptance: **false**
- terrace geometry: **locked**
- parcel generation: **locked**
- water state: **unknown**

## Logic correction before implementation

The weak fixed-view signal in R045.25 did **not** justify increasing vertical relief. Increasing amplitude would only make the same wrong or weak planform footprint more visible. R045.26 therefore changed hierarchy, footprint, longitudinal support and lateral occupation first, while keeping vertical relief shallow.

A second logic error was caught during QA: declaring three profiles `major / subordinate / local` in parameter names is not evidence that the final sampled geometry actually has that hierarchy. R045.26 therefore checks actual occupied samples and occupied longitudinal rows rather than accepting declarations.

## Substantive geometry change

R045.26 adds three deterministic outlet-coordinate receiving bodies tied to the three inherited R045.25 outlet carriers:

- A = **major**: `z 24..130`, width `82 -> 158 m`, strong lateral sweep and long support.
- B = **subordinate**: final width `62 -> 104 m`, `z 36..120`, opposite lateral sweep and shorter support.
- C = **local**: width `54 -> 88 m`, `z 48..108`, shortest support and independent bend.

Each body contains a broad shallow receiving hollow, a nested secondary recess and outer shoulder/counter-shoulder. The inherited drainage axes remain protected; the foreground receiving river is unchanged.

## Failure chain retained

### Failed iteration 1 — signed shoulders cancelled

Implementation commit: `4493dade62a65ba3cbd0d15c56ddce22b01a3919`.

Numeric QA reached 34/35, but `signed_shoulders_survive` failed because the nominal positive shoulders were placed inside the broad receiving hollow and were cancelled in the final signed terrain. The geometry was changed by moving shoulders farther outside the hollow. The QA gate was not weakened.

### Failed iteration 2 — declared scale hierarchy did not survive sampling

Implementation commit: `fefd40febdab2d61a6db9762026ca834be3bb764`.

After the shoulder repair, signed shoulders survived, but QA was still 34/35: actual occupied sample counts were A/B/C = `401 / 379 / 196`. A was only ~5.8% larger than B and therefore did not satisfy the pre-existing >12% major-to-subordinate footprint gate. The gate was not relaxed. Instead B was narrowed from `68 -> 118 m` to `62 -> 104 m`, and its secondary amplitude was reduced slightly.

### Final iteration

Implementation commit: `a4976282d7c3e43369e5a19d87c888f526447bfb`.

Final actual occupied samples are A/B/C = **401 / 351 / 196**, with occupied longitudinal rows **16 / 12 / 8**. The declared major / subordinate / local hierarchy therefore survives in the sampled final geometry.

## Final numeric QA

Final result: **35/35 passed**.

Key metrics:

- maximum R26 terrain delta: **0.1699168 m**
- mean absolute delta across 2,156 review samples: **0.0358582 m**
- core mean absolute delta: **0.0527512 m**
- max change in the added field per 4 m longitudinal step: **0.0600143 m**
- final positive shoulder mass / negative receiving mass: **0.00993**
- component occupied samples: **401 / 351 / 196**
- component occupied rows: **16 / 12 / 8**
- minimum component-centroid separation: **81.5109 m**
- whole-scene occupied-cell count range across review rows: **50**
- whole-scene weighted planform-centroid range: **110.2101 m**
- inherited upper work change: **0**
- inherited drainage-axis protected-zone change: **0**
- foreground receiver change: **0**
- outside-support change: **0**
- R045.25 worst sampled 4 m uphill rise: **0.3700243 m**
- R045.26 worst sampled 4 m uphill rise: **0.3707798 m**
- terrace permission max change: **0**
- terrace permission near drainage mean: **0**
- future far-from-drainage terrace candidate mean: **0.6814326**

## Browser startup and fixed-view evidence

Real `/usr/bin/google-chrome` was run by the final workflow. Screenshot process = 0, DOM process = 0, `data-ready=true` detected, screenshot = **567,344 bytes**, browser gate = **passed**.

The full 1400×900 final screenshot was downloaded from the successful Actions artifact and manually inspected after the machine gates passed.

## Visual review

R045.26 is **not visually accepted yet**.

What changed visibly:

- The bottom plan audit now clearly shows three unequal receiving masses rather than one uniform lower-plain treatment.
- A/B/C occupy different longitudinal spans and different lateral positions; the hierarchy is no longer only a parameter declaration.
- No new gross seam, wall, receiver break or obvious drainage-axis disturbance is visible in the final fixed view.

What still fails visual acceptance:

- In the main perspective, R045.25 -> R045.26 remains subtle. The lower plain is still read primarily as one broad smooth surface.
- The major / subordinate / local hierarchy is much clearer in plan audit than in the whole-scene perspective.
- The agricultural slope -> footslope -> receiving-plain transition still lacks enough visible nested massing to justify unlocking terraces.
- Upper/mid-slope long valley-shoulder rhythms remain more repetitive than the user reference.

Therefore terrace bench+riser geometry, parcels, parcel-by-parcel irrigation, roads and task layers remain locked.

## Evidence use this round

- **Xiaoma / TLO**: reread the canonical DEM intake boundary. The ~12.5 m macro terrain basis is suitable for macro terrain organization but does not establish surveyed field boundaries, terrace/bund/channel cross-sections, control elevations or hydraulic state.
- **MrRolord**: reread the saved video-frame audit. Only the ordering `river hierarchy -> accumulated terrain fields -> land use` was reused. Blender dimensions and Voronoi styling were not copied as agricultural truth.
- **User reference**: `image(173).png` was reopened. It was used only for visible unequal, curved, nested contour occupation and non-uniform lower transitions. No terrace width, riser height, channel size, water depth or regional metric was inferred from the photograph.

## Real-world constraint

Without site-specific meter-scale microtopography, measured terrace/bund/channel sections, control elevations and real water-management observations, an ordinary reconstruction cannot quickly derive true terrace hydraulics from the current 12.5 m macro DEM and photographs. R045.26 dimensions and sub-meter relief are synthetic generation parameters for morphology/QA, not surveyed Yunnan engineering dimensions.

## Next blocking issue

The single most important blocker remains whole-scene legibility of the footslope receiving hierarchy. The next round should strengthen **nested planform massing and connection into the one-sided agricultural slope**, not simply increase vertical amplitude and not draw terrace stripes prematurely.
