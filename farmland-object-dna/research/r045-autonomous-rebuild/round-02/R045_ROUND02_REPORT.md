# Farmland Mother R045 · Round 02

Date: 2026-09-17
Status: internal autonomous rebuild; no public visual baseline.
Parent branch head: `52cdcd79be4a6e1acf6ac41c9405692a060fd0f1`

## Logical correction before implementation

The main error to avoid in this round is the inference **"more terrain noise = more natural terrain"**. That is false. Fractal detail can make a surface visually busy while leaving the drainage, divides, slope breaks, depositional transitions, and future agricultural placement physically unrelated.

A second false inference is **"a fan-shaped bump = a simulated alluvial fan"**. The new fan field is only a deterministic geomorphic proxy used to organize the foothill transition. There is still no sediment transport, grain-size, discharge, event hydrograph, or regional field measurement. `sedimentTransportSimulation=false` remains explicit.

## Evidence re-read

- MrRolord frame audit: retain `hydrology hierarchy -> cumulative / distance fields -> terrain -> terrain-conforming land use`; do not copy the example valley composition or Voronoi as parcel truth.
- R044 one-sided composition contract: rear mountains -> one forward agricultural slope -> foothill -> broad foreground paddy plain -> front receiving river.
- Yuanyang / Honghe research plan: the authoritative system relation is forest / water / terraces / settlements with directed water transfer; actual local terrace, channel, bund and water-control dimensions are still unknown and must not be invented.
- Xiaoma TLO intake: stable object identity, fixed reference frame and explicit unknowns remain separate from display buffers; 12.5 m DEM-scale evidence cannot resolve field bunds, channel sections or centimeter water depth.
- Water-state learning: carrier geometry, permitted transfer, gate state, flow state and storage must remain separate. Visible water does not prove current flow.

External methodological checks (not regional truth):

- USGS alluvial-fan work: flows leaving confined valleys tend to deposit on fans; fan long profiles generally decline in slope downfan. This supports using a decreasing downfan proxy, but not importing US fan dimensions into Yunnan.
- FAO irrigation guidance: paddy rice is grown in basins; surface irrigation depends on controlled gradients and drainage. This supports keeping terrace permission tied to slope / drainage rather than visual texture.
- USDA NRCS Terrace Standard 600: terraces require stable grades and adequate outlets. This supports preserving drainage / outlet constraints before future parcel generation.

## Implemented in R045.02

Created a new kernel `r045_round02_kernel.mjs`, preserving the R045.01 transfer graph while replacing the overly planar slope treatment with first-class geomorphic fields:

1. **catchment asymmetry**
   - A/B/C source basins no longer use identical incision strength;
   - relief between principal valleys and neighboring divides is intentionally different by catchment;
   - asymmetry is deterministic and world-space fixed.

2. **ridge / divide field**
   - four explicit divide polylines now generate broad ridge uplift;
   - the uplift is independent from the drainage-carrier geometry;
   - this prevents the whole agricultural slope from reading as one smooth tilted plane.

3. **valley incision field**
   - natural streams now continue through the upper and middle slope rather than ending at the rear mountain edge;
   - three secondary gullies were added as geomorphic carriers;
   - downstream incision tapers near the slope foot so valleys do not create a trench followed by an artificial fan cliff.

4. **foothill depositional-fan proxy**
   - three catchment-specific fan heads bridge slope and plain;
   - proxy height declines downfan and lateral width increases;
   - fan geometry is blended into the slope-foot transition to avoid a sudden positive step.

5. **terrace-permission field**
   - terrace generation is still blocked;
   - instead, a new `terracePermission(x,z)` mask records only where later bench/riser generation may be attempted;
   - the mask uses slope band, stream clearance, divide clearance, forward-facing gradient coherence, curvature and the fixed agricultural-slope extent;
   - major gullies return zero permission, so future terraces cannot simply cross drainage incisions.

6. **explicit claim boundary**
   - `sedimentTransportSimulation=false` was added to the kernel snapshot;
   - no regional microtopography, real weather, real soil exchange, real gate state or real discharge is claimed.

No field parcels, bunds, crops, people, buffalo, shelters or decorative vegetation were added. The terrain / hydrology gate remains ahead of those systems.

## Numeric QA actually run

Command:

`node r045_round02_qa.mjs`

All 16 gates passed.

Key results:

- 22 hydrology nodes;
- 54 total edges (additional geomorphic gullies; transfer topology unchanged);
- 37 permitted transfer interfaces;
- every transfer still has null current gate / flow / storage state;
- all three source nodes retain a directed path to the front river;
- transfer graph remains acyclic;
- maximum local rise along the central 4 m-spaced longitudinal section: `0.34745757809384736 m`, below the `0.55 m` anti-opposing-wall / abrupt-step gate;
- front river centerline: `z = 161.9136802902821 .. 179.32887035686338`;
- agricultural suitability beyond the front river remains exactly zero;
- mean sampled ridge-to-valley relief: `3.4403030338228207 m`;
- catchment relief standard deviation: `1.0075045419897775 m`, confirming the three basins are no longer identical copies;
- terrace-permission cells above 0.65: `48.756%` of the sampled candidate slope, so this is a constrained mask rather than an everywhere-on switch;
- mean terrace permission within 6 m of major streams: `0.0`;
- mean terrace permission farther than 18 m from streams: `0.8269620620584687`;
- all three fan proxy centerlines decline monotonically after their heads;
- worst 4 m fan-transition rise across A/B/C: `0.306 m` or less.

Machine-readable output is `r045_round02_qa_result.json`.

## Fixed-camera visual review

An internal fixed overview and top review were rendered from the exact R045.02 height function.

Visible improvement over Round 01:

- the middle slope is no longer a nearly uniform plane;
- principal drainage lines now leave readable valley traces into the agricultural slope;
- divides create broad interfluves rather than repeated parallel channels cut into one sheet;
- the slope-to-plain join has low-amplitude fan aprons instead of one uniform foothill strip;
- the river remains a foreground receiver and does not recreate a two-sided agricultural valley.

Still rejected visually:

- the rear mountain mass still reads as a row of procedural peaks rather than one convincing mountain / ridge system;
- drainage spacing is still too designed and evenly legible in top view;
- the fan apron is numerically present but visually weak at landscape scale;
- slope shoulders still need stronger large-to-medium-scale structure before benches are generated;
- no terrace bench / riser geometry exists yet, so this is not an agricultural landscape candidate.

Therefore `visualAcceptance=false` remains mandatory.

## Browser gate

Chromium was retried twice, including SwiftShader and GPU-disabled probes, against a trivial local page. Both timed out before producing a screenshot or DOM output. Errors include EGL / ANGLE initialization failure and missing system DBus socket.

This is not counted as a browser pass:

`browserQA=false`

No public HTTPS workbench is published from this round.

## Next round priority

Do not subdivide fields yet. Round 03 should replace the repetitive rear peak row with a coherent ridge / saddle / headwater-mountain system and make the source catchments less evenly spaced. Then re-evaluate the terrace-permission zones against the new slope shoulders. Only after the macro terrain is visually credible should contour bench + riser prototypes begin.

truthApproved=false
visualApproved=false
visualAcceptance=false
browserQA=false
productionReady=false
