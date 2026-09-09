# Weather Mother · Flight Between Clouds R0.3 contract

Date: 2026-09-10

User direction: continue Weather Mother after R0.2, specifically add flight between clouds.

## Preserve

- R0.2 fixed publication commit `029d2e564b65a0874af439232ca8856c42981a14` remains immutable.
- Ten cloud genera and their type-specific envelope/density/optics remain available.
- YOHEI-derived fields remain bounded detail organization, not cloud physics.
- `A_detail=0` recovery and density/sun separation remain regression gates.

## R0.3 goal

Add a camera/observer mode that can travel through a corridor of repeated instances of the selected cloud genus. The observer must be able to be outside, at the wet rim, and inside thick cloud without switching object identity because of camera position.

## Flight semantics

- Flight position and orientation are explicit camera state.
- Manual desktop input: WASD / arrow keys + drag look; vertical motion via Q/E.
- Mobile input: on-screen directional controls plus drag look.
- Auto-flight is a camera convenience only and must not be described as aircraft dynamics.
- Camera speed is in normalized review-world units per second; this isolated workbench is not yet a georeferenced aviation simulator.
- Flight mode must never mutate cloud density merely because the camera moves.

## Flight cloud corridor

The selected genus is instantiated at multiple stable offsets along a finite corridor. Instance offsets are deterministic and independent of frame count and camera position. This gives real parallax and lets the observer pass through clear gaps, wet edges, and cores.

## Near-cloud visual requirements

- no billboard/plane reveal;
- no hard shell at cloud entry;
- transmittance falls continuously when entering thicker density;
- thin rims remain luminous/partially transmissive;
- inside-cloud view becomes low-contrast and locally directional rather than pure white screen;
- exiting the cloud recovers sky continuously;
- camera motion does not cause texture swimming or seed reset.

## R0.3 evidence gates

1. orbit mode still matches the R0.2 rendering contract within declared implementation changes;
2. flight camera changes position while density parameters remain fixed;
3. deterministic flight reset returns identical image for fixed time;
4. a scripted flight path crosses at least one cloud rim and one core, demonstrated by center-ray optical depth / transmittance changing over time;
5. selected cloud genus can be changed while flight mode remains operable;
6. 390×844 mobile controls are present and do not cover the main flight viewport;
7. public fixed-commit HTML is opened/verified before delivery.

Status: candidate implementation contract; visual acceptance remains user Judgment.
