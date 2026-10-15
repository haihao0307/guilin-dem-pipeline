# 7-reference provisional Hong Kong through route

## Ready result

The new **34,734.793603 m** horizontal route runs from the retained old Kowloon approach through Hung Hom, provisional Tin Hau, beneath Lion Rock, the Sha Tin/University corridor, a new Tolo Harbour **southern-shore cutoff**, then the retained modern-rail geometric reference toward Lo Wu. It is an adjustable interpretation of the user's seven private sketches, not surveyed historical track.

- All seven references were viewed. Detailed southern, Lion Rock and bridge images override the whole-route image. The 1964 aerial image supplies relative yard layout only; no false historical ground control is inferred.
- Local registration allowances are 120–200 m; the whole-route overview is 400 m. Its independent CityU check differs by 310.208 m. Exactly fitted two-point similarities or three-point affine transforms have no spare degrees of freedom and do not establish survey accuracy.
- Piecewise quintic planar geometry has continuous position, tangent and curvature. Analytic minimum radius is **209.184146 m**. Full-line 1 m sampling and analytic join tests pass. No high-speed capability is claimed.
- The same constrained vertical profile drives rendered rail, vehicle position/pitch and the retained 120 Hz gravity input. Actual maximum grade is **5.902485‰**, under the editable **15‰ GAME ceiling**. Station level zones, analytic bounds and vertical derivative continuity pass.
- Current game advisory speeds are `min(80, sqrt(radius_m * 0.5) * 3.6)` km/h, with a 20 km/h yard advisory. These are authored tuning values, currently advisory rather than automatically enforced, and not railway operating approvals.

## Loader contract

Copy these four files together:

1. `install-rail-profile.mjs`
2. `route-runtime.mjs`
3. `vertical-profile-core.mjs`
4. `route-plan.json`

Await `installRailVerticalProfile({target: window})` before host construction. Repeated calls return the same installed API. The API immediately provides `displayRoutes`, `labels`, `conflicts`, `plan` and `constraints`. Its `create(originalRoute, terrainHeight)` returns the actual new driving route. The retained R02 three exact runtime patches need no replacement.

Keep source `HK.routes` unchanged when invoking the original `Q8`. Replace only the rendered planning-line array with `api.displayRoutes`; otherwise the supposed rollback curve could accidentally be rebuilt from new planning lines. `route.originalRoute` and `route.rollback()` preserve the supplied original identity without mutation. The old R03 source files are untouched.

Route API: `points`, `renderPoints`, `length`, `sample(s)`, `nearest([x,z])`, `stops`, `sections`, `verticalProfile`, `verticalValidation`, `metadata.routeTier`, `planSpectrum`, `yardAnchor`. A sample includes `p/f/right`, `grade`, `gradeRate`, `gradeSecond`, `role` (`surface/tunnel/bridge`), planar curvature and advisory speed. Distances use integrated horizontal arc length; the aggregate drive remains a horizontal-chainage game approximation, not exact 3D wheel travel.

## Yard and stops

Tin Hau centre: **EPSG:2326 E837820, N820950**, scene **[3820,7.25,6050]**, chainage **4773.840875115568 m**. Positive EN axis **[-0.11, 0.9939315871829408]**; right EN axis **[0.9939315871829408, 0.11]**. The main line has 620 m of exact straight and level track, sufficient for the yard's ±285 m footprint. The tested 570 m main-line deviation is below 1e-9 m. Registration uncertainty remains ±150 m as a planning allowance.

Five provisional stops preserve existing IDs for integration: `kowloon`, `hung_hom`, `second` (Tin Hau), `shatin` (the retained northern Sha Tin concept), and new `lo_wu`. These are not a newly asserted historical stopping pattern. The Hung Hom old concept point projects 173.44 m onto the new line; the northern Sha Tin concept projects 61.46 m. Their platform/site relationships still require review. No existing building is moved to disguise that discrepancy.

All exact chainages and heights are in `route-plan.json`; six geographic key anchors are in `key-anchors.json`. Planar units are metres, EPSG:2326; scene X=E−834000 and Z=827000−N. Authored rail Y uses the existing map display basis, not surveyed rail-top mPD.

### Provisional station ground calibration

Tin Hau rail top is **7.25 m in the existing scene display basis**, replacing the earlier arbitrary 10 m. The same 570 × 60 m envelope was sampled at 0.5 m (138,061 valid current-model points). Separate original CEDD 2020 bare-earth DTM review has 138,061 valid native mPD samples, with lawful display-datum support for 129,900; the southern 8,161 samples (5.91%) retain null datum conversion. Existing scene heights in that gap are used only as current-world game-design input. No datum extrapolation is claimed.

The valid DTM reference band |u|≤15 m has maximum 6.880101 m. Adding an explicit **0.35 m game trackbed allowance**, then rounding upward to a 0.05 m tuning increment, gives 7.25 m rail top and a **6.90 m hypothetical formation plane**. The 15 m band is a reference, not the complete five-track footprint: outer rail offset 15.2 m plus half-bed 1.85 m reaches 17.05 m. Full-envelope model comparison retains potential **0.241 m cut and 4.670 m fill** at local extremes; the narrower reference-band fill maximum is 4.140 m. These are height differences, not computed earthwork volumes. Source-era local depressions and substantial fill remain visible planning limitations. **Terrain, earthworks and foundations have not been changed or built.**

The plan, chainages and station order are byte-identical to the pre-calibration version. Full-line grade and the complete 620 m station level zone were regenerated from this height. Source hashes, sampling statistics and the chosen design formula are in `station-ground-design.json`. This is a provisional scene-relative layout, not measured historical rail-top elevation or engineering approval.

## Terrain, water and building evidence

- The declared **2,923.746661 m Lion Rock tunnel candidate** has all 585 sampled points beneath the same host DSM by more than 3 m. Sampled cover is **14.91–410.53 m**. This supports genuinely passing under the mountain. Endpoints remain planning limits, not verified portal faces; no tunnel lining or completed structure is claimed.
- The declared **2,896.796746 m southern-shore bridge candidate** includes water and land/approach spans. Of 580 five-metre samples, 222 fall in the retained coarse 30 m water mask: roughly **1.1 km** of sampled water coverage. Do not call the entire 2.9 km an over-sea span. The terrain is a DSM and the mask contains documented existing map edits; neither proves a historical coastline, navigational clearance or structural feasibility.
- The existing **642 displayed component bboxes** yield **40 XZ corridor candidates**, grouped at **3530–3745 m (11 objects)** and **4045–4230 m (29 objects)**. `conflict-markers.json` contains every ID, chainage, position and horizontal overlap measure. These are not confirmed 3D collisions: source mPD boxes require the actual per-model datum transform and solid-mesh test before comparison with rail display Y. Missing/unloaded regions remain unknown.
- Two bounded local avoidance trials shifted conflicts into other known boxes and were rejected. The west trial also tightened curvature. The registered route and explicit review markers are retained rather than moving buildings or claiming clearance. Yard-only bbox checks are a separate narrower result.

## Reproduce and review

From the existing workspace root:

```sh
python research/hk-route-sketch-r01/compile-plan.py
node research/hk-route-sketch-r01/test-route.mjs
node research/hk-route-sketch-r01/prepare-delivery.mjs
node research/hk-route-sketch-r01/test-route.mjs
```

`compile-plan.py` uses local private references and the locally saved official landmark response fixture. It never copies images into the runtime spectrum. The public runtime consumes only numeric polynomials and authored constraints; no source mesh or reference photo is requested.

`route-verification.json`, `plan-curvature-audit.json`, `terrain-water-audit.json`, `building-corridor-audit.json` and `conflict-markers.json` record the checks and limitations. Browser integration and final scene screenshots are separate host QA; Node tests alone do not prove that browser state.

`registration-public.json` contains reference IDs/hashes, GCPs, matrices, fit degrees of freedom, holdouts and official coordinate links. Private filenames and workspace paths are excluded. `registration-evidence.json`, images, intermediate rejection trials and `*.private.*` files are local-only, not on the public allowlist.

Official landmark coordinates come from the [Hong Kong Lands Department location search service](https://portal.csdi.gov.hk/csdi-webpage/apidoc/LocationSearchAPI); individual query URLs are retained beside each point. Facility/campus POIs are not interchangeable with surveyed track centres. The earlier vertical module's conceptual standards references remain in `research/hk-rail-profile-r01/README.md`; none makes 15‰ a universal standard.
