# Farmland Mother R045.81 — fixed acceptance record

Accepted source SHA: `5663554ed23f4b3fad0697fe7868d52ab4dd9d58`  
Persisted evidence commit: `f282d9bf430362c60df44eb2dfb3680da2319a75`  
QA contract: `R045.81-full-carrier-bench-riser-profile-v1`

## Real change
R080 proved that a phase-window correction could touch three terrace families while still producing only 23 isolated physical changes and zero long same-identity runs. R081 therefore does not lower the continuity gate. It rebuilds from accepted R078 and applies a zero-end `concentrated stair - linear ramp` residual over the full already-accepted terrace carrier. Footprint, family, exact stair identity, inherited base, hard drainage and foreground receiver protection stay frozen.

## Authoritative result
Numeric QA: **21/21 passed**. Accepted-carrier candidates 99; opportunities 98; physical changes 98 (98.99% carrier coverage, 100% opportunity realization). All three inherited families participate. Profile bands changed: lower bench 40, riser 6, upper bench 52. Same-family + exact-stair long runs: 9; largest 16 cells spanning 43.680659 m. Maximum R081-R078 authoritative-node change: 0.006 m. Predecessor-relative 3 m construction bound: 1.042031120 m, below the fixed 1.045 proof target and 1.05 cliff gate. Frozen identity errors are zero; negative-guard leak is zero.

Browser QA: real `/usr/bin/google-chrome`, screenshot/DOM/`data-ready=true` all passed. 1400×900 fixed-view PNG: 182747 bytes. Provenance gate passed before evidence persistence.

## Human fixed-view review
The plan audit now shows broad, continuous orange carrier participation instead of R080's isolated points, matching the numeric long-run result. The fixed perspective A/B remains visually almost indistinguishable at hillside scale because the new vertical correction is capped at 6 mm. No new cross-slope wall, drainage blockage, receiver break or visible seam is present. Therefore `visualAcceptance=false` remains correct: this round fixes continuity of the physical carrier profile, but it does **not** yet create the large-scale visually readable long benches and concentrated risers seen in the retained reference interpretation.

## Evidence boundary
The retained XiaoMa/TLO boundary remains binding: geometric continuity, adjacency, shared-bund appearance or conservation does not establish hydraulic connectivity, head, depth, discharge, gate state, parcel ownership or current soil/water state. The retained MrRolord method is used only as sequencing discipline (drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials); the original named video was not available to replay. The retained `image(173).png` interpretation is non-metric: long curved contour benches, unequal widths, nested turns, concentrated riser edges and drainage interruptions.

The 6 m lattice, 6 mm correction cap, 12 m hard-drainage core and 1.05 m cliff gate are synthetic morphology/QA controls, not surveyed Yunnan agricultural dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, true management parcels, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water management.

## Locks / next blocking issue
`visualAcceptance=false`, `parcelGenerationEnabled=false`, `waterStateKnown=false`, `productionReady=false` remain locked. The next terrace-stage defect is no longer local carrier continuity; it is hillside-scale visual amplitude/organization. The next round must improve readable long contour benches and riser concentration without weakening the fixed 3 m safety/drainage/identity gates. Do not unlock parcel/shared-bund generation yet.
