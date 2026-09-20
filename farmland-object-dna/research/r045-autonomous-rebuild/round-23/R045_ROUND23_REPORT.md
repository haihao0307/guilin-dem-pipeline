# Farmland Mother R045.23 — Curved Foothill Contact Audit

## Fixed version

- Verified implementation snapshot: `4da12d05d734324f52171ca2d8ccc7a1a5c3d91b`
- Machine-evidence commit: `8027ec8ed8fa28b03b1972da6d7307472ac1fe1b`
- Previous R045.22 is preserved; R045.23 is additive and does not overwrite the prior round.

## Logic correction before implementation

R045.22 being numerically continuous does **not** imply that terrace geometry should begin. Continuity is a necessary substrate condition, not evidence that the slope-to-plain morphology is already correct. Drawing terrace bands at this point would risk masking the unresolved oversized foothill plain rather than solving it. Likewise, simply amplifying the existing long valley shoulders would reinforce the parallel ribbon pattern already rejected in the fixed-view audit.

R045.23 therefore stays at priority 2: one-sided agricultural slope / foothill plain. It changes the lower macro substrate before any terrace, parcel, irrigation, road or actor layer is allowed to appear.

## Real change in R045.23

A synthetic non-horizontal foothill contact is introduced across the lower slope. The contact is used only as a generator control, not as a surveyed breakline. Around it the round adds a broad convex toe, a weaker downslope receiving-apron hollow and one weaker off-axis lobe. The contact varies in z across x rather than forming a horizontal band, so the slope-to-plain transition is no longer represented as one straight front.

Inherited drainage is protected with a smooth distance fade. The foreground receiving river is separately protected. The existing water graph and terrain-carrier arrays are unchanged: 22 nodes, 55 edges, 12 terrain channels and 3 outlet carriers remain identical to R045.22.

Terrace geometry, terrace pilot, parcel generation and production readiness remain locked. `waterStateKnown` remains false.

## Numeric QA

Final machine QA: **23 / 23 passed**.

Key measured results:

- Synthetic foothill-contact z range across sampled x: **53.597 m** (`24.757 .. 78.354 m`).
- Maximum added terrain delta: **0.93965 m**.
- Mean absolute delta over the sampled support: **0.15837 m**.
- Mean absolute delta in the broad lower band `z=38..118`: **0.19981 m**.
- Maximum added-field longitudinal change: **0.14644 m per 4 m z**, below the fixed `0.24 m / 4 m` gate.
- Positive toe response centroid z: **54.674 m**.
- Negative receiving-apron response centroid z: **91.505 m**.
- Toe/apron centroid separation: **36.831 m**.
- R045.22 worst sampled 4 m uphill rise in the foothill audit: **0.24675 m**.
- R045.23 worst sampled 4 m uphill rise: **0.28763 m**. This stays inside the non-wall gate (`R22 + 0.22 m`).
- Sampled change inside the protected inherited drainage-core gate: **0 m**.
- Sampled change in the upper R045.22 work at `z<=4`: **0 m**.
- Sampled change around the foreground receiver river: **0 m**.
- Sampled change outside the foothill support: **0 m**.
- Terrace permission mean near drainage remains **0**; future candidates away from drainage remain available while terrace geometry stays disabled.

No QA threshold was loosened after seeing the result.

## Browser gate

GitHub Actions run `35300173474`, job `qa`, completed successfully. The browser gate used `/usr/bin/google-chrome` against the actual R045.23 audit page served in the runner.

- screenshot process exit: `0`
- DOM process exit: `0`
- `data-ready=true`: detected
- fixed-view PNG: present
- fixed-view PNG size: **527,576 bytes**
- browser gate: **passed**

This proves the audit page starts and renders in a real Chrome process. It does **not** prove that a persistent public HTTPS deployment exists.

## Fixed-camera visual review

The final runner artifact was downloaded and the fixed-view PNG was manually opened after the machine gate.

The R045.23 B view does show a real, non-stale change in the lower slope/foothill transition. The lower profile panel also confirms that the z=36 / 70 / 104 sections no longer behave as one uniform front: the toe and receiving-apron response separate in position and amplitude. The new transition is curved rather than a simple horizontal lower band.

However, **visual acceptance remains false**. At full-scene scale the R045.22 → R045.23 difference is still subtle. The central and lower agricultural face is still an oversized smooth sheet; the long upper/mid-slope shoulders can still be read as near-parallel programmatic bands; the rear skyline still has repeated procedural rhythm; and the foothill plain, although no longer completely uniform in section, still lacks enough nested macro relief to read immediately as a naturally formed slope-to-plain receiving system. The fixed view therefore does not justify enabling terrace benches and risers yet.

The visual audit also makes clear that simply raising the R045.23 amplitude next would be the wrong fix. That would risk turning a subtle toe into a conspicuous artificial berm. The remaining problem is the **planform and nested hierarchy** of lower-slope/foothill masses, not a lack of raw height amplitude.

## Evidence boundaries read this round

### Xiaoma / TLO boundary

Continuous terrain, a rendered intersection and internally consistent topology are not evidence of actual hydraulic state. They do not establish active hydraulic connectivity, water depth, discharge, gate state, soil-water state or sediment behaviour. R045.23 therefore makes no such claims.

### MrRolord provenance

The original MrRolord video was searched for again but was not recovered as a directly reviewable source this round. Only the previously saved method ordering is reused: **drainage topology / carriers → terrain influence → land use**. This report does not claim a fresh viewing of the original video.

### User reference image

`image(173).png` was reread only for non-uniform nested contour hierarchy and curved hillside occupation. No terrace width, riser height, channel cross-section, water depth or other metric quantity was inferred from the photograph.

## Real-world constraint boundary

There is still no target-site metre-scale terrain survey, surveyed bund/channel cross-section, control-elevation network, soil/sediment parameter set or time-series hydrology for the selected fields. A 12.5 m macro DEM cannot supply metre-scale bund geometry or centimetre-scale field-water truth. The R045.23 contact position, contact range, toe width and sub-metre elevation deltas are therefore **synthetic generator parameters**, not measured Yunnan field dimensions.

## Current locks

- `visualAcceptance = false`
- `terraceGeometryEnabled = false`
- `terracePilotPreviewEnabled = false`
- `parcelGenerationEnabled = false`
- `waterStateKnown = false`
- `productionReady = false`

## Next blocking question

The next round should remain in the one-sided agricultural slope / foothill-plain priority and change the **planform footprint and nesting** of the lower receiving terrain, not merely its amplitude. The goal is for the fixed camera, with natural-stream overlay off, to read a curved and asymmetric slope-to-plain system without needing terrace striping to explain the landform. Only after that macro substrate survives numeric and visual gates should the first bench + riser terrace pilot be enabled.

## Public workspace status

No public HTTPS workspace is reported for R045.23. The page was verified inside a real Chrome process in the GitHub runner, but no persistent public HTTPS URL was independently opened and verified in this round.
