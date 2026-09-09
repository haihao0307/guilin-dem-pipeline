# KAOPU Learning R07 — Takram three-geospatial exact-commit study

Date: 2026-09-10
Status: Candidate. No production Mother mutation.

## Problem

The user provided `takram-design-engineering/three-geospatial` as a concrete atmosphere/cloud/geospatial/WebGPU reference and asked to bring it into the research loop, study it directly, and keep only what is genuinely useful.

## Source lock

Upstream `main` was read at signed commit `b012ad06d858fc035d88aacfd73f092f93c994e4` (2026-05-27). The upstream root README labels atmosphere/clouds Beta and core/effects Alpha. It states that the node-based WebGPU architecture will supersede the shader-chunk architecture and that the new API is incompatible with the old one. `@takram/three-atmosphere` is version 0.19.1 at this lock and depends on `@takram/three-geospatial` 0.9.1 plus `astronomy-engine`.

A normal `git clone` was attempted in the sandbox but DNS/network resolution was unavailable. The connected GitHub interface was therefore used to fetch exact-commit source and lock identities. No false claim of a local full clone is made.

## Observations from source

- WebGPU atmosphere combines a Bruneton-derived 4D scattering LUT with Hillaire-style multiple-scattering LUT and can raymarch camera-to-object inscattered light by default.
- `AtmosphereContext` explicitly keeps world→ECEF, ECI→ECEF, sun/moon directions, moon-fixed→ECEF, camera ECEF position, camera height and altitude correction as distinct runtime state.
- World-origin rebasing is documented for large ECEF coordinates; the world→ECEF matrix is required to contain translation/rotation only, no scale.
- Altitude correction projects the camera onto an ellipsoid and computes an osculating-sphere-center offset before evaluating the spherical atmosphere model.
- The legacy/default atmosphere parameter class contains Earth-oriented numerical defaults. These are implementation defaults, not evidence-backed KAOPU truth.
- Cloud rendering exposes quality budgets, temporal upscaling, Beer shadow maps, haze and light shafts; upstream explicitly documents ghosting/smearing, mean-depth aerial-perspective error, cube-sphere seams and constant ellipsoid-relative cloud-base altitude as limitations.
- WebGPU `HighpVelocityNode` computes object model-view matrices on CPU to avoid precision issues with meter-scale ECEF coordinates.
- The atmosphere changelog still contains breaking WebGPU API changes and unreleased architectural changes, so the implementation is not suitable as a frozen production dependency baseline.

## Executable probe

`PROBES/reference_frame_contract_r07.py` was run locally before publication.

Result:

- valid rigid world→ECEF packet: PASS
- packet containing scale in the frame transform: correctly rejected
- final: `2/2 PASS`

The probe is a KAOPU semantic/runtime contract test, not scientific evidence about Earth's atmosphere.

## Candidate distillation

The highest-value transferable idea is not a shader. It is the separation of **world truth/reference frames** from **runtime evaluation frames**. The same world can be evaluated near a floating local origin, in ECEF, or through a spherical atmosphere approximation without changing the world's identity, provided every adapter is explicit and reversible enough for its contract.

A second strong transfer is that one physical state can support several evaluator budgets. Cloud quality levels, LUT structures and raymarch choices should therefore live below `CloudState`/`AtmosphereState`, never inside them.

A third transfer is explicit failure accounting. Takram documents approximation seams, temporal artifacts, coordinate assumptions and API instability. KAOPU should preserve this habit: every fast evaluator carries its own validity/failure ledger.

## State ledger

### Observation
- Exact upstream commit/source identities and upstream status/API statements.
- Exact source structure of altitude correction, AtmosphereContext and HighpVelocityNode at the locked commit.

### Candidate
- `ReferenceFrameContract`: frame ID, reference surface, altitude reference, rigid runtime transform, state source and evaluator identity.
- `RuntimeEvaluatorBudget` separated from AtmosphereState/CloudState.
- `FrameAdapter` as a first-class layer between world state and renderer.
- temporal history as derived cache, never Observation Root.

### Current Best View
Use Takram as an engineering teacher for frame/evaluator architecture and failure modes. Do not use it as physical truth and do not directly vendor its evolving runtime API into production Mothers.

### Frozen
None.

### Rejected
- Takram default Earth coefficients as canonical KAOPU Earth truth.
- Full repository import into a production Mother merely because it renders well.
- Quality preset changing physical atmosphere/weather identity.
- World-origin rebasing changing canonical TLO/world coordinates.

### Unknown
- Actual performance and numerical error on our current Three.js/WebGPU/iOS targets.
- Stability of the node-based API across the next Three.js/Takram revisions.
- Whether Takram's current altitude-correction approximation is sufficient for every KAOPU ground-to-space query.
- How cloud state should best reference geopotential, terrain and weather-model vertical coordinates in the future Weather Mother.

## Next gate

Build one tiny KAOPU `ReferenceFrame + RuntimeAtmospherePacket` fixture and make two evaluator adapters consume the identical state: one local/rebased Three.js-style runtime and one reference-space query. Measure coordinate/altitude consistency and record any approximation envelope. Keep this separate from the still-open authoritative NRLMSIS/HITRAN physical-reference gate.
