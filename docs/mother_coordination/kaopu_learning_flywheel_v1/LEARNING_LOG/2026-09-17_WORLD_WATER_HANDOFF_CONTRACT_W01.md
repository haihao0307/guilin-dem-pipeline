# KAOPU Learning Log — Cross-Mother water handoff contract W01

## Question

What minimum handoff contract prevents mass double-counting when Weather, Landscape and Farmland each participate in a two-field, two-interval water chain?

## Evidence and bounded method

FAO-56 Chapter 8 keeps precipitation, runoff, irrigation, capillary rise, evapotranspiration and deep percolation as separate water-balance terms. EPA SWMM 5.2 defines continuity against initial storage plus inflow versus final storage plus outflow, reports process terms separately and warns that time-step selection can affect continuity. These are two distinct official documentation roots.

A synthetic CPU fixture then used one rain event, one canal delivery, two serial fields and one river receptor over two one-hour intervals. It did not estimate real KAOPU hydrology. All seventeen checks passed. Each node and the whole system closed to zero residual in both intervals. A deliberately collapsed model that applied the same 10 mm event directly to the two fields and again as Landscape-derived inflow would create an exact 18 m³ surplus; the contract rejected it before state mutation.

## Observation

- A depth forcing is not a volume transfer until it is converted over an explicit spatial support: 10 mm over 1,000 m² is 10 m³; over 800 m² it is 8 m³.
- One directed internal F1→F2 flux cancels from the global balance while remaining visible in both node balances.
- Continuity requires explicit initial/final storage, external inflow/outflow and interval identity. A green visual state or a single shared water scalar does not supply this evidence.
- The same weather event may legitimately cover disjoint supports. Duplicate detection therefore cannot use event ID alone.

## Candidate

Use an immutable directed flux ledger at cross-Mother boundaries. Each record carries:

- one `fluxId` and one authorized writer;
- source, destination and process stage;
- quantity and unit (`m³` at the exchange boundary);
- interval identity and duration;
- provenance event;
- for source-measure conversions, unique `event + interval + spatial support` identity, with the process stage recorded separately.

Weather owns forcing events, not downstream storage. Landscape owns its runoff/canal derivation and emitted delivery fluxes. Farmland owns field storage, field-to-field transfer, field losses and field discharge. Display wetness is read-only presentation state and is not admitted to the mass ledger.

## Current Best View

Keep forcing, transfer flux, storage, losses/discharge and presentation as separate records. A compact Farmland-only calculation can be valid only when upstream inputs are frozen and no Weather/Landscape process writes the same source support concurrently; it is not a general cross-Mother contract.

## Rejected

- “One shared water value is enough for Weather, Landscape and Farmland.”
- “Rain depth can be inserted directly into a volume ledger.”
- “The same event/support may be converted once as direct field rain and again as derived runoff without an explicit split.”
- “Each endpoint can author its own copy of an internal transfer.”
- “Presentation wetness, shader color or apparent pooling can close a physical mass balance.”
- “A zero global residual proves that the runoff, infiltration or evapotranspiration parameters are physically correct.”

## Unknown

- Real rainfall, runoff, infiltration, evapotranspiration, percolation and routing parameters remain unverified.
- Real field/canal/river geometry, DEM support partitions and ownership boundaries remain unverified.
- No Weather/Landscape/Farmland joint runtime, browser/device acceptance, collision coupling or human review was performed.
- No Mother has acknowledged or adopted this contract.

## Next gate

In a Mother-owned isolated trial, freeze one small spatial support map and one interval calendar, emit one writer-owned ledger for a rain/canal/two-field/river chain, and replay both per-node and global continuity. Include an intentional overlapping-support conversion negative control. Keep calibration and visual acceptance as separate gates.

Mother feedback before this round: the 2026-09-17 coordination note recorded no real Mother participants or adoption. Routing remains prepared only.

First-tier expert AI: not called. The reserved expert question package was not answered or simulated in this learning round.
