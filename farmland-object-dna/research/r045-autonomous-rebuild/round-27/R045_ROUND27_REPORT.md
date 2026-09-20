# Farmland Mother R045.27 — autonomous rebuild report

## Frozen state

- Base: R045.26 (`6b68c22f25334c9c5b1400017001dd8bed18d21e`)
- R045.27 terrain kernel: `8c57582b58b9c1b0eee2ee9c5bacdbe35cb441b5`
- QA script: `2f7f10db7523614486b799eff017f12ae2294221`
- Fixed-view audit page: `01de35ae7262be1b9a48ea5c83bd103499c4ce8b`
- QA/browser workflow: `5a48df8d667740f6c5707cd0170a01b7a4b403ab`
- Machine evidence persisted by the successful workflow, then a micro-review copy was also persisted; all prior R045.26 files remain intact.

## Logic correction before implementation

R045.26 proved that major/subordinate/local receiving landforms existed numerically, but their whole-scene connection to the one-sided agricultural slope was still visually weak. It would be a causal error to infer that the next fix should simply increase vertical amplitude or start drawing terrace bands. Visual salience is not terrain causality: amplifying a weakly connected planform would only make the wrong relationship more visible.

R045.27 therefore changes the missing planform relation first. It adds three broad, shallow transition necks tied to the inherited outlet carriers so that the lower agricultural slope overlaps the upper edge of the existing receiving hierarchy. Terrace benches, risers, parcels, canals, roads and actors remain locked.

A second logic correction was required because the new transition field touches the lowest part of the future terrace-candidate substrate. Reusing the R045.26 terrace-permission mask unchanged would be stale. R045.27 recomputes permission from the R045.27 surface while still keeping all terrace geometry disabled.

## Real implementation

Three unequal outlet-coupled transition fields were added. They use different longitudinal supports, starting/ending widths, lateral sweeps, bends, hollow amplitudes, nested recesses and outer shoulders. Their purpose is to connect slope massing into the inherited receiving bodies rather than create a symmetric trench or a horizontal terrace stripe.

The inherited water graph and terrain carriers are not rewritten. The foreground receiver is explicitly protected, as are inherited drainage-axis cores and upstream work outside the transition support.

## Numeric QA

Final machine QA: **40/40 passed**.

Key final metrics from the persisted workflow artifact:

- max R045.27 added elevation delta: `0.1022335364 m`
- mean absolute delta over 2,233 audit samples: `0.01240412496 m`
- core mean absolute delta: `0.01750101685 m`
- maximum 4 m change in the added transition field: `0.02305688022 m`
- positive shoulder mass / negative accommodation mass: `0.070564`
- active samples on agricultural-slope side: `86`
- active samples on receiving-plain side: `415`
- cells where R045.27 transition and R045.26 receiving hierarchy both have substantive signal: `314`
- actual occupied samples: major `309`, subordinate `213`, local `137`
- actual occupied longitudinal rows: major `17`, subordinate `14`, local `9`
- minimum component-centroid separation: `127.71697 m`
- whole-transition occupied-cell-count range by longitudinal row: `71`
- whole-transition weighted lateral-centroid range: `55.37560 m`
- sampled R045.27 change in far-upstream protected region: `0`
- sampled change near inherited drainage axes: `0`
- sampled change around the foreground receiver river: `0`
- sampled change outside the declared support: `0`
- R045.26 worst 4 m uphill rise in the audited lower band: `0.3619045731 m`
- R045.27 worst 4 m uphill rise: `0.3674278852 m`
- near-drainage terrace-permission mean: `0`
- far-from-drainage future-candidate permission mean: `0.6666580770`
- maximum permission change after recomputing from the new surface: `0.03522036623`

No numeric gate was relaxed to obtain this pass.

## Browser and fixed-view QA

The successful GitHub Actions run used `/usr/bin/google-chrome` against the local audit page. Screenshot process, DOM load and `data-ready=true` all returned success. The persisted 1400×900 screenshot is `566,682 bytes`, and the browser gate is `passed=true`.

The full persisted screenshot was subsequently downloaded from the Actions artifact and inspected directly, not inferred from the log.

## Fixed-camera visual review

**Visual acceptance remains false.**

The R045.27 render is not stale: the lower-slope / receiving-plain substrate does change, and the plan audit shows three unequal, laterally separated transition bodies. No new whole-scene seam, cliff-like wall, foreground-river break or drainage-axis rupture is visible in the fixed view.

However, in the main perspective the R045.26 → R045.27 difference is still too subtle. The lower agricultural slope and receiving plain continue to read primarily as one broad smooth surface; the new slope-to-receiver connection is easier to prove in the plan audit than to read immediately in the whole-scene camera. The upper/middle long shoulder-and-valley rhythms also remain more regular and near-parallel than the user reference. Therefore the transition is a valid substrate correction, but it is not sufficient evidence to unlock terrace benches/risers.

## Evidence re-read this round

- 小妈 / TLO water-state method was re-read. The retained boundary is that surface continuity or visual connection does not establish hydraulic connectivity, water depth, discharge, control state, soil-water state or sediment state. Those require common-datum microtopography, interface identity, control elevations and time-resolved evidence.
- `image(173).png` was reopened. It is used only for visible large-scale relations: unequal nested contour occupation, changing widths and curved slope-to-lower-field transitions. No terrace width, riser height, channel section, water depth or regional metric is inferred from the photograph.
- A fresh copy of the original MrRolord video was not found/reopened this round. Only the project-saved research ordering is reused: inherited river hierarchy / carriers → accumulated terrain influence → later land use. Blender dimensions, Voronoi parcel styling and hydraulic truth are not imported.

## Real-world evidence limits

An ordinary implementation cannot quickly turn this synthetic terrain into a real, hydraulically defensible Yunnan paddy system under the current evidence set. Missing items include common-datum metre-scale field microtopography, surveyed bund and channel sections, control elevations, interface connectivity, calibrated soil / gate parameters, and time-resolved water-management observations. A 12.5 m macro DEM and photographs cannot supply those missing quantities.

Therefore the R045.27 transition widths, sweeps and approximately decimetre-scale vertical changes are procedural morphology parameters for substrate/visual QA, not surveyed agricultural or hydraulic dimensions.

## Locks after R045.27

- `visualAcceptance=false`
- `terraceGeometryEnabled=false`
- `terracePilotPreviewEnabled=false`
- `parcelGenerationEnabled=false`
- `waterStateKnown=false`
- `productionReady=false`

No public HTTPS workstation is claimed for this round. The page was verified in real Chrome only through the Runner-hosted local HTTP audit route; no persistent public HTTPS URL was actually opened and verified.

## Next blocking issue

The numerical slope-to-receiver overlap now exists, but the whole-scene camera still does not read that hierarchy strongly enough. The next substantive move should change the **planform nesting and readable mass connection** between the one-sided agricultural slope and the three receiving scales, without simply amplifying vertical relief. Terrace geometry should remain locked until that substrate relation survives fixed-view visual review on its own.
