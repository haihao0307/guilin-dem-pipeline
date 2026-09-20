# Farmland Mother R045.28 — fixed review report

Date: 2026-09-18

## Frozen lineage

- Inherited verified baseline: R045.27 / branch head `4b53e5e84b8973884827ed81abad0c0f16148b14` before this round.
- R045.28 implementation commit: `75b8c0ecf9fde853dcd6fbf77118a4d5a617ef1b`.
- Machine evidence commit: `f2fd2dbb2700e0d540313032ac178d4a07cde195`.
- Old rounds remain in their own `round-*` directories and were not overwritten.

## Logic correction before implementation

R045.27 was still subtle in the whole-scene perspective. It would be a causal error to infer from that observation alone that the missing variable is vertical amplitude. Increasing relief on a weak or wrong footprint can only make the wrong landform louder. R045.28 therefore changes planform occupancy and nesting at the lower agricultural slope / footplain contact before any terrace bench/riser geometry is allowed.

## One substantive change completed

R045.28 adds three unequal, outlet-carrier-tied scalloped contact fields on top of the retained R045.27 slope-to-receiver transition system. Each field combines a broad re-entrant accommodation pocket with an off-axis convex tongue, a secondary notch and a weaker counter shoulder. The major / subordinate / local fields use different longitudinal support, widths, sweep direction, bend and relief, so they do not form one repeated parallel template.

The inherited water graph and carriers are unchanged: 22 nodes, 55 edges, 12 terrain drainage carriers and 3 outlet carriers. Drainage-axis cores and the foreground receiver river are protected from the new contact field.

## Required source reread

- 小妈/TLO intake boundary was reread. The 12.5 m macro DEM cannot establish field boundaries, bund/channel cross-sections, inlet/outlet control elevations, centimetric water depth or actual hydraulic state. Those remain unknown without common-datum field evidence.
- The saved MrRolord video-frame audit was reread. R045.28 reuses only the ordering `river hierarchy -> accumulated terrain influence -> land-use pattern`; it does not copy Blender dimensions, Voronoi parcel styling or Adaptive Subdivision as agricultural truth.
- User reference `image(173).png` was reopened. It was used only for visible unequal contour occupation, changing envelope widths and interleaving concave/convex planform relationships. No terrace width, riser height, channel dimension, water depth or regional metric was inferred from the image.

## Numeric QA

GitHub Actions run `35320682251` passed **42/42** gates.

Key measured R045.28 deltas relative to R045.27:

- maximum added elevation magnitude: `0.128175199234434 m`;
- mean absolute added elevation over 2,310 review samples: `0.014975927575322377 m`;
- core mean absolute added elevation: `0.019134102227152908 m`;
- maximum 4 m longitudinal change in the added field: `0.026810721717909776 m`;
- active footslope samples: `144`;
- active receiving-plain samples: `519`;
- R27/R28 substantive overlap cells: `293`;
- component occupied samples / rows: major `366 / 18`, subordinate `220 / 13`, local `109 / 9`;
- minimum component-centroid separation: `86.9936705987531 m`;
- whole-contact lateral centroid range: `69.11957954060082 m`;
- whole-contact active-span range: `376 m`;
- mixed signed rows (both convex and concave response): `9`;
- sampled change in far upstream work, drainage-axis protection zone, foreground receiver and outside support: all `0`;
- previous worst 4 m uphill rise: `0.3725896831104989 m`;
- R045.28 worst 4 m uphill rise: `0.3713056450240231 m` — slightly lower, so the round did not create a new transverse wall;
- terrace-permission maximum recomputed change: `0.020525635630035288`;
- near-drainage terrace-permission mean: `0`;
- far-drainage future-candidate mean: `0.666565987522404`.

## Browser startup and fixed-view evidence

The workflow used real `/usr/bin/google-chrome` against the local audit HTTP page. Screenshot exit code, DOM exit code and `data-ready=true` check all returned zero/success. The 1400×900 fixed-view screenshot was generated at `588,549 bytes`; the browser gate passed.

## Manual fixed-camera visual review

The generated R045.28 fixed-view PNG was downloaded from the successful Actions artifact and opened at full size for review.

The lower plan audit clearly shows that the new contact field is not one uniform band: it contains unequal lobes, changing width, lateral displacement, concave accommodation zones and smaller convex tongues. The perspective A/B render is also not stale, and no new large seam, transverse wall, drainage-axis cut or foreground-river break is visible.

However, the whole-scene perspective still reads R045.27 and R045.28 as nearly the same terrain at first glance. The lower agricultural slope / receiving plain remains dominated by one broad smooth surface, and the new scalloped contact hierarchy is much more legible in the plan audit than in the perspective view. The upper/middle long-valley shoulder rhythm also remains more regular and parallel than the user reference.

Therefore **`visualAcceptance=false` remains correct**. This round is accepted as a verified substrate/planform improvement, not as permission to start terrace bench/riser geometry. `terraceGeometryEnabled=false`, `terracePilotPreviewEnabled=false`, `parcelGenerationEnabled=false`, `waterStateKnown=false`, and `productionReady=false` all remain locked.

## Evidence boundary and real-world constraint

This round is synthetic, outlet-coupled macro contact morphology. In current conditions an ordinary implementation cannot rapidly turn it into surveyed Yunnan agricultural engineering truth because the project still lacks selected-field metre/sub-metre microtopography on a common vertical datum, measured bund and channel sections, inlet/outlet sill elevations, verified interface connectivity, gate/management records, soil/sediment parameters and time-varying water observations. The 12.5 m macro DEM and a perspective photograph cannot supply those missing observations.

## Current blocker

The single blocker before terrace generation remains **whole-scene readability of the one-sided agricultural slope -> unequal footslope contacts -> three receiving bodies**. The next round should continue to change nested planform massing and contact geometry, not simply multiply vertical amplitude and not overlay terraces as camouflage.

## Public workbench decision

No public HTTPS workbench is published for this round. The page was actually opened by Chrome, but only through the Runner-local HTTP audit server; no persistent public HTTPS URL was independently opened and verified.
