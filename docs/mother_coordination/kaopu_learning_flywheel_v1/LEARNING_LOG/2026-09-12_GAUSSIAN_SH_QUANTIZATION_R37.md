# KAOPU learning cycle R37 — arbitrary SH coefficient quantization through SPZ and Three r186

Date: 2026-09-12  
Status: **Candidate partial**  
Production Mother mutation: **none**  
Frozen R1 mutation: **none**

## Highest-value bounded question

R36 used exactly representable SH values. For ordinary off-grid SH1-SH3 coefficients, what errors does the pinned default Niantic quantizer actually deliver to Three.js r186, and which checks are required before an appearance claim?

Coordinator parent `0f335c660dab36d883a612327c3602d9ef8ee7e5` was current and R36 Mother feedback remained null with acknowledgements false.

## Source locks and evidence relation

- GraphDECO reference: `54c035f7834b564019656c3e3fcc3646292f727d`.
- Niantic SPZ: `affd0ecea7fbb4c265ee119475af7ee5b2997482`.
- Three.js r186: `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- Full lock: `references/gaussian-sh-quantization-r37/SOURCE_LOCK.json`.

GraphDECO provides the reference SH basis. SPZ and Three form the dependent delivery chain. The deterministic fixture and mirrored source equations are derived engineering evidence, not a physical Observation Root. No AI review was used.

## Executed fixture

The C++ harness generated 64 SH3 splats containing 2,880 deterministic non-grid coefficients in `[-0.95,0.95]`, converted RDF to RUB through the actual Niantic path, and encoded default SPZ v4. The actual asynchronous Three r186 loader decoded it. A second file used coefficients `-1.25` and `+1.25` as saturation controls.

The CPU evaluator compared source GraphDECO SH contributions against delivered Three SH contributions for 2,054 directions per splat: 394,368 direction/channel samples.

## Observation

### O-R37-1 — the naive half-step error bound is too small

Niantic's fixed source first rounds a coefficient to the 8-bit grid and then rounds that integer to the configured bit bucket. The first rounding contributes up to another `1/256` coefficient unit beyond the usual bucket half-step.

Measured maximum coefficient errors were:

- SH1: `0.034995973`, exceeding naive `0.03125` but below two-stage bound `0.03515625`;
- SH2: `0.066377997`, exceeding naive `0.0625` but below `0.06640625`;
- SH3: `0.066363990`, exceeding naive `0.0625` but below `0.06640625`.

This is a reproducible counterexample to the earlier informal half-step assumption. It does not change the official codec; it corrects KAOPU's candidate error accounting.

### O-R37-2 — directional contribution error is measurable and non-zero

Across the deterministic fixture:

- maximum linear SH-contribution channel error: `0.1317093809539963`;
- RMSE across 394,368 direction/channel samples: `0.03701786798332178`.

These are coefficient-function errors before rasterization, compositing, tone mapping and display. They are not final pixel errors, not a universal distribution, and not a visual acceptance threshold.

### O-R37-3 — actual out-of-domain saturation is destructive

After RDF-to-RUB sign conversion, source coefficients `+1.25` and `-1.25` decoded as `0.9921875` and `-1`. Maximum coefficient loss was `0.2578125`. The candidate gate rejected both the declared-domain violation and the coefficient budget failure.

## Candidate

`ADAPTERS/gaussian_sh_quantization_gate_r37.mjs` requires:

- finite, correctly sized coefficients in a declared degree/frame/layout;
- an explicit `[-1,1]` source-domain check for this codec profile;
- comparison against the actual decoded derivative;
- separately declared coefficient and measured-directional budgets;
- failure when either budget is missing or exceeded.

The probe's directional budget `0.25` exists only to exercise pass/fail behavior. It is not a KAOPU production or perceptual threshold.

## Current Best View

R36's direction convention remains compatible, but zero error only applied to grid-aligned coefficients. Default SPZ SH quantization must be budgeted with the actual two-stage bounds, not a naive half-step. A real pilot must measure the learned coefficient distribution and fixed-camera function/image errors; generic codec bounds cannot substitute for acceptance.

R34 envelope/range validation, R35 DC compatibility and R36 direction convention remain separate. No one pass overwrites another failure.

## Rejected

- **Rejected:** “Default SH coefficient error is always at most half the reduced-bit bucket step.” The actual two-stage encoder exceeded that value in all three bands.
- **Rejected:** “R36 zero error proves arbitrary SH values are lossless.” R36 deliberately used grid-aligned values.
- **Rejected:** “Coefficients outside `[-1,1]` can be silently accepted.” The actual saturation control lost up to `0.2578125`.
- **Rejected:** “A coefficient-function RMSE is a final visual-quality score.” Rasterization, alpha sorting, DC handling, display and human acceptance were not included.

## Frozen

- Formal R1 remains frozen and unchanged.
- No production Mother branch or asset changed.
- RealityScan remains available; no new Mother was created.
- SPZ remains a lossy derivative; SH is not physical relighting or complete Object DNA.

## Unknown

- No user photo set, COLMAP pose solve, Brush training or cleanup was available.
- Actual learned SH/DC distributions and their perceptual importance are unknown.
- No GPU render, independent fixed-view image comparison, macOS/iPhone/Safari result or human acceptance exists.
- No Mother has integrated or acknowledged the candidate gate.

## Result and routing

- Probe: `PROBES/gaussian_sh_quantization_result_r37.json` — 5/5 checks passed after preserving the naive-bound counterexample.
- Tool routing: `TOOL_ROUTING_R37_GAUSSIAN_SH_QUANTIZATION.json`.
- Mother routing: `MOTHER_ROUTING_R37_GAUSSIAN_SH_QUANTIZATION.json` — prepared, feedback null and acknowledgements false.
