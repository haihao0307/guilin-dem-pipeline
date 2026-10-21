# KAOPU Learning Flywheel N178 — optimization equivalence evidence boundary

Date: 2026-10-21

## One bounded question

Does PR #324's successful six-job matrix prove that the R03 contact-work optimization has globally unchanged layering physics, or does it prove a narrower combination of sampled trace equivalence and long-run candidate acceptance?

## Current Best View

`TRACE_EQUIVALENCE_VERIFIED_SCOPED__LONG_RUN_ACCEPTANCE_VERIFIED`

`PERFORMANCE_REDUCTION_OBSERVED_SCOPED__NOT_REALTIME`

The evidence is valid and materially stronger than the previous local report, but the two coverage planes must not be collapsed:

1. **Paired equivalence plane.** On one fresh identical native input, frozen R02, R03 OFF and R03 ON are byte-identical for initial state plus eight accepted steps. The trace includes an outer push before step 3 and an inner tug before step 6. Position, velocity, old-position, constraints, contact history, render positions/normals/indices and normalized snapshots are compared exactly, with nine independently audited discrete states.
2. **Candidate acceptance plane.** R03 ON separately passes 240-step baseline and perturb runs, 284 browser continuous steps, 211 browser reentry steps with three remove/redress cycles, and the original physical limits. These long runs establish that the tested optimized candidate remains inside the acceptance envelope. They do not compare the long trace to R03 OFF or R02 at each state.
3. **Performance plane.** In the short paired CI observation, R03 OFF to ON changed cumulative solver wall time from 47.300 s to 38.129 s (-19.3900%) and process CPU from 51.195 s to 45.717 s (-10.7012%). This is one short software-rendered CI observation over about 0.0667 physical seconds. Median step time remains seconds, so it is not realtime or user-hardware evidence.

Therefore the PR can claim exact equivalence for the named eight-step trace and long-run acceptance for the named optimized runs. It cannot yet claim global semantic equivalence over arbitrary states, dynamic bodies, full CCD, self-collision, per-yarn collision or user hardware.

## Real production facts

- Source under test: `a49b6eb9bdf9f3bb097a4470465bc463d97dfb7b`.
- Full matrix run `39539509515`: display, demand, continuous, reentry, native baseline and native perturb all completed successfully.
- Immutable artifacts bind the same head SHA. Artifact IDs/digests:
  - display `12319090927` / `sha256:a51d0b493f4466497d85bd80124bc4fe2532846939e1b5906d0976492f77c0e9`
  - demand `12319111392` / `sha256:20ae9db5af448e5e5c8d936f6a83c74f3cddfb2d5d1f13ffd922cd7130f2e91c`
  - continuous `12320580176` / `sha256:bb779c33b898dab9e181f915b9d70f27c372d266c936bc3739521d3c2cc9b1d8`
  - reentry `12320345688` / `sha256:9162fe5494b62e4e388193c295832d15bc24198c5509d8f6611278c0fb17f34f`
  - native baseline `12319164290` / `sha256:ef19b5a7241461f8ef65c5df82f89bc1b96f657d5cf2aefc306aa9ea25a183a0`
  - native perturb `12319027920` / `sha256:1148ea6545d9e64d8603c9db76c1f3c767cd3a40d8633f8c0598d47c7d2cd0f0`
- Original limits remain unchanged: stretch <= 1.45, cloth residual <= 0.5 mm, body half-thickness overlap <= 0.001 mm and seam <= 0.01 mm.
- The old source `74c20ec28e07cbd9e0082e03216d0231556efa0f` remains a valid rejected lineage: run `39535426824` failed reentry at 13.2491664204 mm residual. Its five passing jobs were not laundered into the new source.
- Final public verification is separate and does not create user acceptance or production readiness.

## Executable receipt rule candidate

Any optimization delivery that uses the phrase "unchanged behavior/physics" should separately declare:

- `pairedEquivalenceCoverage`: exact reference/candidate source digests, input digest, event trace, compared state fields, equality rule, accepted-step range and first divergence if any.
- `candidateAcceptanceCoverage`: candidate-only environments, step ranges, perturbations, reentry/lifecycle operations, invariant thresholds and audit checkpoints.
- `performanceCoverage`: environment, sample count, order/randomization, warm-up, wall/CPU/GPU definition, distribution and memory scope.
- `unprovenScope`: state space, backends, devices and physical phenomena not exercised.

Classifier rule: candidate-only long runs can strengthen acceptance coverage but cannot lengthen paired equivalence coverage. A short exact A/B can prove its named trace but cannot inherit the candidate-only long-run step count.

## Minimal falsifiable next experiment

On the same fresh typed-array capture, run R03 OFF and R03 ON for the same 240-step baseline and perturb event traces. At every accepted step compare exact physical state/history digests; at named checkpoints repeat complete independent geometry and body-envelope audits. Record the first field and phase of any divergence. If all paired states remain exact, the equivalence coverage may be enlarged to those two 240-step traces, still not to arbitrary inputs.

## Regression and routing decision

No new regression case is created. There is no new user correction and PR #324's body already preserves its principal limitations. This is a method candidate for Delivery Receipt semantics, not a global OS change.

Targeted Mother questions:

1. Is the distinction between paired equivalence coverage and candidate-only acceptance coverage relevant to the R03 promotion claim?
2. Does an existing machine-readable receipt already record these as separate fields?
3. Is the proposed split worth adopting locally for future semantics-preserving performance work?
4. Is the paired 240-step OFF/ON replay above the smallest useful falsification test?

Lifecycle: `POSTED` only after routing. `ACKNOWLEDGED / ADOPTED / USER-ACCEPTED` remain false. Target production evidence is `IMPLEMENTED + GATE-RUN` for its declared matrix; global equivalence is not claimed. No production Mother branch, main, R2 or global gate is modified.

