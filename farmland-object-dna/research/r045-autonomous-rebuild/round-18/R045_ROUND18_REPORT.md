# Farmland Mother R045.18 — autonomous rebuild report

Date: 2026-09-18 (automation working window)
Baseline: R045.17
Validated implementation commit: `2625f8fc26b8920a5ba433956fe971f3e05fd758`
Machine evidence commit: `92c043f650243abd1970f497fec37f649cb6dd9c`
Workflow run: `35283438086` (`farmland-r045-round18-qa`) — SUCCESS

## Scope actually changed

R045.18 performs one bounded macro-terrain intervention only: it replaces one remaining source-area ribbon symptom with three differently oriented, differently proportioned upper headwater/amphitheatre footprints for basins A/B/C. It does not add terraces, parcels, irrigation, roads, agents, vegetation, or material detail.

The tempting but invalid shortcut rejected before implementation was: "increase the amplitude/transverse drift of the R045.17 basin shoulders and the watershed will look more natural." That would amplify the existing elongated parallel-ribbon rhythm. The missing degree of freedom was source-catchment footprint: orientation, aspect, occupancy, side bias, and relation to the inherited trunk carrier.

The R045.18 field is tied to the inherited A/B/C trunk paths with anisotropic source-rim ellipses and basin-specific controls. The complete inherited drainage skeleton is protected. The new field is exactly zero from `z >= -160`, so the existing lower terrace-candidate domain and terrace-permission map are not altered in this round.

## Evidence boundary and method intake

Before editing, the run re-read:

- the latest R045.17 branch/kernel/QA/audit;
- the Xiaoma/TLO DEM checkpoint, which still says no selected field parcel and no field-scale truth are available; 12.5 m macro terrain cannot resolve bund sections, channel sections, control elevations, or centimetric water states;
- the MrRolord video-frame study, used only for the reusable ordering `drainage topology / influence field -> terrain -> land use`, not as geometry truth;
- the existing user-reference morphology abstraction, used for hierarchy, contour turning, source-to-slope continuity and non-clone occupancy only, with no metric extraction.

Therefore all R045.18 headwater dimensions, angles, amplitudes and offsets remain synthetic generator parameters. They are not surveyed Yunnan headwater geometry, channel sections, flow, terrace dimensions, field microtopography, soil/sediment properties, or ownership data.

## First Runner attempt — preserved failure

The first implementation commit was `90c17f242ef7497534f4b8163e21c3d7df53ac97`. Its workflow did not pass numeric QA. Four defects were exposed and kept as evidence rather than hidden:

1. A/B/C footprint aspect ratios were nearly clones: about `2.194 / 2.103 / 2.185`, standard deviation only about `0.0413` against the `>0.08` anti-clone gate.
2. A and B footprint component peaks landed on the same sampled grid cell, so parameter differences had not produced distinct occupancy.
3. The upper source fade created a new longitudinal step of about `0.2536 m / 4 m` near `x=-95,z=-212`, above the unchanged `<0.22 m / 4 m` gate.
4. A QA semantic error was also exposed: a gate named "not reintroduced" demanded an absolute upper-wall fraction `<0.12`, while R045.17 itself already contained about `0.2121` around `z=-202`. That gate could not distinguish "R18 created a wall" from "R18 inherited an unresolved R17 wall".

The fourth item is a QA-logic correction, not permission to weaken geometry checks. The proper claim for this single-scope round is "R18 does not worsen inherited wall debt"; it does not claim the debt is solved. The inherited debt is explicitly carried forward.

## Geometry revision after failure

The second implementation changed geometry rather than the failed thresholds:

- A/B/C path anchor positions differ (`0.135 / 0.245 / 0.150`).
- source-footprint orientation differs (`-34 / +27 / -52 degrees`).
- major/minor axes differ (`70x34 / 88x34 / 58x31`).
- rim offsets, rear shifts, left/right bias and cross-basin center shifts differ.
- amplitudes were reduced while the upper/lower source fade was broadened so the intervention enters continuously.

The QA wall gate was corrected to compare R045.18 against the R045.17 inherited baseline, while separately and explicitly recording that the inherited upper-wall fraction near `z=-202` remains unresolved debt.

## Final numeric QA

The final GitHub Runner passed `29/29` numeric gates.

Key results:

- water graph preserved: `22 -> 22` nodes, `55 -> 55` edges;
- terrain carrier inventory preserved: `12 -> 12` terrain channels, `3 -> 3` outlet continua;
- maximum R045.18 headwater-footprint delta: `0.652139 m`;
- mean absolute delta across the sampled upper-source domain: `0.070880 m` over 1,480 samples;
- A/B/C component maxima: `0.292101 / 0.305408 / 0.358113 m` at distinct sampled locations;
- complete drainage-skeleton protection: 132 samples within `<=11.5 m` had exactly `0` R045.18 delta;
- rear-ridge controls: `0` sampled change;
- terrace-candidate/lower-slope geometry: `0` sampled change at `z>=-158`;
- terrace permission: exactly inherited, `0` sampled difference;
- front receiver: `0` sampled change;
- maximum longitudinal R045.18 delta step: `0.147378 m / 4 m`, below the unchanged `0.22` gate;
- R045.17 inherited upper-wall fraction: `0.212121`, R045.18: `0.212121`; contiguous span remained `10 m`, so this intervention neither solved nor worsened that debt;
- near-drainage terrace permission mean remained `0`;
- far-from-drainage future terrace-candidate permission mean remained about `0.683725`;
- `visualAcceptance=false`, `terraceGeometryEnabled=false`, `parcelGenerationEnabled=false`, `waterStateKnown=false` remain locked.

## Browser and fixed-camera QA

The final Runner launched real Google Chrome against the R045.18 audit page through a local HTTP server. Screenshot status, DOM status and ready-marker status were all `0`. The generated fixed-camera A/B screenshot is `527,565 bytes`. Natural stream overlay was OFF; only the front receiver river remained as a spatial reference.

The workflow run `35283438086` completed with conclusion `success`, including numeric gate, browser fixed-view gate, artifact upload and evidence persistence.

## Fixed-camera visual review

The final screenshot was downloaded and inspected directly after the Runner completed.

There is a real but deliberately local change: the upper/source area in R045.18 no longer uses exactly the same occupancy/orientation logic in A/B/C, and the source shoulders/hollows show small basin-specific differences without moving the protected drainage axes. The A/B fixed camera confirms the intervention does not spill into the lower agricultural candidate slope.

However, visual acceptance remains FALSE. The R045.18 change is subtle at whole-scene scale and does not yet solve the main macro-form problem. The central agricultural slope still reads as a large, smooth sheet with long, roughly parallel concave/shoulder rhythms. The source hollows and divide masses still do not dominate the scene strongly enough to explain basin convergence without interpretation. The rear skyline remains programmatically repetitive, and the broad lower plain remains under-articulated. Therefore R045.18 is a valid bounded correction, not a macro-terrain completion.

An important visual/QA debt remains around the inherited upper-slope wall persistence near `z≈-202` (about `0.212` of eligible samples in the worst sampled row). R045.18 explicitly does not count that inherited defect as solved merely because its own new delta is continuous.

## Locks and public workbench

`visualAcceptance=false`

`terraceGeometryEnabled=false`

`terracePilotPreviewEnabled=false`

`parcelGenerationEnabled=false`

`waterStateKnown=false`

`productionReady=false`

No public HTTPS workbench is reported for this round. The audit page is proven to open in a real Runner Chrome instance over local HTTP, but no persistent public HTTPS deployment was independently opened and verified; additionally visual acceptance is still false.

## Next priority

Remain in `large terrain + hierarchical drainage`. Do not use terraces to hide the unresolved macro-form. The next bounded target should explicitly attack the inherited `z≈-202` upper-slope wall/debt together with source-hollow-to-convergence shoulder continuity, while preserving the new non-clone A/B/C source footprints and the drainage-axis protection. Only after the macro watershed reads naturally with stream overlays off should bench+riser terrace geometry be restarted from zero.
