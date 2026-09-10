# KAOPU Current Best View — R23 HRRRv4 effective-radius temporal-freshness extension

Date: 2026-09-11
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

225. Checkpoint freshness is an event/epoch property, not a value-comparison property. A field can equal its initialization value after a legitimate producer execution, and a carried value can differ from initialization without being refreshed in the current execution segment.
226. Locked HRRRv4 physics initialization occurs after reading input and before `integrate`, and seeds radiative effective radii before any normal timestep integration. Therefore a cold-start history record at simulation time zero is not eligible as a `producer-refreshed` effective-radius checkpoint merely because `RE_CLOUD/RE_ICE/RE_SNOW` are present.
227. Locked integration ordering writes history/restart data in `med_before_solve_io` before `solve_interface` advances the domain. The model initial-time history record is therefore a pre-solve sampling epoch; on restart, `write_hist_at_0h_rst` can likewise emit carried restart state before the first resumed solve.
228. Locked `solve_em` advances a grid by one model timestep and identifies microphysics as time-split physics after the RK step. With THOMPSONAERO selected, the microphysics driver calls `mp_gt_driver`; with the R22 request flags live, Thompson executes `calc_effectRad` inside that microphysics call. The source-semantic expectation is therefore one effective-radius refresh per completed microphysics timestep, not one refresh only when a radiation alarm fires.
229. `ProducerRefreshEpoch` should bind at least execution-segment identity, model valid time, completed-step index, producer-event step/time, producer implementation identity, and source-path eligibility. A checkpoint used for replay authentication must match the producer epoch of the sampled model state.
230. `CheckpointTemporalEligibility` must distinguish cold-start pre-integration, restart-start carried state, producer-refreshed post-step state, and stale carried state. `validTime` alone is insufficient because two execution segments can expose the same valid time with different freshness lineage.
231. Value-difference heuristics are invalid freshness tests. Locked initialization uses 2.51 micrometres for cloud water and 5.01 micrometres for cloud ice, while locked `calc_effectRad` has the same 2.51 and 5.01 micrometre lower clamps. A correctly refreshed result can therefore be numerically identical to initialization.
232. Conversely, a restart-start value can look non-default and physically plausible while remaining carried/restarted rather than producer-refreshed in the current execution segment. Numerical novelty is not execution provenance.
233. For L1/L3 replay checkpoints, do not use the initial-time history frame. Select a history record only after at least one completed eligible microphysics step in the current execution segment, and preserve `segmentKind`, `stepsSinceSegmentStart`, and `lastProducerStep` (or equivalent trace evidence) in checkpoint provenance.
234. If a restart run deliberately writes history at restart time zero, classify that frame `carried/restarted`; it may be useful for restart continuity tests but is not a fresh producer checkpoint until a subsequent eligible timestep completes.
235. R20 non-interference comparison and R23 temporal freshness answer different questions. Bitwise equality of pre-existing control/instrumented fields does not prove that the newly exposed diagnostic is fresh; temporal producer lineage must pass separately.
236. R23 adds no physical Observation Root, performs no WRF/HRRR numerical execution, leaves `ReplayStatus=source_callpath_authenticated`, and leaves Frozen unchanged.

R23 evidence status:
- Observation: no new physical atmospheric Observation Root.
- Candidate: `ProducerRefreshEpoch`, `CheckpointTemporalEligibility`, execution-segment lineage, and initial/restart sampling exclusions.
- Current Best View: source-path liveness plus producer-event epoch, not value plausibility or value change, determines checkpoint freshness.
- Frozen: none.
- Rejected: “initial wrfout contains re_* ⇒ fresh”; “value changed from initialization ⇒ producer ran”; “value equal to initialization ⇒ producer did not run”; “effective radius updates only on radiation-output cadence”; “restart-start history ⇒ refreshed in current segment”.
- Unknown: actual L1 execution trace, exact runtime producer-event evidence available without physics-source modification, bitwise non-interference, I/O cost, L3 real-input pair and external replay numerical gap.
- Executable source/semantic probe: `PROBES/hrrrv4_effective_radius_temporal_freshness_probe_r23.py`, result `12/12 PASS`.
