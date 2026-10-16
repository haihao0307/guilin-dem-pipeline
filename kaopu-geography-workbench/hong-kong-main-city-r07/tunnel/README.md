# Curved Lion Rock tunnel R06 adapter

Owned new module: `tunnel/curved-tunnel.mjs`. No R05 or owner files were modified. Copy this module into R06 `tunnel/`. It has no runtime imports and publishes no private source assets.

## Exact hooks

R06 index module imports:

```js
import {createSketchRoute} from './route/route-runtime.mjs';
import {installTunnelTerrain,patchTunnelTerrainHost} from './tunnel/curved-tunnel.mjs';
```

Immediately after `const routeSetup=await installRailVerticalProfile();`:

```js
installTunnelTerrain(createSketchRoute(routeSetup.plan,null));
```

After all existing base, CEDD, station and coast host patches and before `document.write(html)`:

```js
html=patchTunnelTerrainHost(html);
```

The tunnel patch accepts exactly one of the final `hkCoastClosed` or `hkClippedIncrement` upload anchors. Coast therefore goes first. It queries the actual detail triangles and exact background source triangles before either background or 2m/5m detail uploads. The original `hkHeight` nearest-node behavior remains unchanged for existing callers. It clips both caches and removes the old 180m camera-follow fragment discard. It never edits original height arrays, sampleHeight, airport setup, raw source HTML, or mapData.

R06 integration module imports:

```js
import {installTunnelScene} from './tunnel/curved-tunnel.mjs';
```

Immediately after `const game=await base(host)` and before installNewRouteUI:

```js
const tunnel=installTunnelScene(game);
window.HKLionRockTunnelScene=tunnel;
```

`window.HKLionRockTunnelScene.stats()` is the complete result. If a real exposed entrance cannot be found within 1500m per end it returns `ready:false`, records `blocked_no_exposed_entrance_in_search_range`, leaves terrain caches unchanged and adds no tunnel mesh. Show that status rather than calling the tunnel complete.

## Mechanism and scope

- The R03 terrain render-cache clipper's convex half-space subtraction method is adapted to 3D swept arch volumes.
- Four-metre route samples generate overlapping convex sweeps. Terrain triangles are actually split and removed only where they intersect the excavation. Deep mountain roof triangles remain untouched.
- Original route geometry and vertical profile generate the inner lining, outer lining and open annular portal rims, with 9m internal width and approximately 8m crown above rail, authored GAME dimensions.
- A 5m bounded terrain search finds each first crown exposure and then an actually accessible rail entrance (`ground <= rail + 0.35m`). Intervening terrain is classified every four metres. High reburied hills keep an arched tunnel and their terrain roof; only exposed spans receive roofless U-shaped cuttings. This avoids both an artificial above-ground arch tube and an unnecessarily deep continuous approach trench. Very short source-terrain cover intervals remain explicit, rather than silently flattening the terrain.
- The actual covered interval receives a runtime-only `route.sample(...).role='tunnel'` adapter. This stops the old follow camera from being lifted to terrain above the newly extended tunnel. No position, direction, grade or plan JSON is changed. Disposing restores the sample function.
- Real terrain at both actual portal/approach ends, new chainages, scene coordinates, rail and terrain levels, excavation counts and statuses are reported. The 5m search precision is explicit; this is not surveyed tunnel design.
- No dynamic point lights are added. A low emissive lining and existing host lights keep interior walls legible without expanding the entire train scene's light shader.
- Original terrain sampling and any other general collision system remain unchanged. Train travel remains constrained to the existing shared route. This is a rendered terrain void plus inner boundary, not a general-purpose volumetric physics model.

## CPU verification

`node research/hk-lionrock-tunnel-r06/test-tunnel.mjs research/hk-route-spatial-r06/route-plan.json`

Passes synthetic full/partial triangle removal, attributes/source hash preservation, overburden roof retention, curved centerline clearance, fail-closed missing portals, real retained 2m/5m and 30m source terrain cuts, final host anchor composition, and duplicate patch rejection. Evidence is in `CPU-EVIDENCE.json`. CPU-EVIDENCE.json now uses the frozen candidate research/hk-route-spatial-r06/route-plan.json (9.85m Tin Hau rail). CPU-EVIDENCE-R05.json preserves the earlier R05 comparison. Owner must browser-check the final R06 host before acceptance.

Browser acceptance should inspect: south real portal from outside, inside on a bend with both side walls and roof, north exit, wide mountain view with preserved roof, train traversal, planning-overlay toggle, and terrain across coarse/detail boundaries. A yellow route overlay is not evidence of a tunnel.

## R06 focus locations

For the real Lion Rock main portals, use `const [south,north] = window.HKLionRockTunnelScene.stats().portals.mainCoveredInterval`, then `game.route.sample(south)` or `game.route.sample(north)`. For an interior bend, sample the midpoint of this interval at rail elevation plus 3m. Do not use the first `portalChainages` value for the main mountain tunnel: that value deliberately includes the short covered ground undulations near Walled City. `geometryPortals` lists every cover transition. `ends` are the actually exposed rail approach entrances. All are recomputed from the loaded route and terrain.

## Portal visual failure correction (2026-10-15)

The first assembled browser QA was **not** a visual pass. North-portal terrain bars were reproduced against the actual retained 30m triangles: a nearest source node understated the drawn surface by 2.1–2.5m, while the open-cut Boolean had an incorrect sampled-height-plus-2m lid. This version uses matching triangle interpolation for portal selection and retaining-wall tops; roofless cuts extend vertically to a 10km numerical ceiling. Closed tunnel volume and mountain overburden are unchanged. The new regression independently casts vertical rays against post-cut triangles: before 37 residual samples among 355 probes, after zero among 395 probes, over five lateral positions and 0.5m chainage spacing. These are CPU geometry results, **not** browser acceptance.

The original south inspection eye was S5744.82, inside the previous short covered segment, 3.56m laterally off the route and 6.54m above rail: outside the arched free-space cross-section. Preserve that exact old camera as a documented fixed regression. The public portal camera should use the adjoining open interval at the real curve center, eye rail+2.2m, rather than a 65m tangent extrapolation. Public views must be shown alongside the unchanged old views; camera changes do not substitute for verifying the repaired north terrain.

Detailed evidence: `portal-fix/PORTAL-MESH-REGRESSION.json`, `portal-fix/DIAGNOSIS.json`. Run `node research/hk-lionrock-tunnel-r06/portal-fix/test-portal-mesh.mjs research/hk-route-spatial-r06/route-plan.json`. The final plan is SHA256 364a1087816f6f03450641e39df73355a006917b2229532d81f0a75d76c6b19b.
