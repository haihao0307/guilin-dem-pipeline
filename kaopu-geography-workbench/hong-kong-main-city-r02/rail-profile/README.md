# HK Train 88: constrained GAME vertical profile, R01

Local, reversible module for the retained railway and the R02 staging host. No production page or source integration bundle is edited by these scripts. The three runtime patches are frozen for the current R02 review.

## Checked result

- Original terrain-following maximum: **662.166904‰ (33.511208°)**. Its steepest 25.753475 m horizontal segment rises 17.053098 m. Maximum adjacent grade jump: 620.890966‰.
- Proposed maximum: **5.416927‰ (0.310364°)**, below the explicitly chosen **15‰ GAME ceiling**. Four station level zones have zero grade.
- All 611 original horizontal points, horizontal chainages, 15,703.434096760362 m route length, four stop IDs, order and station chainages are unchanged. Whole-line 1 m horizontal comparison has zero error.
- Whole-line 1 m sampling, every polynomial endpoint and exact analytic extrema pass. Vertical join height error is at most 1.78e-15 m; first, second and third height-derivative differences are zero. The original horizontal corners remain, including a 75.698° turn. This is vertical smoothness, not a claim of a globally smooth 3D railway.
- The retained real 120 Hz game drive receives the same profile grade at every fixed step. At chainage 900 m, grade is 5.416927‰ and the tested gravity force is −10,893.552095 N. Real Three.js yaw/pitch forward-vector error is below 7.1e-16.
- Fixed horizontal routing and low vertical anchors produce roughly 8.24 km of sampled tunnel candidates and 1.78 km of bridge candidates, with maximum sampled terrain cover about 483.33 m. These are unbuilt geometric classifications, not engineered structures. The height is not bent around mountains.

## Reproduce

Run from this workspace root, using its existing Node.js and retained source files:

```sh
node research/hk-rail-profile-r01/extract-original-route.mjs
node research/hk-rail-profile-r01/test-vertical-profile.mjs
node research/hk-rail-profile-r01/test-runtime-integration.mjs
```

Outputs are `original-grade-audit.json`, `profile-verification.json`, `profile-candidate.json`, `bridge-tunnel-candidates.json` and `runtime-integration-tests.json`. The first two large `hk_*_data.json` fixtures retain the correct R03 published host's terrain payload for local reproduction. The extractor also replays the retained airport terrain edits; it does not test against an unrelated generic DEM.

The correct source host is `hong-kong-map-sea-r03/publish-final/index.html`, SHA-256 `54487b03d7314edb19ed3ed37aab47bb662c8633e05cf96fdef7d28ac10a4117`. The retained integration is `hong-kong-main-city-r01/integration-aligned.js`, SHA-256 `137b21db65659b43658d51958a7ac2e4d05a4a2068765bd3af894a9b8ac3c286`.

## Editable constraints and coordinates

`game-design-constraints.json` declares the game design choices: ceiling 15‰, station ceiling 1‰ (generated station grade is exactly zero), conservative vertical curvature bound 1/6000 m⁻¹, preferred grade-transition length 250 m and minimum 25 m. These are editable authored parameters, not universally applicable railway standards. The current install module's visible design label contains the frozen 15‰ value: update that label together with the configuration in a future revision, then rerun both test suites.

All coordinates are metres. X = HK1980 easting − 834000; Z = 827000 − northing; Y uses the retained map's EGM2008_model display basis. These authored rail anchors are not surveyed rail-top levels or mPD values:

| Anchor | Horizontal chainage m | Rail height m | Level zone |
|---|---:|---:|---|
| Kowloon | 205 | 3.986 | 0–355 m |
| Hung Hom | 1810.4846388257383 | 9.703483697890459 | ±150 m |
| second (retained ID) | 4933.2666310815 | 9.363315484522934 | ±150 m |
| Sha Tin | 15658.434096760362 | 9.35 | −150 m through route end |

Kowloon's old sampled rail height was 4.323163160373464 m. Its new 3.986 m anchor deliberately uses the old route's authored start datum, reducing that station rail height by 0.337163160373464 m. The other three station heights are retained. Endpoint anchors are also explicit. Level zones clamp to the route extent. No verified turnout positions were supplied: additional turnouts must be added as explicit flat-zone anchors before claiming they have been checked. A synthetic registered turnout regression proves the supported constraint, not the existence or completeness of real turnout data.

Horizontal chainage is preserved; physical 3D rail length necessarily changes with vertical alignment: approximately 15,764.015679 m before and 15,703.448810 m after. The existing aggregate drive still interprets distance as horizontal chainage. Wheel travel is not remapped to exact 3D arc length.

## Generator and failure contract

Between exact level zones, the generator joins a rising grade transition, a constant grade and a falling grade transition. Grade uses the monotone quintic `S(u)=10u³−15u⁴+6u⁵`; integrating it produces the height curve. Height and its first three derivatives agree at every join. This is an authored smooth game curve, not an implementation claiming conformance to a specific parabolic/circular engineering standard.

For free length L, height change Δ and equal transition lengths R, peak grade is Δ/(L−R). The exact maximum grade-rate magnitude is `1.875*abs(grade)/R`. The solver bounds R by both grade and conservative curvature constraints, then chooses the preferred feasible length. It fails with typed `ProfileConstraintError` on conflicting overlapping zones, infeasible height/grade/curvature demands, nonfinite coordinates, changed horizontal plans, changed station chainages, or incompatible driving limits. It does not move anchors or modify horizontal geometry to hide a conflict.

Original `route` and input constraints are not mutated. `newRoute.originalRoute` and `newRoute.rollback()` retain the old curve. Reverting the three composed runtime patches restores the existing behavior. The frozen host uses default positive sampling steps of 1 m for validation and 5 m for rendering; callers must supply positive finite custom sampling steps.

## Builder integration

Copy `vertical-profile.mjs`, `runtime-patch.mjs`, `install-rail-profile.mjs` and `game-design-constraints.json` together. Await `installRailVerticalProfile()` before booting the retained host. After the existing bundle SHA/projection gate, apply `patchRailVerticalRuntime(source).text`; each of the three source anchors must match exactly once or the module throws.

1. Create the constrained route and give `renderPoints` to the track renderer.
2. Call `HKRailVertical.stepDrive(drive, route, elapsedSeconds)` in place of the previous direct drive tick. It preserves fixed-step time rather than dropping a surplus batch; excessive batch budgets fail explicitly.
3. Set the locomotive Euler rotation to the same profile yaw/pitch in `YZX` order.

Runtime APIs:

- `window.HKRailVertical.route === window.HKTrain88.route` must be true after integration.
- `route.sample(d)` returns unchanged XZ, constrained Y, unit forward/right vectors, `grade`, `gradeRate` and `gradeSecond`. Grade is rise divided by horizontal run, not degrees or percent.
- `route.verticalProfile.segments` holds independent start/end, height, grade and polynomial kind; `verticalValidation` holds analytic bounds, all join differences and anchor checks.
- `HKTrain88.drive.snapshot().controls.grade` is readable. `drive.controls` itself is a setter function. `getState().state.controls.grade` is the last host snapshot. A paused review seek must be followed by a runtime tick before expecting physics controls to correspond to that new location.
- Nonlevel diagnostic location: `d=900`; expected grade = 0.005416927435581959.
- `route.terrainCandidateAt(d)` classifies actual terrain clearance independently; it never feeds terrain height back into profile generation.
- Original `sample.role` is preserved. The existing tunnel-only cutaway remains unchanged. New tunnel candidates have no lining and are not automatically given a completed-tunnel appearance.

This module does not validate horizontal curve forces, multi-axle suspension, real locomotive performance, geotechnics, hydrology, structural clearances, construction or operating safety. Final browser integration remains an independent host QA responsibility; the local regression report is not proof of that browser state.

## Official conceptual references

These references justify checking vertical transitions and context-dependent limits. Their numerical requirements are not copied into this game's 15‰ setting.

- [RSSB GCRT5021 Issue 6, December 2023, §2.7](https://consultations.rssb.co.uk/_entity/sharepointdocumentlocation/e755957b-950b-ee11-8f6e-000d3aba3cb5/2ab10dab-d681-4911-b881-cc99413f07b6?file=06.+GCRT5021+Issue+6.pdf): describes constant-grade sections joined by vertical curves; gradient design depends on traction, braking, stopping, adhesion and horizontal curvature. It advises avoiding switches/crossings on vertical curves. Its scope is Great Britain, not Hong Kong. This is the RSSB-hosted December 2023 document, not a claim that this is the latest applicable standard everywhere.
- [RSSB December 2023 publication update](https://www.rssb.co.uk/standards/using-standards/latest-updates-to-standards/december-2023-standards-update): records the Issue 6 publication.
- [Hong Kong EMSD railway safety regulation](https://www.emsd.gov.hk/m/en/railway_safety/regulating_railway_safety/): describes project safety review across design, construction, testing and commissioning. A game geometry pass does not replace that process.

Sources checked 2026-10-15. No downloaded standards text is redistributed with this module.
