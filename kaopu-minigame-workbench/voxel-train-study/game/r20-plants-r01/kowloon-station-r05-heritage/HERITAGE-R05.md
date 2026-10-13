# Kowloon heritage R05, independent architectural candidate

The retained R04 and driving entries remain unchanged. This candidate is not a historical facsimile and has not yet passed whole-game visual or interactive-performance acceptance.

## Evidence and decisions

Reference: [Antiquities and Monuments Office, Clock Tower pamphlet, © 2024](https://www.amo.gov.hk/filemanager/amo/common/download-area/pamphlet/clock_tower.pdf). Page 3 reproduces 1977 tower elevation/section and terminal west elevation. Page 5 describes and photographs the tower fabric. Page 7 credits measured drawings to HKU Architecture. Reference images/scans are not included in this repository.

Observed architectural facts used: red brick and granite, square main shaft, octagonal upper stages, concrete dome, timber rectangular windows and pediment surrounds. R05 replaces the old four-corner open belfry and copper-labelled shell accordingly. The hall's giant-order reading is strengthened using actual layered pilaster returns and retained source construction.

Authored interpretation: all new member dimensions, exact window levels, octagonal profiles, the hall's added 54 profile members, conservation colour/maintenance parameters and exposure response. Existing hall 60 × 16 m plan remains a design assumption. The four-column entrance and old cream dial are preserved authored choices, not claims of a specific period reconstruction. Current clock glazing is not used as evidence of 1970 appearance.

Unresolved: official 44 m tower height versus 7 m rod datum. R05 keeps the existing approximate vertical envelope and marks its short visible support provisional; it does not claim a 51 m total or a recovered 7 m mast. Detailed survey dimensions, hall depth, glass transport and period clock construction remain unverified. The original generic stone surface was not calibrated as granite. The isolated C candidate now ports the existing kind-2 granite equations with an explicitly authored metre bridge; its physical mineralogy is still uncalibrated.

## Function/material construction

The six source mother modules remain byte-identical to SOURCE_LOCK.json. Conservation is confined to tower and above-ground hall members. The shared station age, ground, platform, site, road and quay recipes stay unchanged. Brick relief, stone relief, timber grain and metal weathering still come from their respective original mothers. Rain paths and sheltered cornice bands modulate small amounts of retained patina; no uniform black-grunge overlay is added.

The dome is a finite nominal-160 mm authored concrete shell, with new material ID 19. It cannot trigger the ID 17 ground/floor acceleration path. Following the first native close-up, the previously shallow brick recesses are corrected to openings through an authored 0.63 m masonry shell into real interior voids separated by the retained solid cornice bands. Four finite interior plaster linings share the same window cuts and use the unchanged plaster mother, physical thickness and sheltered history. Sixteen finite granite-coloured tympana close the previously open pediment frames. Timber frame members retain their verified local grain coordinates and source identities. No opaque window decal substitutes for missing glass transport.

## Review scope

qa/inspection-scope.mjs provides tower-only and hall-only diagnostic views by copying their complete construction blocks without changing their geometry or material functions. These views omit the other station buildings and their shadows, and cannot establish whole-station integration or frame rate. Without a scope parameter the entry retains the complete station field. Unresolved rays stay explicit failures.

Checks: source/mother locks, geometry and floor bounds, original component retention, WGSL lexical/signed-number checks, new heritage contracts, actual WebGPU compilation and rendered view readback. CPU checks alone are not visual approval. See CI artifacts and the current review receipt for performed versus pending checks.

## Verified state-history correction

Run [38333972975](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38333972975) reproduced a shading-distance mismatch caused by applying the non-idempotent conservation history twice. The maximum observed mismatch was 19.04 micrometres. Passing raw state to the shared geometry evaluator fixed all 27 actual GPU samples (zero observed distance differences); four original member controls at all three ages retained identical readbacks. This is a numeric material-consistency result, not visual acceptance.

The controlled R04 native-focus baseline passed on run 38332496309. The R05 integration and original monolithic timber diagnostic encountered a SwiftShader SPIR-V ID overflow and GPU process failure. The first native window crop completed on run 38335759865, but failed architectural review because its shallow recess left visible brick behind the sash. That original result is retained as a failed comparison, not an accepted image. No publication or whole-frame quality/performance acceptance follows from these checks.

The adopted single-loop timber emitter passed 38,592 GPU comparisons on run [38334886889](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38334886889): all 12 compared HitField/physical-distance values had zero observed difference. The reference retained all 144 children in 16 original-order GPU slices and exact reconstruction hashes. The sample set covers each member's faces/edges/corners and adjacent window/stone points; 112 members became final winners in this set. This finite-domain result is not a proof over every possible point. The original expanded reference remains in qa/heritage-timber-unrolled-reference.mjs.


## First larger review and correction status

At commit 96c6b12d8128b784c64c54f5bab1e8d9fbf7a226, all three 18 × 18 native smoke crops completed with finite material/normal readbacks and zero unresolved rays. The 192 × 192 tower-window crop also completed with 36,864 hits and zero unresolved rays. Visual inspection rejected the filled-in appearance behind the sash. The finite wall, inner lining and connected opening correction described above is an authored construction decision, not a claim that its dimensions have been recovered from the survey.

The 360 × 180 hall query completed with 57,212 hits and zero unresolved rays, but the screenshot runner's old 30-minute page wait expired around final readback and closed the browser without saving an image. This is a capture deadline failure, not evidence of invalid geometry or a successful visual review. The runner now uses the existing four-minute GPU-progress watchdog and the explicit workflow wall limit for frame completion. Startup and module checks still have separate 45-second limits.

The cavity correction preserves the GPU-verified 144-child timber function and its direction function byte-for-byte; all member indices, frames and source seeds are identical. A new site lock verifies 12 unchanged construction modules and the complete shed/ground/site field suffix against fixed baseline 25c460991397665e2ad9068e79a93b2b16b80484. Incidental extra end-of-file newlines in five copied modules and the field suffix were restored to those exact source bytes. No ground or shed function changed.

The next review must rerun the production geometry/matter closure with the new inner-lining fixture (30 numeric samples), the three native smoke views, and independent ordinary-perspective architectural crops. These CPU/source contracts do not establish image acceptance. The retained solid cornice bands at 8.1 m and 18.9 m still divide the interior. Glass transport and a surveyed interior/floor/stair reconstruction remain outside what has been verified.

The corresponding tower-whole readback also finished (25,831 hits, zero unresolved rays) and lost its screenshot to that same old 30-minute capture wait. Both raw failure receipts are retained. The next image stage is deliberately small: native 320 × 213 perspective canvas, with 70 × 170 whole-tower, 96 × 96 window, and 180 × 90 hall crops. Larger crops are not launched until these are visually inspected. The small-render step is limited to 20 minutes inside a 25-minute job; the 18 × 18 smoke step to 10 minutes inside a 15-minute job. Completed images/readbacks are saved before acceptance assertions.


## Native small images and next finite-wall correction

Run 38339804283 at model 92054936 completed the 30 production material samples with zero geometry/matter distance differences. All previous 27 fixture readbacks were identical to the prior verified result. All three native 18 × 18 smoke views completed with zero unresolved rays. The unchanged hall smoke's 10,368 channels were bit-identical to 96c6b12d. In the same window smoke, 270 previously blocked brick hits became 270 actual back-lining hits, with timber and stone framing retained.

The 320 × 213 native canvas produced the window and whole-tower review crops. These are preserved under qa/review-92054936. The window void/lining correction is visible. The whole view exposed the overly open lantern: the current photo shows broad red-brick faces interrupting its openings. The next candidate therefore adds four finite diagonal brick facets behind the retained edge columns, retaining four open axial bays. Fourfold continuation, 1.68 × 4.46 × 0.36 m sections and exact placement are authored interpretations of the visible fabric, not recovered measurements. Each facet is physically evaluated before union, with the unchanged brick mother in a proper tangent-metre frame, identically used by geometry and matter. All old timber member indices and both verified timber functions remain unchanged.

The small hall run reached normal group 8 but was terminated at its explicit 20-minute Actions step cap. This was not the earlier hidden 30-minute page wait and did not finish final readback. Its failure receipt is preserved. Observed single-group completion times reached 93.28 seconds, so the 240-second no-progress watchdog remains appropriate. Observed full-view work had already exceeded 31 minutes; image steps now allow 40 minutes inside 45-minute jobs, rather than shortening their limit based on pixel count. Smoke steps allow 15 minutes inside 20-minute jobs; browser/module startup stays 45 seconds.

Hall recovery is independent of the new lantern candidate and is pinned to immutable model 92054936. Its 180 × 90 core is split into three 60 × 90 tiles at the same 320 × 213 viewport and ordinary perspective lens. Each tile carries two physical halo pixels, retains the entire unchanged shadow map, and preserves the original shaders and all 12 normal groups. Completed pictures, eight raw attachments, full-shadow bits, field/actual shader hashes and camera/lighting state are saved atomically per tile and per run attempt. The second halo pixel gives shared comparison pixels complete derivative neighbourhoods. The assembler refuses nonidentical overlap bits, nonidentical full shadows or mismatched composed overlap pixels, then copies only native core pixels without interpolation. Failed tiles can be retried without redoing completed independent jobs. This is completed-tile persistence, not an implemented mid-normal-group GPU-state restore.

No normal group has been omitted: the current grouped query contract also carries raw counts, overflow and tie order, so a centre-point object or material ID is not a whole-draw exclusion certificate. The new finite-wall candidate and tile assembly still require actual GPU/image evidence before acceptance.


## Completed small review and one readable material crop

Run 38344011903 finished all ten jobs. The upper brick facets, window void and complete window surround are visible in the native small tower images, with zero unresolved rays. The frozen 92054936 hall was exactly assembled from three independent tiles: 24,064 raw overlap channels and 368 safe composed pixels had zero differences, with identical complete shadow data. These images are preserved under qa/review-04e5ac12; full numeric and visual limitations are listed in qa/NATIVE-REVIEW-04e5.md.

Small-view review still finds high brick contrast and heavy grey stone. This is not accepted conservation appearance. Before altering the original material's physical scale, colour or roughness binding, one 224 × 360 native window-surround crop is being captured from the same frozen 04e5ac12 model, using four independently persistent 112 × 180 cores and the verified two-pixel overlap method. No additional geometry or material alteration is included in that capture.


## Single brick-identity correction, pending matched GPU review

The actual small-image readback exposed an interface error in the existing station binding: the local brick coordinate used a staggered row/column, while its seed used the unrelated x+z cell. Of 342 front-facing sampled bricks with at least two samples, 223 contained multiple old seeds. A wall-normal shift of 0.5 mm could also change the identity. This is not a geometry/matter disagreement: both routes consistently used the same incorrect identity. Details and evidence limits are in qa/BRICK-IDENTITY-AUDIT.md.

The new StationBrickSample returns both local coordinates and the seed from the same row/staggered column, only for heritage brick roles 71/175/191. Both geometry and matter call this one helper. Non-heritage branches retain the original brickQ and old seed expression. Six locked material mothers, all architecture dimensions, brick variation .42, pitch, mortar/recess, palette, roughness, age and maintenance response, lighting and shared receiver remain unchanged. This single-interface change is intentionally isolated from any aesthetic tuning.

CPU/source checks pass 48 tests and tile utilities pass 10 synthetic tests. An expanded production-mother probe is prepared for 31 fixtures at three ages: 93 cases covering the observed same-brick discontinuity, normal perturbations, actual cell boundaries, negative rows/columns, both material axes, local lantern coordinates and non-heritage controls. Helper q/seed must be finite; seed equality is exact and q is compared with an independent double expectation within 8 micrometres to allow float32 arithmetic. The original 11 displacement fixtures remain anti-stub controls. Added identity points may legitimately be on a flat brick-face interior, so they are not forced to have nonzero relief. Nine unchanged non-brick fixtures at all three ages are compared with the saved actual 04e5 GPU values. These are prepared checks, not yet a GPU pass.

The host-source B hash is 1141b25a06b4d2b0f27476dee41708ac09196a9136aeb26e405d34e1f3512f2c. Replacing only the new matter module with the frozen original reconstructs the A host hash exactly, 3759df8a7408503cffd8630a287cfb9fdde50ac8328edef51dad5a458c527a31. The original four-tile 224 × 360 A capture is preserved before starting an otherwise identical B capture. Neither the identity repair nor a correct numeric pass alone establishes conservation appearance.


## B identity result and isolated granite C candidate

Run [38348672858](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38348672858) passed all five jobs. All 93 actual production material samples passed with geometry/matter distance differences zero; 66 brick identity checks passed and 27 non-brick control records stayed exact. Its matched native 224 × 360 window is preserved under `qa/review-window-B-1f46`. All 77,824 raw overlap channels and 1,192 safe composed pixels match exactly. The A/B cameras, atmosphere, fog, lighting and all shadow readback bits match. The image verifies corrected brick identity, not completed material quality. In particular, the curved stone veins still read as limestone rather than fine granite.

C therefore changes only tower stone id 2 / seed 171 to the source study's original kind 2. The six older mothers, architecture, brick B identity/palette, ground and sheds remain frozen. Hall/quay stone and id 13 plaster substrates still use their old leaf. `qa/granite-binding.test.mjs` reverses the complete declared binding changes and checks exact B source hashes.

The new leaf retains original crystal, mineral, pigment, roughness and height equations. The explicit 0.026 m/source-unit bridge gives a nominal 2 mm unwarped crystal grid. This is an authored scale choice, not a measured granite grain distribution. Height converts to metres exactly once and is identical in geometry and appearance. The source nearest-cell height has discontinuities up to 78 micrometres at this scale, so it is not a smooth or conservative SDF. Actual stepping/normal review remains required.

The new, separately documented material footprint bridge uses four same-source tangent-plane samples and a continuous source-response ensemble for unresolved crystal identity. Original region/weather octaves likewise tend to their declared mean once unresolved. It averages linear colour responses, does not inject new grain noise and never filters or substitutes source geometry. This finite-quadrature/statistical approximation is not exact anisotropic pixel integration, BRDF integration or measured material calibration. See `sources/granite.json` for all assumptions and source hashes.

Prepared verification: 60 CPU/source tests pass; the actual GPU gate repeats 93 production samples, checks 90 non-target B records exactly, and separately compares original GLSL versus WGSL granite at 32 points plus six footprints. Those gates precede a single same-camera 224 × 360 C window assembled from four persistent native tiles. At this commit, C Naga/GPU/image results are pending; no new visual or real-time performance acceptance is claimed. After readable material review, the next architectural review returns to the whole tower and hall composition.
