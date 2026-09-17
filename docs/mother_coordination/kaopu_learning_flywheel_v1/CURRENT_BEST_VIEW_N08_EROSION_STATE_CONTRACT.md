# Current Best View N08 — erosion state contract

Status: **Candidate partial / CPU bookkeeping verified**

- Erosion is a stateful transfer process, not a visual noise class.
- Store water volume, suspended sediment mass and bed/mobile-solid mass separately.
- Record sources, sinks, directed internal fluxes and boundary exports independently.
- Represent detachment and deposition as paired transfers; do not create or delete solid mass implicitly.
- Bind every transition to spatial support, `[start,end)`, event identity/revision and solver/parameter revision.
- Convert bed mass to height only with explicit area and density/porosity assumptions.
- Preserve event order: equal aggregate forcing can produce different exports and final distributions in a nonlinear process.
- Numerical conservation is necessary but not sufficient; provenance, process state, physical calibration, runtime evidence and user acceptance are separate gates.

Frozen: Canonical Truth and Frozen R1 are unchanged.  
Unknown: calibrated physics, real data, Houdini/target-runtime execution and Mother adoption.
