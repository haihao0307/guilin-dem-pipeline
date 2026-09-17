# Farmland Mother R045 · Round 01

Date: 2026-09-17
Status: internal rebuild only; not a public visual baseline.

## Evidence reviewed before implementation

- Current branch head before this round: `5e4c1aa88c8f4f59881e64a6dbdb7dab6fd37b6c`, which freezes R044 and earlier visuals as failure evidence.
- `VIDEO_FRAME_AUDIT.md`: MrRolord's transferable logic is hydrology hierarchy -> accumulated / distance fields -> terrain -> terrain-conforming land use; the shown Voronoi stage is not a prescription for final paddy parcels.
- `R043_FIELD_GRAPH_CONTRACT.md`: macro terrain and hydrology must precede management blocks and parcel subdivision.
- Latest Mother water-state learning: representation, object identity, control-volume storage, and source / transfer events must remain separate. A permitted transfer interface does not prove that the gate is currently open or that flow exists. Visible water geometry must not be used to invent old water state, flow rate, soil state, weather, or exchange laws.

## Implemented this round

Added `r045_round01_kernel.mjs` as a new deterministic terrain / hydrology kernel rather than modifying the rejected R044 visual workbench.

The macro scene is now explicitly constrained to:

`rear mountains -> one forward agricultural slope -> foothill transition -> broad plain -> front receiving river`

There is no generated opposite agricultural wall. The river is restricted to the terminal foreground band.

The water system is represented in two different layers:

1. carrier / geomorphic geometry: natural streams, high contour canal, foothill collector, plain main canal, plain collector, front river;
2. logical transfer interfaces and storage control volumes: source captures, high-canal distribution, seven slope distributaries, foothill-to-plain transfers, seven plain laterals, and collector-to-river transfers.

This separation is deliberate. The kernel contains 22 graph nodes, 51 total hydrology edges, and 37 permitted transfer interfaces. Every permitted interface has `currentGateState=null`, `currentFlowM3s=null`, and `storedVolumeM3=null`; therefore geometry or topological permission is not silently promoted into a physical flow claim.

Three synthetic source control points (`SRC-A`, `SRC-B`, `SRC-C`) each have a directed permitted path to the front river receiver. The transfer graph is acyclic.

## Numeric QA actually run

`node r045_round01_qa.mjs`

All 9 gates passed:

- unique node / edge identities;
- no inferred gate state, flow rate, or stored volume;
- every permitted transfer has valid endpoints;
- all three sources reach the river receiver;
- transfer graph is acyclic;
- central longitudinal section has one forward descent; maximum local sampled rise was `0.316552089361807 m`, below the `0.55 m` failure gate;
- no opposite agricultural wall detected behind the front river;
- front-river centerline stayed within `z = 161.94 .. 179.29`, inside the required terminal band `154 .. 188`;
- agricultural suitability is exactly zero in the rear mountain exclusion and the foreground river / beyond-river exclusion.

The machine-readable result is committed as `r045_round01_qa_result.json`.

## Fixed-camera visual review

A fixed overview was rendered from the same terrain-height function for internal review. The major composition correction is real: the old central two-sided valley has disappeared, there is one descending land body, and the receiving river remains at the front edge.

The visual review also found that this is not yet a good landscape. The agricultural slope is still too smooth and planar, the rear mountain peaks still read as repeated procedural masses, the foothill transition is too weak, and the hydrology has not yet been allowed to generate enough terrain-scale benches, fans, ridges, or catchment asymmetry. These are retained as failures for the next round rather than hidden by vegetation or material detail.

## Browser gate

A Chromium startup check was attempted against the internal workbench. In this runtime Chromium itself failed even on a trivial static HTML page, timing out while its local graphics / DBus process initialization failed. This is an execution-environment blocker, not a passing browser result. Therefore:

`browserQA=false`

No public HTTPS workbench is published from this round.

## Logical mistakes explicitly avoided

- A connected graph is not treated as proof of real hydraulic behavior.
- Conservation or topological reachability is not treated as proof of correct water head, gate law, infiltration, or weather response.
- A field-like visual mask is not yet called a real parcel.
- MrRolord's example layout is not copied as the Farmland composition.
- The next step will not subdivide fields before terrain relief, water carriers, access axes, and management skeleton are sufficiently stable.

## Next round priority

Keep the current one-sided composition and explicit water-state semantics, but replace the overly planar slope with hydrology-shaped macro relief: catchment asymmetry, ridge / valley distance fields, foothill depositional fans, and contour-compatible terrace-permitted zones. Parcel generation remains blocked until this terrain pass is visually and numerically stronger.

truthApproved=false
visualApproved=false
visualAcceptance=false
browserQA=false
productionReady=false
