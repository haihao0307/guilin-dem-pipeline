# Farmland Mother R045.38 — fixed report

## Scope

R045.38 fixes the specific topology regression left by R045.37. R045.37 proved that the cached terrace-continuity field could render in real Chrome, but its sampled fragmentation burden was slightly worse than the verified R045.35 baseline. Browser success and topology correctness are separate claims; weakening the fragmentation gate would only hide a real short-run regression.

R045.38 therefore does **not** raise risers, globally dilate terrace support, change the inherited stair frame, or increase browser timeouts. It adds a bounded, non-recursive same-family **run-end extension**: a weak sample can gain support only when an immediately adjacent already-active R045.37 row sample belongs to the same terrace family and remains stair-compatible. All gains are re-gated by agricultural-slope eligibility, family envelope, drainage clearance and foreground receiver clearance; the <=12 m synthetic hard drainage core remains absolute zero.

## Preserved failed attempts

The first authoritative R045.38 run (`35369844912`) passed numeric QA but failed the browser fixed-view gate: both screenshot and DOM processes hit the 45 s timeout (`status=124`) and no render evidence was produced. This failure is preserved in commit `c6e441ccb9147c66cabf38581e1a4a917dd4e352`.

The failure was not addressed by raising the timeout. The fixed-view audit was changed to consume a QA-generated world-space audit cache produced from the same R045.38 kernel. The cache is generated before Chrome starts, so the browser path performs projection/drawing only rather than repeating the expensive terrace kernel for every render sample.

## Final authoritative result

Final evidence commit: `4eb17c76ce1d58525bddc8f9d17744f169ccce88`.

Numeric QA: **36/36 passed**.

Key topology metrics:

- R045.38 active terrace samples: `520` vs R045.37 `495`.
- Core samples: `349` vs R045.37 `349` — core did not shrink.
- Positive gain samples: `36`.
- R045.37-weak samples crossing the active threshold: `25`.
- Isolated threshold crossings: `0`.
- Unsafe gained samples: `0`.
- Hard-drainage-core active samples: `0`; hard-core terrain delta: `0`.
- Row runs: `77` vs R045.37 `78`.
- Fragmentation burden: `0.1480769231`, improved from R045.37 `0.1575757576` and returned inside the R045.35 reference gate (`0.1557377049`).
- Median longest run: `54 m`, unchanged from R045.37; maximum longest run: `72 m`, unchanged.
- Three terrace families remain material: `93 / 210 / 217` active samples.
- R045.38 vs R045.37 sampled maximum terrain change: `0.0320126620 m`.
- Maximum terrace delta relative to the R30 substrate: `0.5045566963 m`.
- Maximum adjacent 6 m terrace increment: `0.8252562221 m`, below the fixed `1.25 m / 6 m` cliff gate.

Bench/riser morphology remains valid:

- strict bench samples: `63`; strict riser samples: `14`;
- bench/base gradient median ratio: `0.2527159279`;
- riser/base gradient median ratio: `2.4395053683`;
- bench median slope: `0.0636386206`;
- riser median slope: `0.6057397015`.

Inheritance/protection checks remain exact for the sampled far-upstream area, hard drainage core, foreground receiver and outside-support samples (`0` additional terrace delta in each protected class).

## Browser and fixed-view audit

Final workflow run `35370618349` completed successfully. Real `/usr/bin/google-chrome` returned:

- screenshot exit: `0`;
- DOM exit: `0`;
- `data-ready=true`: passed;
- fixed-view PNG: `307,555 bytes`;
- browser gate: **passed**.

The final PNG was downloaded from the Actions artifact and manually opened after the workflow completed.

Manual fixed-camera finding: no new large seam, transverse wall, visible drainage-core crossing or foreground-receiver break is apparent. The coarse plan audit visibly contains several orange one-cell run-end extensions while the blue drainage interruptions remain legible. However, the main A/B perspective remains almost indistinguishable: the R045.38 correction is only about `0.032 m` relative to R045.37 at the sampled maximum and is below direct readability at this fixed whole-slope view. Therefore **visualAcceptance remains false**. Numeric topology repair is accepted; whole-slope terrace visual organization is not.

The cache-rendered main view is intentionally lightweight and does not claim that absence of a visible difference proves field truth. Its purpose is browser startup/fixed-camera stability plus gross-artifact inspection; topology evidence comes from the explicit numeric gates and plan audit.

## Evidence boundary

The Xiaoma/TLO boundary remains unchanged: surface continuity does not establish field ownership, hydraulic connectivity, head, water depth, discharge or gate state. Current missing field truth still includes actual field boundaries/locations, field-scale microtopography, bund/riser sections, channel sections, water-control elevations and event management records.

Saved MrRolord research was re-read this round only for method ordering: **drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use**. The original video was not directly available in this run, so no claim is made that it was replayed. Blender dimensions, Voronoi cells, shader displacement and adaptive subdivision are not treated as agricultural truth.

`image(173).png` was reopened. It is used only for visible morphology: nested curved contour-following benches, unequal widths, local reconnects, and legible drainage interruptions. No metric terrace width, join length, riser height, channel dimension, water depth or hydraulic parameter is inferred from the photograph.

The R045.38 one-cell/6 m audit regularization is therefore **synthetic topology QA morphology**, not surveyed Yunnan terrace geometry.

## Locks retained

- `terraceGeometryEnabled=true`
- `terracePilotPreviewEnabled=true`
- `visualAcceptance=false`
- `parcelGenerationEnabled=false`
- `waterStateKnown=false`
- `productionReady=false`

No parcel/shared-bund generation, per-field inlet/outlet generation, water-state claim, road/labor task generation, farmer/buffalo task expansion, or material/vegetation production work is unlocked by R045.38.

## Next blocking problem

R045.38 closes the specific R045.37 fragmentation regression without increasing terrace height. The next blocker is no longer short-run numerical fragmentation; it is the whole-slope **nested/branching/merging terrace-family organization** being too weak in the main perspective. The next round should make that organization structurally readable while continuing to preserve hard drainage interruptions, rather than increasing riser amplitude or using materials/water to mask geometry.
