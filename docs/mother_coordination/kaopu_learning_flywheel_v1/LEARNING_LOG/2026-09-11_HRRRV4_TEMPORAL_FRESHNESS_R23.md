# KAOPU bounded learning cycle R23 — HRRRv4 effective-radius temporal freshness

Date: 2026-09-11
Learning question: `LQ-ATMOSPHERE-001`
Status: Candidate; bounded engineering/source cycle. No production Mother mutation. No physical Observation Root added.

## Why this was the highest-value unresolved question

R22 proved that stream exposure is not producer liveness, but the next planned L1 ControlInstrumentedPair still had one unresolved provenance gap: even with the producer path enabled, which history frame is actually eligible to be called `producer-refreshed`? A false temporal checkpoint would invalidate the numerical replay comparison before any expensive WRF/HRRR execution began.

## Logical errors rejected before implementation

1. **`RE_*` present in the initial wrfout => producer ran.** False. Locked `module_physics_init.F` runs before integrate and seeds plausible radiative effective radii. Locked integration code writes history in `med_before_solve_io` before advancing the domain.
2. **Value changed from initialization => producer ran.** False. A restart-carried value may differ from initialization while no producer event has occurred in the new execution segment.
3. **Value equals initialization => producer did not run.** False. Locked initialization uses 2.51 micrometres for cloud water and 5.01 micrometres for cloud ice, and locked `calc_effectRad` uses the same lower clamps. A legitimate producer result can alias the initial values exactly.
4. **Effective radii refresh only when radiation itself is evaluated/output.** False for the locked source path. `solve_em` advances one model timestep and executes microphysics as time-split physics after RK; THOMPSONAERO calls `mp_gt_driver`, whose guarded effective-radius calculation runs inside the microphysics call when the R22 request flags are live.
5. **A restart-start history frame is fresh because its valid time is current.** False. Locked WRF/HRRR supports `write_hist_at_0h_rst`, which can emit carried restart state before the first resumed solve. Valid time and producer epoch are different identities.

## Primary evidence

All HRRR source evidence is locked to NOAA-EMC/HRRR commit `40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827`.

- `phys/module_physics_init.F` blob `2a6dac7d3c0c2b9c87ff3a2dfdbcf9e635aa6e6d`: initialization occurs after input and before integrate; seeds 2.51/5.01/10.01 micrometre radiative effective radii.
- `dyn_em/solve_em.F` blob `fc487de3a628cb4b8ecdad62f233d8e829614343`: one `solve_em` call advances a grid a single timestep; time-split physics after RK currently includes microphysics; calls `microphysics_driver`.
- `phys/module_microphysics_driver.F` blob `f5ed7aec6aa5b2187936ed447ed7dc2faede3095`: THOMPSONAERO branch calls `mp_gt_driver` when required arguments are present.
- `phys/module_mp_thompson.F` blob `1e6cdb1e718473ee1a031e16b1c00c96113f19f8`: guarded `calc_effectRad` writes `re_cloud/re_ice/re_snow`; cloud and ice lower clamps are 2.51 and 5.01 micrometres.
- `frame/module_integrate.F` blob `bca4f65007041da969a56f710f983972a5605f8a`: documents `med_before_solve_io` as the history/restart output point before `solve_interface` advances the domain.
- `share/mediation_integrate.F` blob `1b98d2894dffeb1ac2477ba238df32e9f3520957`: implements history output before solve and explicit restart-start history behavior controlled by `write_hist_at_0h_rst`.
- Current official UCAR/NCAR WRF running documentation corroborates that ordinary history output includes the simulation initial time and documents `write_hist_at_0h_rst`. It is corroboration only, not a substitute for the locked HRRR source identity.

No Chinese websites and no external-AI output were used as evidence.

## Transferable method

### ProducerRefreshEpoch

A diagnostic checkpoint should preserve at least:

- execution segment identity (`cold-start`, `restart`, or other explicit segment kind),
- model valid time,
- completed step index since segment start,
- last producer-event step/time,
- producer implementation/source identity,
- producer source-path eligibility,
- checkpoint write epoch.

### CheckpointTemporalEligibility

For replay authentication, a checkpoint must be post-producer in the same execution segment. Cold-start initial history and restart-start history are not `producer-refreshed` in that segment. A carried/restarted frame may still be useful for restart-continuity testing, but it has a different evidence class.

### ValueAliasFreshnessFailure

Never infer execution freshness from numerical novelty. Initial/default values may equal valid clamped producer results, while carried values may look novel without any current producer event. Execution lineage must be explicit.

## Executable evidence

`PROBES/hrrrv4_effective_radius_temporal_freshness_probe_r23.py`

SHA256: `9cd1dc5f20ccf663475350480efe78bdc235d2cdc5b99c0cbc893455f4b701ed`

Result: `12/12 PASS`.

The probe demonstrates that event-based temporal eligibility accepts a legitimate producer result even when cloud/ice values alias initialization, while a value-change heuristic both rejects valid refreshed values and accepts stale restart-carried values. This is source-semantic evidence only; it is not a WRF/HRRR model run.

## Status ledger

### Observation

No new physical atmospheric Observation Root. NOAA source files and WRF documentation remain engineering/source evidence; their shared lineage is preserved rather than counted as independent physical corroboration.

### Candidate

- `ProducerRefreshEpoch`
- `CheckpointTemporalEligibility`
- execution-segment freshness lineage
- initial-time and restart-start checkpoint exclusions for producer-refreshed replay comparison
- value-alias freshness failure mode

### Current Best View

For locked HRRRv4 Thompson effective-radius checkpoints, freshness requires both R22 producer liveness and R23 temporal producer lineage. Once the producer path is live, the source-semantic refresh cadence follows the microphysics timestep path, not the radiation alarm/output cadence. The sampled checkpoint must be after at least one completed eligible microphysics step in the current execution segment.

### Frozen

None.

### Rejected

- initial wrfout presence implies fresh diagnostic
- value difference from initialization proves producer execution
- equality with initialization disproves producer execution
- effective radius refresh is tied only to radiation-output cadence
- restart-start history is producer-refreshed in the new segment

### Unknown

- actual locked-source L1 execution trace and easiest non-invasive producer-event evidence
- bitwise non-interference and runtime/I/O cost of the instrumented L1 pair
- exact real L3 HRRRv4 producer checkpoint and external replay numerical gap
- visible-band liquid/ice optical closure and dual-evaluator validation

## Routing

Weather receives temporal checkpoint lineage and the ban on t0/restart-t0 frames as fresh replay checkpoints. Atmosphere accepts `re_*` only after both producer-liveness and temporal-eligibility gates pass. KAOPU semantic core receives `ProducerRefreshEpoch` and `CheckpointTemporalEligibility`. Lighting receives no physical promotion.

## Next gate

When the locked WRF execution dependencies are available, run the R22-corrected L1 SCM ControlInstrumentedPair using 28/4/4/1 and the R21 runtime-I/O manifest. Do not use the initial-time frame. Require zero runtime-I/O resolution warnings, source-path liveness, and a post-producer history sample after at least one completed microphysics step. Then apply the R20 TwoLayerInstrumentationComparator and measure runtime/I/O cost separately. L1 still cannot advance `ReplayStatus`; promotion remains reserved for an eligible L3 locked HRRRv4 real-input pair plus an independent source-model checkpoint matching the external source-locked Thompson replay.
