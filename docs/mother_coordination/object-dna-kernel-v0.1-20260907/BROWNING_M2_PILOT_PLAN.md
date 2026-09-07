# Aircraft Browning M2 / AN/M2 — Object DNA Pilot Plan

Purpose: use the existing verified Aircraft Browning reference and the current native candidate as the first Object DNA Kernel pilot. The goal is to validate the object system, not to treat the current exterior candidate as complete.

## Pilot identity

- Domain: Mechanical DNA
- Essential type: firearm / aircraft armament object, historical visualization scope
- Pilot object family: Aircraft Browning M2 / AN/M2
- Aircraft priority context: B-24
- Runtime target: browser
- Review delivery: fixed-commit single-file HTML through raw.githack

Exact aircraft block, gun station, service date and installation configuration remain evidence-gated.

## Phase 1 — Identity, ontology and evidence

1. Freeze a stable pilot Entity ID.
2. Record ontology path and configuration identity separately.
3. Keep the verified reference GLB as a read-only Reference Twin.
4. Register period manual, drawing, photograph and catalog evidence with applicability and confidence.
5. Keep unknown B-24 installation relationships explicitly unknown.

Gate: no geometry item may be promoted to accepted without a supporting evidence/measurement record.

## Phase 2 — Measurement Kernel

1. Establish shared comparison frame.
2. Determine principal axis and named exterior datums.
3. Extract normalized cross-section series from Reference Twin.
4. Compare Reference Twin and Native Twin in the same frame.
5. Track section-envelope, silhouette and anchor differences.
6. Preserve provenance and uncertainty for each measurement.

R01 tool direction already researched in AIRCRAFT: Trimesh for ingest/section semantics, VTK for fast background cutting/distance, NumPy/SciPy for fitting, Three.js plus optional three-mesh-bvh for browser queries, CadQuery/OCP for parametric compilation where suitable.

## Phase 3 — Semantic exterior reconstruction

Priority order for the current visual gaps:
1. barrel-to-receiver exterior continuity
2. receiver/toplevel silhouette and plate layering
3. visible feed-side opening/top-cover relationships
4. visible ejection/disposal-side openings only where evidence supports them
5. sight and sight base appropriate to the specific aircraft context
6. exterior controls and fastener families
7. B-24-specific box, feed path, mount/suspension and disposal relationships only after applicability is resolved

No internal functional mechanism, fabrication tolerance or operating guidance is required for the pilot.

## Phase 4 — Surface Coordinate Program

1. Assign semantic coordinate frames to receiver, plates, tube/barrel surfaces, grips, fasteners and external mount interfaces.
2. Record orientation and scale explicitly.
3. Compile UV only when a target needs UV.
4. Run flip/stretch/seam checks against fixed semantic directions.

Gate: material work must not hide coordinate or shape errors.

## Phase 5 — Material Program

1. Separate substrate, surface treatment, manufacturing traces, use/contact, maintenance film, contamination, oxidation candidate and damage.
2. Bind each cause to separate channel responses.
3. Keep a neutral same-material comparison mode for shape review.
4. Record historical finish calibration independently from generic PBR quality.

## Phase 6 — Lifecycle and time

Model time as history, not a single ageing slider.

Candidate state inputs:
- manufacture/start state
- storage exposure
- service exposure
- maintenance events
- contact/wear history
- environmental history
- repair/replacement events

`age` alone must never determine the final surface state.

## Phase 7 — Behavior and animation

Animation is compiled from validated state and relationships.

For this pilot, keep behavior at historical visual-presentation scope. A visible action cannot be enabled unless its participating parts and external relationships exist in the FunctionGraph and pass evidence gates.

## Phase 8 — World Kernel bridge

When the object is placed into a B-24 world state, export the World Object Contract:
- identity
- valid time interval
- geographic/world anchor as appropriate
- aircraft/container relation
- local transform
- material/lifecycle state
- behavior capabilities
- evidence and confidence

World Kernel decides shared world time, placement, reachability, environment and cross-object consistency.

## Success criteria for the pilot

The pilot is successful when:
1. the same permanent Object DNA can regenerate the review object without storing product mesh as the primary asset;
2. Reference Twin and Native Twin can be numerically and visually compared;
3. every major visible part can be traced to semantics, evidence and measurement;
4. surface coordinates and materials remain stable through regeneration;
5. time-state changes are explainable from history and environment;
6. behavior is state-driven;
7. the object can enter World Kernel through the shared contract;
8. browser runtime remains the primary execution target.

Current W07 is an intermediate comparison workbench and remains visually unaccepted and not production-ready.
