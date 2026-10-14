# N154 — LaFAN1 as a scoped transition-benchmark teacher candidate

## Bounded question

Can Ubisoft LaFAN1 add a reproducible transition-naturalness baseline to Motion R03's unresolved smoothness claim without importing restricted teacher assets or pretending that one sparse browser timing sample proves smoothness?

Decision: `TEACHER_CANDIDATE`, limited to benchmark method. Lifecycle is `RADAR_FOUND -> TEACHER_CANDIDATE`. Motion R03 remains `HOLD_TRANSITION_BENCHMARK_AND_CONTACT_BASELINE_UNBOUND`.

## Existing real production failure

- Motion R03 exact reviewed subject remains `fde66f8246cc49f604e5deb24fcc4128d8c9772b` in draft PR #268.
- Its receipt explicitly retains `smoothnessAcceptancePassed=false` and `productionReady=false`.
- The preserved short software-playback sample has only one approximately 2344.6 ms inter-frame interval and no usable FPS. It cannot measure a motion transition against reference truth.
- The current verifier checks pose/contact facts but does not hide a known middle window, reconstruct it, and compare it to held-out motion.

## External method and evidence

Primary sources only:

- Ubisoft La Forge repository at pinned commit `94084601bacdf9cc3764b5c73daaeccae6035fac`: https://github.com/ubisoft/ubisoft-laforge-animation-dataset
- Ubisoft La Forge research page for *Robust Motion In-betweening*: https://www.ubisoft.com/en-us/studio/laforge/news/4s7xqXUwN8C3R2iT5yJXhU/robust-motion-inbetweening

The repository provides a concrete benchmark rather than a generic smoothness slogan:

- subject 5 is held out for testing; 65-frame windows are sampled with offset 40;
- 10 past and 10 future context frames surround transition windows of 5, 15, 30 and 45 frames;
- Zero-Velocity and interpolation are explicit baselines;
- global quaternion L2, normalized global-position L2 and NPSS are computed against held-out ground truth;
- `evaluate_test.py` locks expected result intervals, making the benchmark itself regression-testable.

The accompanying method also treats foot contact as an explicit channel/loss. That is important because a spectral or joint-position score alone can accept contact-breaking foot slide.

## Teacher screening

| Criterion | Finding |
|---|---|
| Source/provenance | Official Ubisoft La Forge repository and project page; commit pinned. |
| Maintenance | Low: repository metadata shows an old last push; pinned latest visible code commit is from 2021. |
| Runnable evidence | Dataset extraction, evaluation code and regression tests exist; trained model/training pipeline does not. |
| License/rights | Repository states CC BY-NC-ND 4.0. Data, copied code or derivative assets are forbidden from KAOPU production lineage. |
| Direct relevance | High for R03's explicit unresolved smoothness claim. |
| Novelty over Current Best View | Exact held-out transition windows, two weak baselines, three metrics and locked expected ranges are not present in R03 QA. |
| Dependencies/cost | Old Python 3.7/numpy 1.17.4 stack; Git LFS; 30 Hz, skeleton, unit and retargeting assumptions. |
| Failure boundary | Open issues report LFS quota, unit/rest-pose/retargeting ambiguity, 30 Hz limitation and a possible benchmark joint-shape mismatch. No model weights/training reproduction. |

What it knows more about than KAOPU Current Best View: how to turn “transition looks smooth” into a falsifiable, fixed-window comparison against held-out motion with weak baselines and metric regression tests. It does **not** establish a universal realism score, production asset rights, or a trainable Motion model.

## Comparison with current KAOPU controls

R2 already requires exact subject identity, scoped claims, verifier separation and evidence-layer truth. N154 does not replace those controls. The new candidate object is only the missing temporal comparator: bind one legally owned exact clip and skeleton/rate, mask a transition window, reconstruct it, compare it to the preserved middle frames, retain contact, and require positive controls.

No similarly named transition/smoothness benchmark case exists on the inherited learning branch. N153 covers object custody continuity, not motion-transition naturalness.

## Falsifiable hypothesis and minimal audition

Hypothesis: on one KAOPU-owned exact motion sequence, an independently implemented held-out-window benchmark will rank a reasonable interpolation/reconstruction above Zero-Velocity and will reject an injected frame jump and injected stance-foot slide. It is falsified if the controls are not detected or if the ordering changes only because skeleton, sample rate or normalization identity changed.

Audition proposed to Motion Mother, not executed by the learning branch:

1. Select one KAOPU-owned exact sequence and pin source digest, skeleton, units and FPS.
2. Hide 5/15/30-frame middle windows while retaining past context and the target frame.
3. Compare Zero-Velocity, interpolation and the current Motion path against held-out truth with independently implemented L2 rotation, L2 global position and NPSS.
4. Preserve a separate foot-contact/foot-slip channel.
5. Inject a frame jump and stance-foot slide; both must fail.

No LaFAN bytes, copied code, expected numeric ranges or universal thresholds enter the audition. The Mother must define task-local ordering and rights evidence.

## Candidate executable object and replay

`CANDIDATE-MOTION-HELD-OUT-TRANSITION-BENCHMARK-001` defines eight fixtures: sparse screenshot/rAF evidence; missing ground truth; prohibited teacher-asset import; NPSS without contact; wrong skeleton/rate; missed frame-jump control; detected foot-slide violation; and a complete KAOPU-owned scoped receipt.

Classifier result: `8/8`. See `PROBES/motion_held_out_transition_benchmark_result_n154.json`.

## Scope and lifecycle

- Method teacher only; no dataset/code import and no production implementation.
- Applies to Motion transition tasks with a legally usable exact reference sequence; not all animation, locomotion or physical interaction.
- Does not change PR #268, its branch, visuals, thresholds or parent lineage.
- Does not certify contact force, global performance, artistic naturalness or user acceptance.
- Lifecycle before routing: `POSTED=false`; `CLASSIFICATION-GATE-RUN=true (8/8)`; `ACKNOWLEDGED / AUDITION / PROBATION / ACTIVE_TEACHER / IMPLEMENTED / MOTION-PRODUCTION-GATE-RUN / ADOPTED / USER-ACCEPTED=false`.
- Effect KPIs remain `unknown`; no production audition has run.
