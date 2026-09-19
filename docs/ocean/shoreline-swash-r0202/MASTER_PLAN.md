# Ocean Mother R0.2.2 — Shoreline, Swash, Wet Sand and Intertidal Coupling

Date: 2026-09-19

## Reference boundary

User reference: `https://x.com/cryptomanavan/status/2096111310177992738/video/1`.

The post metadata and caption are retrievable, but the X video stream is not currently readable by the coordination runtime. Therefore this plan does **not** claim frame-by-frame observation of the reference. The user identifies the valuable feature as a convincing beach/shoreline result. The reference remains `video_pending`; it must be uploaded or otherwise made readable before any shot-specific claim is accepted.

This task extracts a reusable shoreline system, not a visual copy. Any feature inferred before the video is readable is a candidate and must be labelled as such.

## Product goal

Add a coherent beach boundary to Ocean Mother and Ocean Life so that offshore water, reef-protected lagoon water, swash, wet sand, foam, substrate and intertidal life are different views of one world state.

The Stone Money Island truth is not a generic open-ocean surf beach. The system must support at least three exposure regimes:

1. reef-protected white-sand lagoon shore — low-energy, clear, short run-up;
2. channel / island-edge shore — directional flow and asymmetric wetting;
3. exposed reef-edge beach — stronger breaker and backwash energy.

A visually dramatic open-ocean surf result may only be used where exposure, depth and reef geometry justify it.

## Non-negotiable world contract

No Mother may invent a private shoreline, waterline or wetness mask. The following queries are authoritative:

```text
surfaceAt(x, z, worldTime)
  -> eta, normal, surfaceVelocity, depth, breakerEnergy, clarity

shoreAt(x, z, worldTime)
  -> signedDistance, tangent, outwardNormal, exposure, beachSlope

substrateAt(x, z)
  -> elevation, materialClass, porosity, roughness, erodibility

swashAt(x, z, worldTime)
  -> inundation, flowVelocity, runupPhase, backwashPhase, foamSource

wetnessAt(x, z, worldTime)
  -> waterContent, lastInundationTime, dryingRate, opticalDarkening

intertidalAt(x, z, worldTime)
  -> immersionFraction, waveStress, salinityCandidate, habitatClass
```

Visible water, collision, fish, canoe, lure, footprints, foam, wet sand and shore life must consume these same fields.

## Representation

The implementation is a single multiscale world expression, not a stack of unrelated effects:

- offshore and lagoon wave field: existing frozen Ocean Mother source;
- depth transformation: shoaling/refraction/breaker candidate derived from bed depth and exposure;
- local shoreline solver: shallow-water/swash patch evaluated only where the domain intersects the observed shore, without changing the underlying physical definition;
- event fields: contact foam, bubbles, footprints, fish landing, canoe beaching and debris response;
- memory fields: foam age and sand moisture retain recent history instead of following the current frame only.

The local solver is an adapter around the canonical ocean, not a second ocean. It must be disableable for A/B comparison and may not mutate the frozen canonical source.

## First executable vertical slice

Build one 24–40 m white-sand / shallow-reef shoreline cell at the Stone Money Island wake-up bay:

- one continuous bed profile from dry sand to shallow lagoon;
- one wave train transformed by local depth;
- breaker onset where justified;
- uprush and backwash across the same terrain used for collision;
- foam generated from breaker/contact energy and advected with swash;
- wet sand darkening based on inundation history and drying;
- one fish landing event and one canoe-beaching probe using the same shore fields;
- one intertidal habitat strip for Ocean Life, initially evidence-labelled rather than species-complete.

Do not add broad content or many beach types before this cell passes.

## Mother responsibilities

### Ocean Mother

Owns `surfaceAt`, depth transformation, swash flow, foam source/advection/decay, water-air transition and water contact events. It may not paint a shoreline independent of terrain.

### Landscape / Beach Profile

Owns continuous bed elevation, dry-sand profile, berm / wrack-line candidates, reef-flat transition and substrate classes. It may not change water height to hide terrain errors.

### Ocean Life

Owns habitat intent and reactions derived from immersion fraction, wave stress and substrate. First slice: algae/wrack candidate, small intertidal life placeholders, fish stranding/escape response. Species identity remains unknown unless supported.

### Game Mother

Consumes the same fields for footprints, shallow wading, fish landing, lure recovery, canoe beaching and risk/noise. It does not create private foam, wetness or beach collision.

### Weather Mother

Supplies wind, rain, evaporation and storm forcing. Rain wetness must remain distinguishable from seawater inundation.

### QA / Mobile

Verifies continuity, determinism, frame-rate independence, 390×844 framing, memory-field stability and performance counters.

## Acceptance gates

1. Water/terrain contact gap <= 0.05 m in the first cell under the tested tide range.
2. Foam source remains within the physical breaker/contact band; no detached repeating ribbon.
3. Wet-sand front follows maximum recent inundation and recedes by drying, not by camera position.
4. Same shoreline and bed are used by rendering, collision, fish landing and canoe beaching.
5. No water climbs a terrain barrier without a positive connected swash path.
6. 30/60/120 fps replays produce equivalent wetness/foam state within documented tolerance.
7. Save/restore preserves water time, foam age, wetness memory and event identity.
8. Desktop and 390×844 browser captures show dry sand, wet sand, active swash, shallow water and reef transition without camera clipping.
9. Existing Ocean Mother canonical files remain byte-stable.
10. `visualAcceptance`, `physicalDeviceTest` and `productionReady` remain false until separately proven.

## Required first delivery

A lane is not started by discussion. Its first accepted delivery must contain:

- at least one source-code commit that changes executable behavior;
- an automated test or numerical receipt;
- desktop and 390×844 visual evidence where rendering is affected;
- `KNOWN_LIMITATIONS.md` naming unsupported claims and blockers;
- exact base/head SHAs and commands.

Research-only notes are supporting material, not execution progress.
