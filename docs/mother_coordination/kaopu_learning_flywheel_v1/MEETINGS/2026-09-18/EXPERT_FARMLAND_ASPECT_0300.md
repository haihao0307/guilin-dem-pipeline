# Expert finite review — Farmland aspect certificate / 2026-09-18

ID: KAOPU-EXPERT-FARMLAND-ASPECT-20260918  
Status: completed finite knowledge review; conditional mathematics, NOT production acceptance.

## Actual scope, time and participation

- LA actual clock checked with America/Los_Angeles: preflight began 2026-09-18T02:57:59-07:00; 03:00:05 checked before consultation. Expert session bounded by actual clock readings **03:02:37–03:05:25 PDT (2m48s)**. Preparation was separate, no expert consultation before 03:00. Completed early because finite conclusions and missing premises were explicit.
- Two real independent agent calls: /root/aspect_certificate_a and /root/aspect_certificate_b, each explicitly selected **gpt-6-astra**, fresh context (fork none). Both delivered first answers without the other's answer, followed by exactly one targeted critique round each.
- Identity evidence is the successful tool selection and returned agent replies, not independent backend attestation. Role labels do not certify domain expertise. Agents received the same facts and host-supplied synthetic controls; their agreement is not independent empirical evidence.
- Mother participants: 0. No Mother contacted, no new production task, deployment, asset generation, freeze/automation/local-plan change. No local G: access or claim of photo access.
- Original SL003 and prior water-revision review are already complete; neither reopened.

## Input, version and real new gap

Read latest coordination branch at d9cdb69d01f93c33976488e5704dc825967f73bf, latest Mother note, previous expert water-revision note, N19/N20 view, N20 log/probe/source lock, and original R29/R30 kernels. Current Farmland PR65 head was freshly checked as **b542dccc1a44880dbb8a6ba8313bcfa0e6da3726**, matching N20's pinned source.

The Mother note left a trigger for real new counterexamples. N20 supplies one: the published R045.30 10×6 m lattice has 497 eligible points and a maximum of 32.3842740874°, while a 5×4 m lattice reports 35.6414085863° at (-60,36), above the unchanged strict <35° gate. Old/new finite-gradient norms there are approximately .0145551/.0193491.

This is an existing source-derived CPU report, reread in this round, **not a newly rerun production probe** or independent terrain observation. It preserves the truth of the original fixed-point calculation but refutes extending that sample result to every eligible location. A formally certified violation would additionally bound arithmetic uncertainty.

Source observable is central differences with half-step e=1 m:
D_e h = ((h(x+e,z)-h(x-e,z))/(2e), (h(x,z+e)-h(x,z-e))/(2e)).
The N20 candidate predicate excludes |aspectDelta|<.01 m, drainage distance<18 m, and either finite-gradient norm<.01.

**Single question:** What may this gate honestly certify, and what additional premises allow a covered-region claim without hiding excluded regions or weakening thresholds?

## Independent first answers and one critique

A proposed a vector-uncertainty-ball/arcsine sufficient condition, operator-nullspace counterexample, and a separate uniform stencil-error premise for continuous derivatives. B independently proposed the same geometric bound, explicit mask coverage and three-way results.

The targeted critique corrected two precision issues:
1. B's initial wording “defeats the original sampled rule” was too broad: the original 497-point result remains valid; an enlarged sample set fails and the all-eligible-field extrapolation fails.
2. B's initial formula omitted numerical angle-evaluation error; both reviewers accepted adding it in upper/lower bounds.
Both confirmed: the continuous transfer error must be uniform over entire cells and stencil neighborhoods, and a conservative upper bound exceeding the threshold is unresolved, not proof of failure. No unresolved mathematical disagreement remains about these conditional statements; actual certified source constants remain unavailable.

## New, checkable conditional conclusions

### 1. Do not interchange the measured objects

Four different claims must be kept separate:

- maximum over explicitly listed retained samples;
- bound over a region for the fixed-e finite-difference field;
- bound for the true derivative of the continuous height function;
- bound for actual mesh face geometry or shading normals.

Densifying sample positions addresses the first gap only. Fixed-e differences can have a nullspace even at every point.

Horizontal aspect rotation is not 3D normal rotation. For height y=h(x,z), upward normal is proportional to (-h_x,1,-h_z); slope magnitude matters too. Near-flat aspect changes can correspond to small normal changes. Neither the old gate nor this review is a perceptual quality judgment.

### 2. Two synthetic controls, not claims about R30 frequencies

Coordinates and heights below are in metres. Assume a domain outside the excluded drainage band.

**Height-mask control:** h0=.011x; delta=.009 sin(pi z/2); e=1.
Every point has |delta|<.01 and is excluded by the amplitude predicate. Nevertheless at z=0, finite-gradient vectors are (.011,0) and (.011,.009), with norms .011 and .01421267040355, both above the existing slope cutoff; their angle is **39.2894068625°**.

A small height difference does not bound derivative difference. This does not invalidate an explicitly amplitude-conditioned gate; it invalidates claiming its excluded domain also passed.

**Stencil-nullspace control:** h0=.014x; delta=.02 sin(pi z); e=1.
The perturbation's central difference is identically zero for every z, not just a sparse lattice. At z=.25, delta=.01414213562373, above the amplitude cutoff, and the analytic derivative increment is .04442882938158. The continuous-gradient angle is **72.5098022003°**, while the mathematical finite-difference angle is zero. Host JavaScript arithmetic returned a finite-difference residual of 1.7347e-18, consistent with floating evaluation rather than a nonzero analytic result.

These are host-derived analytic examples with ordinary CPU numeric spot checks during this round. They were supplied to both reviewers and checked in their reasoning. They are not formal floating-point enclosures, GPU tests, physical measurements, or evidence that the real R30 contains these modes. Multiple stencil steps can reveal some failures but are not a general proof without additional regularity/band-limit premises.

### 3. A sufficient covered-cell certificate (not implemented)

Fix the source, coordinate units, stencil, declared target domain and exact eligibility predicates. For a cell C with representative c and coverage radius rho (metres), let computed vectors be v_j, j=29,30. Require certified bounds:

||D_e h_j(c)-v_j|| <= eta_j  
||D_e h_j(q)-D_e h_j(c)|| <= L_j rho for every q in C.

Let delta_j=eta_j+L_j rho, b_j=||v_j||. Slopes, eta and delta are dimensionless; L is inverse metres. If delta_j<b_j, the vector ball excludes zero and directional uncertainty is at most asin(delta_j/b_j). If theta_hat is the computed unsigned shortest angle and epsilon_theta bounds its numerical error, a sufficient pass is:

theta_hat + epsilon_theta + asin(delta_29/b_29) + asin(delta_30/b_30) < 35 degrees,

with all angles consistently converted. This follows from the tangent to a vector ball and the triangle inequality on direction angles. It also gives a nonzero slope lower bound b_j-delta_j, without choosing an arbitrary new production cutoff.

The Lipschitz/numerical constants must be independently justified, not estimated from the same finite samples and then called certified. The simple bound may be conservative; a failed sufficient inequality alone says **Unknown**, not actual violation.

For transfer to continuous gradients, a uniform additional stencil-error bound tau_j is needed. On proven smooth stencil neighborhoods, a sufficient formula is:
tau_j <= e²/6 * sqrt(M_xxx,j² + M_zzz,j²),
where the third-derivative bounds are uniform, in inverse square metres. Add tau_j to delta_j. R30 source contains clamp/min/abs and branch structures; their presence does not prove an actual kink at every branch, but it does prohibit simply assuming global C³. Across relevant nonsmooth branches, prove another bound, split with valid stencil support, or leave the continuous claim unresolved.

Mesh claims further need the actual tessellation, interpolation, displacement and normal semantics. No such mesh-wide verification was performed.

### 4. Coverage and outcome accounting

A sample failing a mask does not prove its whole cell is excluded. Each cell must be covered conservatively, proven entirely outside the stated eligible domain, or explicitly unresolved; include domain edges and full finite-difference support. Boundary refinement may help but cannot manufacture missing derivative guarantees.

Keep three outcomes:
- certified pass within named premises and scope;
- observed computational exceedance, with a rigorous violation label only when the relevant uncertainty bound supports it;
- unresolved / outside scope, never silently counted as pass.

Changing slope or height masks changes the question. Do not raise <35° or adopt .02/.05 slope floors merely to remove the existing witness. The appropriate production floor, coverage constants, continuous bound and visual implications remain Unknown.

## Evidence classes, limits and next trigger

- **Observation (source/report):** fixed source, exact e=1 operator and N20 eligibility code were read; N20 existing CPU counterexample report was read. Same-source reports are one evidence lineage.
- **Current Best View (conditional mathematics):** nullspace/mask counterexamples and conditional vector-ball theorem above, with explicit premises.
- **Candidate:** applying a certified cell audit to actual R045.30; no implementation authorized or performed here.
- **Rejected:** extrapolating 497 samples to all eligible terrain; assuming denser positions cure fixed-stencil nullspace; treating excluded areas or an inconclusive upper bound as pass.
- **Unknown:** actual source-derived regularity bounds, suitable purpose-specific cutoff, full continuous and mesh bounds, GPU/device/browser performance, physical truth and Mother adoption.
- **Frozen:** existing user/production constraints unchanged; no new format frozen.

Cost: retained-point reporting is cheapest but empirical. Certified adaptive cells require source analysis and can become costly near small gradients, eligibility boundaries and piecewise transitions; genuine violations cannot be subdivided into a pass. This review does not require certifying the entire world before useful production; it requires naming the limited claim honestly.

Relevant future consumer: Farmland Mother and existing flywheel; no direct delivery or adoption claimed. N20 already records one delivered PR65 warning, not acknowledged/adopted, and this round does not duplicate it.

Next genuine trigger: an existing workflow supplies (a) the intended downstream quantity and domain, (b) fixed versions/operator/masks, and (c) a justified cell or stencil uncertainty bound, or a real mesh-vs-field discrepancy. Then test this finite condition on that domain. Until then preserve N20's Candidate partial, existing terrace/parcel/water/visual locks, and the concrete over-limit witness; no new expert repeat merely to restate sampling limitations.

## Fixed sources and source boundaries

- [N20 current best view](https://github.com/haihao0307/guilin-dem-pipeline/blob/d9cdb69d01f93c33976488e5704dc825967f73bf/docs/mother_coordination/kaopu_learning_flywheel_v1/CURRENT_BEST_VIEW_N20_FARMLAND_ASPECT_SAMPLING.md)
- [N20 audit log](https://github.com/haihao0307/guilin-dem-pipeline/blob/d9cdb69d01f93c33976488e5704dc825967f73bf/docs/mother_coordination/kaopu_learning_flywheel_v1/LEARNING_LOG/2026-09-18_FARMLAND_ASPECT_SAMPLING_N20.md)
- [N20 probe](https://github.com/haihao0307/guilin-dem-pipeline/blob/d9cdb69d01f93c33976488e5704dc825967f73bf/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/probe_farmland_aspect_sampling_n20.mjs)
- [R29 kernel](https://github.com/haihao0307/guilin-dem-pipeline/blob/b542dccc1a44880dbb8a6ba8313bcfa0e6da3726/farmland-object-dna/research/r045-autonomous-rebuild/round-29/r045_round29_kernel.mjs)
- [R30 kernel](https://github.com/haihao0307/guilin-dem-pipeline/blob/b542dccc1a44880dbb8a6ba8313bcfa0e6da3726/farmland-object-dna/research/r045-autonomous-rebuild/round-30/r045_round30_kernel.mjs)
- [Mother prior status](https://github.com/haihao0307/guilin-dem-pipeline/blob/d9cdb69d01f93c33976488e5704dc825967f73bf/docs/mother_coordination/kaopu_learning_flywheel_v1/MEETINGS/2026-09-18/MOTHER_0230_PRODUCTION_EVIDENCE.md)
- [Previous completed expert water review](https://github.com/haihao0307/guilin-dem-pipeline/blob/dca8f749fd1d18766610e1956f0a75c1b4813a40/docs/mother_coordination/kaopu_learning_flywheel_v1/MEETINGS/2026-09-17/EXPERT_WATER_REVISION_0300.md)
- [SideFX HeightField Mask by Feature](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_maskbyfeature.html), read 2026-09-18: slope/facing-direction masks are separate controls. No evidence for the production 35° threshold or slope floor.
- [WGSL atan2, 2026-09-15 draft](https://www.w3.org/TR/2026/CRD-WGSL-20260915/#atan2-builtin), current official specification read 2026-09-18: quadrant-aware signed angle semantics. Not a terrain coverage or numeric-error certificate.

Archival scope: append this note only to the existing coordination branch after fresh head/tree reread (unchanged d9cdb69...). No production branch edit. Fixed-commit readback will be reported only after the actual operation succeeds.
