# Heritage brick identity audit

Date: 2026-10-13 UTC

## Scope and status

This is an engineering audit of the Kowloon heritage candidate's brick-coordinate and brick-identity interface. It is not historical colour calibration or final visual acceptance.

- Original A model: `04e5ac129512030875b033af40e4e5c553a0f9cd`.
- Evidence: the already completed `towerWindow` real-GPU diagnostic readback and its receipt. No GPU job was launched for this audit.
- B implementation: locally edited `StationBrickSample` in `candidate/station-matter.mjs`, reviewed read-only. This document does not claim that B has passed GPU testing or improved the rendered image.
- Only this report was written by the auditor. No production implementation, QA implementation, ground, shed, lighting, or material mother was edited by the auditor.
- No source photograph or restricted reference image is included or reproduced.

## Main finding

The original adapter assigned more than one seed to one physical staggered brick. Its seed also depended on the wall-normal sampling coordinate. Geometry and matter were consistent with each other, but both used this inconsistent brick identity.

Original coordinate mapping, `candidate/station-field.mjs`, `brickQ`:

- `row = floor(bp.y / .073)`.
- Odd rows have `shift = .125`; even rows have zero shift.
- `face = bp.z` for material ID 12, otherwise `bp.x`.
- The physical column is `floor((face + shift) / .25)`.

Original identity in both `evaluateStationGeometry` and `evaluateStationMatter`:

`seed = 19 + row * 13 + floor((bp.x + bp.z) / .25)`.

The identity did not use the same staggered column as the geometry coordinates. For an ID-1 front wall, `bp.z` is a normal-depth coordinate, yet changing it could change the seed. For ID 12, the analogous unwanted depth dependence comes from `bp.x`.

The downstream effect is broader than a colour selection: `variant = abs(seed) % 4` controls the original fitted-edge orientation; the surface function uses the seed for coordinate rotation, field offsets and material variation. A seed discontinuity can therefore affect the edge geometry, albedo, roughness and microheight together.

## Evidence A: measurements from existing real-GPU output

Files:

- `evidence-lantern-small/towerWindow/readback.json`
- `evidence-lantern-small/towerWindow/receipt.json`
- `material-readback-small-analysis.json`

The receipt identifies the A commit above, a 320 × 213 full render buffer, a 112 × 180 crop and a 16 × 16 diagnostic shadow trace. Its scope explicitly excludes final scene or realtime acceptance.

### Decoding and classification

The readback stores RGBA32F bit patterns as unsigned integers, with rows bottom to top. They were reinterpreted as float32, not numerically converted from the integer values. All 7,411 brick-family pixels in this crop are material ID 1, role seed 71 and source member 1.

For these tower pixels, world/station-local point `p` was recovered from the recorded construction coordinate `qSeed.xyz + (24, 0, 4)`. The role seed in `qSeed.w` is not the material's per-brick seed. The old per-brick seed and the physical `(row, column)` were recomputed from the documented A expressions.

Mortar classification is inferred from `albedo.g / albedo.r > .6`, following the existing analysis. It is not a separately recorded mother/material label. Brick-body comparisons below exclude that inferred mortar mask.

### Same-brick identity instability

Restricting to brick-body pixels with recorded geometric `normal.z > .999`:

- 3,935 pixels occupy 344 physical `(row, column)` cells.
- 342 cells contain at least two sampled pixels.
- 223 of those 342 cells contain more than one old seed.

Concrete example: both points are in row 235, column 91.

| Quantity | Point A1 | Point A2 |
|---|---:|---:|
| Full-buffer pixel, bottom-left origin | (116, 178) | (115, 176) |
| p.x | 22.8161430 | 22.7880077 |
| p.y | 17.2134914 | 17.1683254 |
| p.z | 6.9603620 | 6.9606409 |
| Recomputed old seed | 3193 | 3192 |
| Old variant | 1 | 0 |
| Recorded linear albedo luminance | 0.078089 | 0.215587 |
| Recorded geometric normal | (0, 0, 1) | (0, 0, 1) |
| Recorded microheight, mm | -0.317478 | +0.477584 |

The albedo luminance ratio is approximately 2.76. This is evidence of an identity discontinuity inside one physical brick and of an albedo-level contrast. It does **not** establish that the entire 2.76 ratio is caused by the seed change, because the two points also have different positions within the mother field. Their equal geometric normals exclude a geometric-normal lighting explanation for the already recorded albedo difference.

### Real points vulnerable to normal-depth identity changes

Among 4,094 brick-body pixels with `normal.z > .99`, 14 have different recomputed seeds when only their Z coordinate is perturbed by ±0.45 mm. These are CPU perturbations around measured GPU points, not new GPU samples.

Example measured point:

`p = (22.5394573, 14.9281263, 6.9603648)`.

It remains in row 204, column 90. The old seed switches between 2788 and 2789 under the stated Z perturbation. The proposed cell-derived seed is 2761 and does not depend on this depth coordinate.

## Evidence B: deterministic CPU arithmetic reproductions

These are float32 arithmetic tests of the indexing expressions. They are not a CPU substitute for the brick mother or a claim of new GPU verification.

At `y = 17.1915`, `z = 6.96`:

| x | Physical row / column | Old seed | Cell-derived seed |
|---:|---|---:|---:|
| 22.78975 | 235 / 91 | 3192 | 3165 |
| 22.79025 | 235 / 91 | 3193 | 3165 |

At fixed `x = 22.79`, `y = 17.1915`:

| z | Physical row / column | Old seed | Cell-derived seed |
|---:|---|---:|---:|
| 6.95975 | 235 / 91 | 3192 | 3165 |
| 6.96025 | 235 / 91 | 3193 | 3165 |

In the second pair, the brick-local XY coordinates are unchanged. The identity change is introduced solely by the old seed's unwanted depth dependence.

The true staggered boundary for this cell is `x = 22.875`. Points at 22.87475 and 22.87525 correctly belong to columns 91 and 92, giving cell-derived seeds 3165 and 3166.

## Contrast contributors and limits

The identity bug is a confirmed interface error. It is not the only contributor to visible brick contrast.

Confirmed from the mother and adapter:

- Nominal brick face dimensions: 240 × 61.1538 mm.
- Repetition pitch: 250 × 73 mm.
- Ideal flat-plane gap fraction, before rounded edges and fitted-edge variation: approximately 19.58%.
- The adapter places the mortar field 6 mm behind the nominal wall plane.
- In the actual crop, inferred mortar occupies 1,805 / 7,411 brick-family pixels, approximately 24.36%. Projection, reveal surfaces and geometry mean this is not directly the same measurement as the ideal plane fraction.

Recorded flat-facing albedo medians:

- Brick body: 0.10760 linear luminance.
- Inferred mortar: 0.25420 linear luminance.
- Ratio: approximately 2.36.

The A image has a nominal physical pixel footprint of approximately 20.98–27.22 mm at brick hits, computed from the recorded trace distance, projection and full render resolution. The 10–11.85 mm nominal gaps are therefore subpixel in this diagnostic. This provides a concrete undersampling condition; it does not quantify how much of a particular displayed stripe is aliasing.

A CPU reconstruction of the existing composite's screen-derivative micro-normal calculation gives brick-body angular changes of approximately 0.48° median and 1.49° at the 95th percentile. This is an approximate reconstruction from existing buffers, not another GPU attachment. It supports treating microheight as a secondary contributor to the widespread contrast in this small image. Boundary outliers are outside this identity-only repair's scope.

The diagnostic shadow resolution and absence of controlled light/material ablations prevent a definitive attribution of all displayed contrast to lighting, geometry or albedo. No colour-space error or light-energy error has been established by this audit. The original mother should not be replaced by a flat colour merely to suppress the diagnostic's contrast.

## Read-only review of the local B implementation

Reviewed `StationBrickSample` snapshot SHA-256:

`0ceb936046b4543bc0720971afe2543477b9cfc37101bcf2ecd11bc5950360da`

This hash is for the complete `candidate/station-matter.mjs` file at the initial review; later parent edits must be validated separately.

The implementation correctly:

1. Computes `row`, odd-row `shift`, `face` and `phase` once.
2. Returns the local coordinate and `19 + row * 13 + floor(phase)` from that shared calculation.
3. Calls the helper from both production geometry and matter evaluation.
4. Retains the original `brickQ` and original seed expression on the non-heritage branch.
5. Preserves the existing role-175 bridge: tangent coordinate from `h.q.x`, height from `p.y`, and local depth from `h.q.z`.
6. Does not modify the mother, variation 0.42, mortar binding, maintenance state or shared lighting.

Current production brick heritage bindings are roles 71, 175 and 191. The helper uses the existing `stationHeritageMember` predicate and is called only for brick IDs 1 and 12; these current bindings therefore give the intended repair scope. There is no evidence requiring the construction member index `h.sourceSeed` to be added as another random offset. Keeping it out avoids an unrelated change of material identity at construction-member boundaries.

The candidate and reference brick mother files are byte-identical:

`2663694faf7defb6d8131a7e2eddb726cbe40f59ad6babd4f51e6e5c2dff0e0a`.

## Numeric QA review and actionable findings

The initial reviewed QA defines 20 fixtures × 3 ages = 60 cases. Row 4 returns the actual production helper's `q.xyz` and seed. Rows 0–3 retain actual production geometry, matter and state checks. This is a sound separation from image acceptance and from a CPU-only mother test.

Initial reviewed files:

- `candidate/qa/heritage-state-emit.mjs`: SHA-256 `80efd2f95ca82543db87f6c3e1d9e474100719686d3652af0c20367d3e2c1289`.
- `candidate/qa/heritage-state-probe.mjs`: SHA-256 `7b3e3105d82a52647fb482d6ea8950883e61c3f947b6321b2f89d974c3db9a91`.

Two issues were reported to the implementation owner before running GPU QA:

1. **Finite row-4 values must be checked.** The original finiteness check covers rows 0–3. A NaN in `actual.q` would not fail `Math.abs(actual - expected) > tolerance`, because comparison with NaN is false. Require all four row-4 values to be finite.
2. **The 3 µm comparison tolerance is insufficient for the current independent double-precision expectation.** With the existing lantern fixture `p.y = 35.4`, stepwise float32 arithmetic gives `q.y = .03150308132171631`; the double expectation is approximately `.031500000000002`. Error: 3.081321714 µm. This already exceeds the 3 µm threshold without any implementation bug. All existing fixture seeds match. Use explicit stepwise float32 expectations with a justified residual tolerance, or retain the independent double expectation with an appropriately justified tolerance, such as 8 µm. Do not weaken the exact integer seed comparison.

Coverage present in the initial 20-fixture snapshot:

- Same physical brick across the old internal seed boundary.
- Same physical brick under world Z depth changes.
- A real staggered-cell boundary.
- An ID-12 sample.
- A role-175 lantern-local sample.
- A negative horizontal-coordinate hall sample.
- A non-heritage ID-1 control.

Useful additional coverage, reported as gaps rather than claims that the implementation fails:

- Negative rows, including odd/even negative parity.
- An ID-12 same-cell pair under X-depth changes.
- A role-175 pair showing identity follows its local tangent coordinate and is stable under local normal-depth changes.
- A non-heritage ID-12 control, to protect both old-axis branches.
- A varying `h.d` pair, showing only returned `q.z` changes while the seed remains fixed. The existing world-depth fixtures keep `baseD = .002` for all points, so they test seed independence from world Z but not this additional relation.

These are recommendations to the implementation owner; this audit did not change the QA files. The reviewed snapshots and findings above must not be presented as a completed B GPU pass.

## Follow-up QA review: 31 fixtures / 93 age cases

At the follow-up read-only review, the implementation owner had addressed the two concrete QA findings and expanded the coverage:

- Row-4 `q/seed` now requires finite values.
- Independent double-coordinate expectations now allow 8 µm, while integer seed equality remains exact.
- Added negative odd/even rows, a role-175 local-normal pair, an ID-12 world-normal pair and a non-heritage ID-12 control.
- Added exact comparisons against the nine unchanged non-brick fixtures at three ages from the recorded A run `38344011903`. These are finite control samples, not a whole-domain proof.

Updated reviewed file hashes:

- `candidate/qa/heritage-state-emit.mjs`: `de6a27b8b1f6a7ed9b1e15f13869967775157a77ec2d1a40801fb007d9de6ef7`.
- `candidate/qa/heritage-state-probe.mjs`: `c56705e5a32406b338aec1139d40a809698300e996894bac0805bd6ee97b84aa`.

An independent stepwise float32 arithmetic check of all 22 brick fixtures in this 31-fixture set found:

- All integer seeds match their independent expectations.
- Maximum local-coordinate difference from the double expectation remains 3.081321714 µm, below 8 µm.
- Negative-row examples produce rows -2 and -1 with seeds -8 and 5, respectively.
- The role-175 local-normal pair keeps seed 6311.
- The ID-12 world-normal pair keeps seed 3085.

The original blanket anti-stub rule required every fixture to have nonzero geometry displacement at some age. That rule is inappropriate for the new identity-focused points: a legitimate sample inside a flat brick face can have zero edge-geometry contribution. It is correct to retain the original 11 displacement-oriented fixtures as the anti-stub controls, while checking geometry/matter agreement, nonempty mother response, finite helper coordinates and the identity invariants for the new fixtures. Moving the identity points merely to force nonzero displacement would weaken the intended test.

The remaining optional coverage improvement is a pair with different `h.d`, explicitly checking that only helper `q.z` changes and seed stays fixed. The implementation's direct expression already has that relation; this was not treated as a blocker for the current finite-domain GPU probe.

This follow-up review is static inspection plus CPU float32 arithmetic only. It does not claim that the 93 GPU cases have executed or passed.

## Evidence integrity

SHA-256 of the A evidence read by this audit:

| File | SHA-256 |
|---|---|
| `evidence-lantern-small/towerWindow/readback.json` | `16e7263d3b4665266b6780b75630d7a30470a97ad5b9dd1ef3c11aca7dbfb630` |
| `evidence-lantern-small/towerWindow/receipt.json` | `8aea1d7d9fef676aab179c14249363668fad55b811607a908e1731d76bcb1a14` |
| `material-readback-small-analysis.json` | `93fab0d53df2e4dcaa45488352c9e6bc7289bf67337c49cf17ec3ded1a9a1911` |

## Acceptance boundary

The minimal causal next step is to verify the corrected production helper numerically and compare A/B using the same camera, resolution, shadow settings, lighting and presentation. Keep the original A output as the control. Do not mix palette, mortar, geometry-scale or shared receiver changes into that comparison. A correct identity repair does not by itself establish historical accuracy, photorealism, realtime performance or visual acceptance.
