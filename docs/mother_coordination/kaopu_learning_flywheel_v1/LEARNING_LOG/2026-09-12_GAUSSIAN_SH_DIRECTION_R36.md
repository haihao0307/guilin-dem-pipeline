# KAOPU learning cycle R36 — directional SH convention through SPZ and Three r186

Date: 2026-09-12  
Status: **Candidate partial**  
Production Mother mutation: **none**  
Frozen R1 mutation: **none**

## Highest-value bounded question

Does the constrained GraphDECO/Brush-style RDF -> Niantic SPZ default RUB -> Three.js r186 path preserve the SH1-SH3 directional appearance function, including view-vector sign and coefficient orientation?

This cycle continued coordinator parent `b0dc2a14bafadcda24671721af93de711bc9a349`. R35 Mother routing remained prepared with feedback null and acknowledgements false. No prior guidance was treated as adopted.

## Source locks and evidence relation

- GraphDECO reference: `54c035f7834b564019656c3e3fcc3646292f727d`.
- Niantic SPZ: `affd0ecea7fbb4c265ee119475af7ee5b2997482`.
- Three.js r186: `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- Full lock: `references/gaussian-sh-direction-r36/SOURCE_LOCK.json`.

GraphDECO supplies the trainer-reference SH convention. SPZ and Three are distinct software roots but form the dependent delivery chain under test. Agreement is derived interoperability evidence, not independent physical corroboration. No AI review was used in R36.

## Observation

### O-R36-1 — GraphDECO and Three use the same view-vector order and SH1-SH3 polynomial layout

The fixed GraphDECO renderer computes `splat center - camera center`, normalizes it, and evaluates the real SH basis in coefficient order. The fixed Three r186 source also computes `center - localCameraPosition` and uses the corresponding SH1-SH3 coefficient order and signs.

Three stores rounded decimal constants. Across this fixture, its maximum difference from the locked GraphDECO constants was `1.0450229925851318e-7` in a resulting color channel. This is a source-rounding observation, not an image-quality judgment.

### O-R36-2 — actual Niantic RDF-to-RUB conversion preserved the directional function

The C++ harness executed Niantic `GaussianCloud::convertCoordinates(RDF, RUB)` on one SH3 splat containing 45 distinct coefficient/channel values. Across 14 normalized axis, diagonal and oblique directions, evaluating the source RDF function and converted RUB function produced maximum error `0`.

### O-R36-3 — actual packer and actual Three loader preserved the quantization-grid fixture

The harness then executed the pinned Niantic SPZ v4 packer with `from=RDF`. The actual asynchronous Three r186 `SPZLoader` loaded the generated default-RUB file. All 45 SH1-SH3 coefficients matched the direct converted values with maximum coefficient error `0` because the fixture intentionally used values exactly representable under default 5-bit/4-bit quantization.

This is not a claim that arbitrary coefficients are lossless.

### O-R36-4 — both required negative controls failed strongly

- Flipping directions from RDF to RUB without transforming SH coefficients produced maximum channel error `1.602190796525118`.
- Reversing the view vector to `camera - center` produced maximum channel error `1.6021908159791487`.

Therefore a successful parse and correct coefficient count cannot substitute for explicit coordinate-frame, coefficient-orientation and view-vector contracts.

## Candidate

`ADAPTERS/gaussian_sh_direction_contract_r36.json` makes the constrained handoff explicit:

- source frame RDF; target frame RUB;
- view direction is always normalized `splat center - camera center`;
- position, camera pose, quaternion/covariance and SH orientation form one atomic conversion;
- source and target coefficient layouts and maximum degree must be declared;
- a fixed directional regression must accompany any adapter or version change.

## Current Best View

Within the exact pinned path and representable synthetic coefficients, no SH-direction convention conflict was found for degrees 1–3. R33's warning remains essential: coordinate transformation must include SH, quaternion/covariance and camera semantics together. R36 now turns that warning into an executable positive fixture and two discriminating negative controls.

This result does not resolve R35's DC-clamp incompatibility, arbitrary SPZ quantization loss, real Brush output behavior or rendered-image acceptance. Those remain separate gates.

## Rejected

- **Rejected:** “RDF and RUB labels alone prove appearance compatibility.” Compatibility required actual coefficient conversion and directional evaluation.
- **Rejected:** “Only positions and cameras need axis conversion.” The no-SH-transform negative control is a counterexample.
- **Rejected:** “Camera-to-splat and splat-to-camera directions are interchangeable.” Odd SH bands make the sign observable.
- **Rejected:** “Zero error here means SPZ is lossless.” The test deliberately used quantization-grid coefficients.
- **Rejected:** “A CPU source-semantic pass proves GPU or real-photo appearance.” Neither was executed.

## Frozen

- Formal R1 remains frozen and unchanged.
- No production Mother branch or asset changed.
- RealityScan remains available; no new Mother was created.
- SH remains captured directional appearance, not a physical relighting material.

## Unknown

- No user photo set, COLMAP pose solve, Brush training or cleanup was available.
- Actual Brush coefficient distributions and arbitrary-coefficient quantization errors are untested.
- No Three GPU render, fixed-view image comparison, macOS/iPhone/Safari result or human acceptance exists.
- The candidate contract has not been integrated or acknowledged by any Mother.

## Result and routing

- Probe: `PROBES/gaussian_sh_direction_result_r36.json` — 6/6 checks passed.
- Tool routing: `TOOL_ROUTING_R36_GAUSSIAN_SH_DIRECTION.json`.
- Mother routing: `MOTHER_ROUTING_R36_GAUSSIAN_SH_DIRECTION.json` — prepared, all feedback null and acknowledgements false.

The future real-photo pilot must retain this directional fixture, use actual learned coefficient distributions, preserve the float checkpoint, and compare independent float-SH and r186 fixed-view images. R34 envelope/range gates and R35 DC-domain gate remain mandatory and separate.
