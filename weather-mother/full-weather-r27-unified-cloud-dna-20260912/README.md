# Weather Mother · Unified Cloud Object DNA R27

Date: 2026-09-12

## Current target

Continue from the accepted R22/R26 line and the ten-genus R0.2 cloud work without creating another parallel cloud system.

R27 has one cloud-world density query shared by:

- observe mode;
- flight mode;
- density inspection;
- seeded cloud instances along the flight world.

Changing the observer no longer swaps to a special “silver cloud.” Silver lining is an optical result of cloud density, wet edge, sun direction and extinction.

## Preserved sources and locks

- R22 full Weather Mother remains frozen and is not overwritten.
- R26 observation-bandwidth evidence remains frozen and is not overwritten.
- R0.2 ten cloud genera remain the genus/envelope source line.
- YOHEI-derived work contributes only transferable field-organization methods: correlated bands, stable low-frequency prefix and distance-dependent observation bandwidth. No original YOHEI shader or fixed image is embedded in R27.

## Cloud identity and seeds

R27 exposes two reproducible integer seeds:

- `Cloud Seed`: controls object identity, major lobe arrangement, gaps, asymmetry and deterministic instance placement.
- `Detail Seed`: controls only local erosion and high-frequency structure.

The detail seed is isolated from the large-scale envelope. Local QA measured a low-resolution image correlation of `0.9999317` when only the detail seed changed. Changing the object seed reduced the corresponding correlation to `0.9635237`, demonstrating that it changes the large structure rather than only pixel noise.

## Architecture separation

The page keeps these responsibilities separate:

- `EnvironmentDriver`: sun and wind forcing inputs;
- `WorldClock`: world time and preview rate;
- `CloudState`: genus, seeds, coverage, wet edge, detail and extinction;
- `ObserverState`: observe/flight camera state;
- `CloudQuery`: observer-independent density query;
- `RenderCache`: resolution, ray budget and frame-cache state.

Visual cloud density is not declared to be physical precipitation rate. Rain remains a separate state and evidence problem.

## Performance and startup response

The mobile-safe route uses WebGL1 and has no 3D noise texture, 3D light cache or temporal-history warmup. It compiles one procedural shader and renders at a bounded internal resolution.

Automatic/mobile quality uses:

- capped internal pixel count;
- reduced initial ray budget;
- larger empty-space steps;
- one low-cost sun transmittance probe;
- distance-dependent detail bandwidth;
- adaptive ray count from observed frame arrival;
- paused-world redraw only when state changes.

Local Chromium/ANGLE SwiftShader QA recorded startup to the second rendered frame at approximately `526 ms` for a 640×400 desktop test and `591 ms` at 390×844 mobile emulation. These numbers are browser-run evidence on the QA machine, not a promise for every target device.

## Local QA completed

- ten cloud genera produced ten distinct rendered hashes;
- the same density query returned the same value in observe and flight modes;
- identical Cloud Seed produced identical CPU query samples;
- Detail Seed changed pixels while preserving low-frequency structure;
- Cloud Seed changed the large structure;
- 390×844 control panel opened correctly;
- 390×844 horizontal overflow was zero;
- flight input changed position, yaw and roll;
- no page or console errors were recorded;
- no external runtime dependency is required.

## Honest status

- `browserQA=true` for the local evidence file;
- `realIPhoneAcceptance=false` until the fixed public commit is opened on the user’s device;
- `visualAcceptance=false` until user Judgment;
- `productionReady=false`;
- the on-screen aircraft is an analytic flight marker inside the same volume render, not the final R21 aircraft geometry;
- validated humidity, condensation, buoyancy, precipitation microphysics and CloudTransport are not included.
