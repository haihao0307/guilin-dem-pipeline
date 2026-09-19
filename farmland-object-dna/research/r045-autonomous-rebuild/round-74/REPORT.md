# Farmland Mother R045.74 — fixed report

Status: **machine-safe / visually not accepted**  
Source commit under QA: `d1ba69af949cccb21daa360688a9ba4e75e06641`  
Persisted evidence commit before this report: `827750dc77dc09aba3681f6404b95bfbe0533ac0`  
QA contract: `R045.74-evidence-dense-strong-carrier-expansion-v1`

## What changed in this round

R045.74 completes one bounded substantive task over accepted R045.73: it admits evidence-dense, strong-dominated inherited terrace components that R72/R73 rejected only because fewer than five medium-support cells remained editable after strong carrier cells were frozen.

The prior inference mixed two different questions. `editableCount` measures remaining edit opportunity, not component evidence quality. A long component may have very few editable shoulders precisely because most of the component is already frozen strong terrace support. Treating low editable count as weak continuity evidence is therefore a category error. R74 separates evidence density / physical span / strong-carrier continuity from edit opportunity.

A previously unaccepted component can enter only when it is not already accepted and meets the independent gate: inherited size >= 7 nodes, physical span >= 36 m, >= 4 contour-evidence seeds spanning >= 18 m, >= 4 frozen strong carrier nodes, >= 2 editable medium-support nodes, and seed density >= 0.45. Only the medium-support nodes are physically edited. Strong carrier nodes remain frozen. New R74 expression cannot enter the <=12 m drainage hard core or the receiving-river +12 m protection band. Off-grid interpolation is clipped to the frozen R47 family plus exact stair index.

This correction does **not** imply that a longer carrier, an additional family, or more changed cells proves visual acceptance.

## Authoritative numeric QA

Final persisted result: **30/30 gates passed**.

- active footprint: `548 -> 548`; active-threshold crossings: `0`
- inherited terrace families: `95 / 229 / 224`, unchanged
- frozen plan identity (`mask/group/step/phase/index/base`): exact
- frozen R73 accepted authoritative nodes: exact (`max error = 0`)
- water graph: exact inherited `22 nodes / 55 edges`
- newly accepted strong-dominated components: `7`
- newly accepted editable medium-support nodes: `18`
- newly accepted frozen strong carrier nodes: `50`
- newly accepted component families: `1, 2`; accepted evidence now covers families `0, 1, 2`
- new R74 physical changes over R73: `18 / 18` opportunities realized; unsupported added authoritative-node changes: `0`
- total physical changes relative to R68: `43`, now distributed across all three terrace families (R73 had `25`)
- largest new changed-only connected run: `2` nodes, physical span about `8.49 m`; `12` new cells participate in multi-cell runs
- maximum span of newly accepted evidence-dense carrier: about `48.37 m`
- maximum R74-R73 authoritative-node height change: about `0.03469 m`
- maximum R74-R68 total authoritative-node height change: about `0.04030 m`
- worst local terrace increment checked around changed nodes: about `0.61413 m / 3 m`, below the fixed `1.05 m / 3 m` gate
- identity bleed: `0`
- nonzero 3 m off-grid interpolation samples: `70`; hard-drainage violations: `0`; receiver-band violations: `0`
- added changes in inherited inactive nodes: `0`
- added changes in frozen strong carrier nodes: `0`
- added changes in <=12 m drainage hard core: `0`
- added changes in receiver +12 m band: `0`
- added changes outside support domain: `0`

`visualAcceptance=false`, `parcelGenerationEnabled=false`, `waterStateKnown=false`, and `productionReady=false` remain locked.

## Browser and fixed-camera gate

The GitHub Actions workflow completed successfully. It used `/usr/bin/google-chrome` against the local audit HTTP page. Screenshot status, DOM status and `data-ready=true` status were all `0`; `page_startup_passed=true`, browser `passed=true`. The persisted 1400x900 PNG is `188435 bytes`. Source provenance is pinned to the same source commit and stale-evidence persistence is rejected by the workflow.

The final fixed-camera artifact was downloaded and opened manually after the workflow completed. In the main perspective, R73 and R74 are effectively indistinguishable at first glance. No new horizontal wall, terrain seam, receiver-river break, or drainage-core intrusion is visible. The plan audit does show concentrated orange R74 additions and confirms the new evidence reaches the previously missing middle terrace family, but those additions are still local. The scene still reads primarily as a smooth green slope rather than the long, nested, contour-following bench/riser organization visible in the user reference.

Therefore the visual verdict remains **not accepted**. R74 solves an evidence-selection/category-error problem and increases safe family coverage; it does not solve the large-scale terrace readability problem.

## Xiaoma / TLO boundary re-read

The current Farmland water-state learning record was re-read. It explicitly warns against turning necessary conditions into sufficient conditions: conservation does not establish correct head or exchange law; identical appearance does not establish identical soil state; identity does not establish carrier initial state; cumulative quantity does not establish the event process. It also keeps transfer interfaces and storage layers separately accounted: transfer being allowed does not mean that the system is currently hydraulically connected.

R74 therefore treats geometry, adjacency, component continuity and conservation only as bookkeeping/evidence relations. It does not infer hydraulic exchange law, head, water depth, discharge, gate state, soil-water state, sediment state or parcel ownership.

## MrRolord research re-read

The raw named MrRolord video was not available in the repository/library during this run, so this report does not claim that the video was replayed. The saved MrRolord research statement embedded in the accepted R73 record was re-read and retained only as method ordering: **river hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths / vegetation / materials**. Voronoi, shader displacement and adaptive subdivision remain visual/procedural techniques, not agricultural truth.

## User reference image re-read

`image(173).png` was reopened. It shows long nested contour-following benches, unequal widths, curved turns, concentrated dark riser edges and repeated slope-wide terrace organization. The image is used only as non-metric morphology evidence. No field width, riser height, channel section, inlet/outlet elevation, water depth or hydraulic parameter is inferred from it.

The comparison makes the current visual gap explicit: R74's numeric/plan evidence is broader, but the fixed main perspective still lacks the reference image's long-distance readable bench/riser rhythm.

## Real-world constraint

The 6 m authoritative lattice, >=36 m strong-dominated carrier gate, seed-density threshold, profile amplitude, added-node cap and inherited 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, actual parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity, or event-level water management. An ordinary person cannot quickly turn the current inputs into a real agricultural-engineering reconstruction without those observations.

## Fixed conclusion and next gap

R045.74 is fixed as a **machine-safe evidence-dense carrier expansion**, not a visually accepted terrace build. It preserves R73/R68/R47 history and all water-separation locks while removing a category error that excluded strong-dominated components solely because few shoulder cells remained editable. Evidence now covers all three inherited terrace families, including real physical change in the previously absent family.

The highest-priority unresolved issue remains third-stage terrace geometry: the whole one-sided agricultural slope must become visually readable at the fixed main camera as long, nested, contour-following benches and concentrated risers, with local branching/rejoining and natural drainage interruptions. Parcel/shared-bund generation remains locked until that slope-scale visual organization is independently accepted.

No public HTTPS workbench is published in this round. Only the runner-local HTTP page was actually opened and verified by Chrome; that is not evidence of a persistent public HTTPS endpoint.