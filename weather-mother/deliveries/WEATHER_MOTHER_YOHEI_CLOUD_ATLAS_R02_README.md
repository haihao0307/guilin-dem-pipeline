# Weather Mother · YOHEI Cloud Atlas R0.2

Date: 2026-09-09

## Purpose

R0.2 preserves the accepted R0.1 cumulus study and expands it into one reviewable, single-file WebGL2 workbench covering the ten WMO cloud genera:

- Cumulus
- Cumulonimbus
- Stratocumulus
- Stratus
- Altocumulus
- Altostratus
- Nimbostratus
- Cirrus
- Cirrocumulus
- Cirrostratus

The ten buttons do not merely swap labels or colors. Each genus has a separate envelope function, camera framing, coverage default, optical-density tendency, wet-edge default, morphology speed and descriptive metadata.

## R0.2 changes requested by the user

1. Edge softness and moisture
   - Replaced reversed-edge `smoothstep` usage with ordered continuous ramps.
   - Added a controlled low-density shoulder rather than widening the entire cloud indiscriminately.
   - Added thin-rim forward-scattering support so a softer edge does not become only a blurred alpha fringe.
   - Kept `wetEdge` independent and inspectable.

2. Faster visible evolution
   - Increased the declared detail-coordinate drift and local phase evolution.
   - Added a per-genus morphology-speed control.
   - Speed is gated by `A_detail`; at `A_detail=0`, changing speed produces an identical density output.
   - This remains a deterministic morphology preview, not a claim of physical advection.

3. Complete cloud family
   - Added all ten cloud genera to one workbench.
   - Added previous/next navigation and an automatic atlas tour.
   - Added genus-specific height-level metadata based on the WMO International Cloud Atlas, with ranges explicitly treated as approximate and latitude-dependent.

## YOHEI-derived field interpretation

No original Yohei shader is embedded. R0.2 independently applies transferable ideas already reviewed by the project:

- log-spherical coordinates;
- correlated trigonometric bands;
- frequency doubling with amplitude halving;
- preservation of the existing low-frequency prefix;
- restrained coordinate folding used only for bounded detail organization.

These fields do not define cloud identity, meteorological physics, collision distance or a universal signed-distance field. Cloud envelopes and volumetric optics remain separate Weather Mother responsibilities.

## Browser QA

The included QA was run in Chromium WebGL2 through ANGLE SwiftShader under Xvfb. It proves software/browser execution and deterministic contracts, not target-device performance.

Passed gates:

- WebGL2 initialization;
- ten unique genus outputs;
- exact `A_detail=0` round trip;
- octave-prefix stability at `A_detail=0`;
- density independence from sun direction;
- morphology speed has no effect at `A_detail=0` and has visible effect when detail is enabled;
- wet-edge control changes the result;
- four diagnostic modes are distinct;
- 390×844 mobile panel operation;
- zero external runtime requests.

## Honest limitations

- Cumulonimbus is now structurally distinct and has an asymmetric anvil, but it remains a first morphology candidate rather than a meteorologically solved storm cell.
- No humidity, condensation, evaporation, buoyancy, precipitation microphysics or validated transport state is included yet.
- Single-scattering plus a low-cost powder/forward-scattering approximation is used; full multiple scattering is not implemented.
- The WMO level metadata is real-world guidance; the isolated normalized review volume is not yet georeferenced to a production world altitude.
- Visual acceptance remains the user's judgment and is not implied by automated QA.

## Files

- `weather-mother-yohei-cloud-atlas-r02.html` — single-file workbench
- `weather-mother-yohei-cloud-atlas-r02-qa.json` — browser and invariant QA
- `wm-r02-hero.png` — fixed-camera review evidence
- `wm-r02-contact-10.png` — ten-genus review sheet
