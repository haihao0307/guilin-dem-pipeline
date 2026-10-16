# R06 portal approach endpoint correction

Status: the second browser run (`artifact-3621/06-r06-north-portal.png`) shows the large interior residues removed, but a thin original green surface crosses the sleepers immediately outside the old cutting end. This patch corrects that endpoint. Browser acceptance of the new patch remains pending; CPU results are not visual acceptance.

## Confirmed source geometry

The old exit criterion was `ground <= rail + 0.35m`, so it could stop before the sleepers, track bed or tunnel inner floor had emerged. The exact rendered north background triangle at old S9448.229201 is 10.796110m, while rail is 10.787403m and the inner floor is approximately 10.137403m. Ground is 0.658707m above the floor; across the left side of the cut it is higher still. This is retained terrain just outside the excavation, not a new layer or a clipping-height regression. The south end also stopped with terrain 0.097224m above rail.

## Bounded change

Only the portal exit search and its endpoint statistics change. An exit now requires source ground to be at least 0.10m below the inner floor across the full 9.9m outer cut width, and for 10m outward along the actual route. Resolution samples this once at 1m longitudinal spacing and 11 lateral positions. The original per-end 1500m search bound and blocked behavior remain. There is no per-frame query.

The former rail-visible endpoints are retained as a stable sampling core. All previous sampling rings and every covered interval remain exactly identical; only the two approach tails are added. No source height, runway, route, camera, or unrelated terrain is changed.

- South: old S5184.482540 → new S5144.482540, 40m added. Total extension from declared section: 1120m.
- North: old S9448.229201 → new S9458.229201, 10m added. Total extension: 270m.
- Main covered interval remains exactly S5812.445228176466–9408.23157736784.
- Minimum sampled source-ground clearance below the inner floor over the full endpoint/outward region: south 0.730305m; north 0.429733m.

## Runtime gate

Read `stats.portals.ends`. Each end now contains:

- `requiredGroundBelowFloorM`: 0.1.
- `maxCrossSectionGroundAboveFloorM`: maximum ground-minus-inner-floor at the endpoint; must be <= -requiredGroundBelowFloorM.
- `outwardCheck`: `{distanceM:10, stepM:1, lateralSamples:11, sampleCount:121, maxGroundAboveFloorM}`. Its maximum must also be <= -requiredGroundBelowFloorM.
- Existing `exposed`, `extensionM`, position and height fields remain available.

`floorClearanceM` is the minimum sampled clearance over the entire outward region. These are sampled source-geometry checks, not a general engineering certification or a claim about the rest of the route.

## Independent source-triangle regression

`ENDPOINT-CLEARANCE-REGRESSION.json` tests cut output with independent vertical triangle intersection, every 0.5m along the connection and nine lateral positions spanning ±4.4m. It includes 5m before the previous endpoint, the added tail, and 10m beyond the new endpoint. The 10m exterior is uncut original terrain and is now below the inner floor.

- South actual 2m detail: old 629 residual hits → new 0 / 999 probes.
- South actual 5m detail: old 608 → new 0 / 999 probes.
- North actual 30m background: old 57 → new 0 / 459 probes.
- Each layer includes 189 probes at or beyond its new cut endpoint; all have zero residual floor intrusions.
- Source buffers unchanged. General tunnel CPU tests and full north portal mesh regression also pass; the reburied 31.16m roof witness remains intact.

## Delivery

Runtime module: `tunnel/curved-tunnel.mjs`.
SHA256: c66de44ffbd641f7a56ef8c8e2665c79ffda5a3b454e3eb27bfddb2d3e76ea8a.

Final plan SHA256: 364a1087816f6f03450641e39df73355a006917b2229532d81f0a75d76c6b19b.

Minimal integration set: module, `CPU-EVIDENCE.json`, `portal-fix/ENDPOINT-CLEARANCE-REGRESSION.json`, this file. Existing host hooks remain unchanged. The R06 assembly owner retains all eight existing regression views and must verify the seam in the real browser before calling the visual review passed.
