# Farmland Mother R045.58 fixed report

Status: machine-fixed / manual visual acceptance still false

Fixed branch: `restart/farmland-object-dna-v020-20260907`
Evidence commit before this report: `56bf5426893be52317f28e9fc5ab5c3d6ae0762b`
Authoritative workflow: `farmland-r045-round58-qa`, run `35419515265`, all steps successful.

## What changed

R045.58 keeps the accepted R47 plan frame exactly: terrace mask, group, step, phase, index and base are unchanged. It keeps the R54/R56 strong-support cross-contour bench/riser profile and the inherited `0.84` vertical multiplier exactly. The only geometry change is the extra medium-support profile-coverage cap: the failed R57 value `0.82 * S(0.22,0.58,mask)` is reduced to `0.52 * S(0.22,0.58,mask)`. No new terrace footprint, level shift, drainage relaxation, parcel, water state, or material layer is introduced.

This is one substantive task: extend the already-validated bench/riser profile into the existing medium-strength terrace ribbons without violating the original local-cliff safety gate.

## Logic correction and preserved failure

R57 exposed a measurement error in the validation strategy. Its original authoritative 6 m whole-slope audit found a maximum local terrace increment of `1.112919833351231 m / 3 m`, which violated the fixed `<1.05 m / 3 m` gate. A later 12 m audit happened not to sample that extremum and appeared to pass. Treating the coarser result as evidence that the finer-grid failure disappeared would be a measurement-coarsening fallacy. Therefore R57 is not an accepted geometry version even though its later coarse numeric file and browser page can report pass.

R58 does not relax the limit. It restores the 6 m whole-slope change search and evaluates ±3 m neighbours at every changed 6 m cell. Unchanged regions inherit R56, whose global 3 m cliff gate was already accepted.

## Authoritative numeric result

R045.58 passes `19/19` gates.

- water graph identity: 22 nodes / 55 edges, unchanged;
- R47 plan frame: mask / step / phase / index / base maximum difference = 0;
- R56 strong core (`R47 mask >= 0.64`): exact difference = 0;
- 16 changed medium-support 6 m audit cells, spanning all three terrace families;
- active samples = 548; family samples = `95 / 229 / 224`;
- average additional medium-support profile coverage = `0.0801042665`, max = `0.1671953042`;
- maximum R56→R58 terrace-delta change = `0.0176964784 m`;
- changes outside the inherited `0.22 < R47 mask < 0.64` support band = 0;
- changed samples inside the inherited ≤12 m hard drainage core = 0;
- changed samples in the foreground receiver +12 m band = 0;
- restored local safety result: maximum terrace increment around every changed 6 m cell = `0.5546563393 m / 3 m`, below the unchanged `1.05 m / 3 m` gate.

The strongest sampled R58 local increment occurs around `(24,-48)` toward `(21,-48)` and remains inside the gate.

## Browser and fixed-camera evidence

Real browser used: `/usr/bin/google-chrome`.

- screenshot exit = 0;
- DOM exit = 0;
- `data-ready=true` marker found;
- screenshot exists, 102,519 bytes;
- browser gate passed.

The fixed-camera image was manually opened after downloading the Actions artifact. A and B are macroscopically almost indistinguishable, which is consistent with the small `0.0177 m` maximum R56→R58 delta. The orange plan markers confirm that the medium-support change is distributed across the inherited terrace support without entering the hard drainage core. The two shown cross-contour profiles nearly overlap at this presentation scale. No new macro wall, visible drainage blockage, foreground-receiver break, or obvious terrain seam is visible.

This is therefore accepted as a **machine-safe profile-coverage correction**, not as visual completion. `visualAcceptance` remains `false`: the current fixed camera still does not show a sufficiently strong whole-hillside transformation toward long, clearly readable terrace benches and concentrated risers. The next terrace work must improve slope-scale legibility without raising risers merely to create contrast and without filling real drainage interruptions.

## Evidence boundaries read this round

Xiaoma/TLO boundary remains binding: geometric adjacency and a more legible terrace profile do not establish parcel ownership, real hydraulic connectivity, head, water depth, discharge, gate state, soil-water state, or sediment state.

The saved MrRolord study is used only for ordering discipline: drainage hierarchy → accumulated terrain influence → terrain-conforming contour land use → paths / vegetation / materials. The original named video was not available to replay in this run, so no claim is made that it was replayed. Blender dimensions, Voronoi, shader displacement and adaptive subdivision are not treated as agricultural truth.

The user reference `image(173).png` was reread only for non-metric morphology: long contour-following benches, concentrated darker riser edges, unequal widths, nested bends and drainage interruptions. No metric width, riser height, channel size or hydraulic parameter is inferred from the photograph.

## Real-world constraints

The current 12.5 m macro DEM plus photographs cannot quickly supply what a real engineering reconstruction would require: field-scale/sub-metre microtopography on one elevation datum, actual parcel/management boundaries, bund/riser/channel cross-sections, inlet/outlet sill elevations, observed hydraulic connectivity, water head/depth/discharge/gate state, and event-based water-management records. The R58 thresholds (`0.22/0.58` support band, `0.52` spread cap, `0.46/0.54` transition, 6 m QA lattice, inherited 12 m hard core) remain synthetic morphology/QA parameters, not surveyed Yunnan agricultural dimensions.

## Locks and next gap

- `visualAcceptance=false`
- `parcelGenerationEnabled=false`
- `waterStateKnown=false`
- `productionReady=false`

R58 fixes the R57 safety defect while preserving medium-support profile coverage. It does not unlock parcels/shared bunds yet. The remaining blocking issue at the current priority is still terrace-scale legibility: the single agricultural slope needs long, nested, locally branching/rejoining contour benches that remain interrupted by protected drainage and are directly readable from the fixed perspective.

No public HTTPS workbench is claimed. Only the Actions runner page has been verified in a real browser; no persistent public HTTPS page was independently opened in this round.
