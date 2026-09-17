# N08 — conservative erosion state and history contract

## Bounded question

N02-5 asks what state is necessary beyond procedural noise before a terrain change may be called erosion. This round tests only a two-cell accounting contract for water, suspended sediment, bed material, internal transport, external sources/sinks, open boundaries and event history. It is not a calibrated erosion solver and does not alter a production terrain.

## Inheritance and sources

- N01–N07 remain the procedural-field track. Noise may parameterize erodibility or initial heterogeneity, but a field value is not stored water, transported sediment or process history.
- W01–W03 remain the governing event rules: immutable directed fluxes, half-open time intervals, quantity kind and unit, event identity, explicit revision and deterministic replay.
- [SideFX HeightField Erode 3.0](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_erode.html) is iterative and emits distinct `height`, `sediment`, `debris`, `flow` and `flowdir` layers.
- [SideFX HeightField Erode Hydro](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_erode_hydro.html) binds distinct water, sediment, debris, eroding-height and reference-bedrock layers; its sediment capacity is per unit moving water and deposition converts excess sediment to debris.
- [SideFX HeightField Slump](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_slump.html) makes edge outflow and removal explicit policies. Material leaving the heightfield is erased when outflow is enabled; removal is a separate sink.

These are transferable state and boundary contracts from a mature system. They do not establish physical truth for KAOPU or validate this round's coefficients.

Source receipt: [`SOURCE_LOCK.json`](../references/erosion-state-contract-n08/SOURCE_LOCK.json)  
Probe: [`erosion_state_contract_probe_n08.cpp`](../PROBES/erosion_state_contract_probe_n08.cpp)  
Result: [`erosion_state_contract_result_n08.json`](../PROBES/erosion_state_contract_result_n08.json)

## Executable method

The deterministic C++ probe uses two cells and three half-open steps. Each cell stores water volume, suspended sediment mass and bed/mobile-solid mass. Each step records rainfall, bed-to-suspension detachment, directed internal water and sediment flux, suspension-to-bed deposition, and boundary export. Coefficients are deliberately simple and fixed; their only purpose is to expose bookkeeping and history failures.

Two histories contain the same total `2 m³` rainfall:

- early pulse: `[2, 0, 0] m³`;
- late pulse: `[0, 0, 2] m³`.

Fifteen semantic checks cover water and sediment conservation, bed/suspension transfer identities, nonnegative state, boundary accounting, event-order sensitivity, two noise counterexamples and byte-stable replay.

## Observation

All 15 local CPU checks passed and a second execution reproduced the result byte-for-byte.

- Both histories close water and sediment residuals to the recorded 12-decimal precision.
- Equal rainfall totals do not erase history. The final bed-plus-suspension distribution differs by `4.754592 kg` in L1 distance. The early pulse exports `1.725408 kg` sediment; the late pulse exports `0.480000 kg`.
- Omitting the open boundary from the early-pulse ledger creates apparent residuals of `1.204000 m³` water and `1.725408 kg` sediment.
- A uniform `+0.01 m` cosmetic height offset over `20 m²`, interpreted using `1600 kg/m³`, creates an unbooked `320 kg` solid-mass change.
- Equal-area `+0.01/-0.01 m` offsets have zero global mass change, yet still lack water, suspension, flux, source, boundary and history receipts. Global conservation is necessary but not sufficient to establish erosion.

The CPU probe and any CI replay share one model and one design; replay proves reproducibility, not independent physical or runtime evidence.

## Candidate / Current Best View

Before a terrain mutation is labeled erosion, preserve at least:

1. spatial support identity and a half-open time interval;
2. water storage in a fixed volume unit;
3. suspended-sediment mass and bed/mobile-solid mass in fixed mass units;
4. directed internal water and sediment fluxes, counted once;
5. external water/solid sources and explicit sinks;
6. boundary exports and the chosen edge policy;
7. detachment and deposition as paired transfers between stores;
8. event identity, payload hash and revision chain for ordered replay;
9. parameter, solver and implementation revisions.

Height is a derived geometric representation unless area and density/porosity conversion are fixed. A visual `flow` layer, animated phase or noise displacement remains presentation evidence unless it is coupled to this process ledger.

Status: **Candidate partial / CPU bookkeeping verified**. N02-5 is complete only as a minimum-state and counterexample contract.

## Rejected

- “A terrain-changing noise field is erosion.”
- “Zero global mean displacement proves a valid erosion process.”
- “The same total rainfall produces the same terrain regardless of event order.”
- “Internal cell-to-cell transfer may be counted as a new global source.”
- “Open-boundary loss may be omitted because it is outside the visible heightfield.”
- “Height units can be summed directly with sediment mass.”
- “A conserved toy ledger proves realistic hydrology, sediment mechanics or production readiness.”

## Unknown / routing state

- Real rainfall, infiltration, evaporation, porosity, density, grain classes, entrainment/deposition laws, stability limits, resolution and boundary conditions remain Unknown.
- Houdini execution, target GPU/browser behavior, visual acceptance, collision coupling and actual Mother implementation remain Unknown.
- Landscape PR79 and Farmland PR65 have no new feedback after the existing N02 publication. No message was repeated.
- Brick material PR15, Brick shape PR17 and Tiles/building PR11 remain verified entries only; no erosion routing was delivered.
- Canonical Truth, Frozen R1 and all production Mother branches remain unchanged.

## Next learning gap

Advance N02-6 independently: select one small, source-licensed modular shader function that improves an authorized current surface task while preserving coordinate, state and optics separation. Do not use the erosion receipt as permission to start a terrain simulation.

First-tier expert AI was not called; routine expert discussion remains owned by the separate night expert task.
