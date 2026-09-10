# KAOPU Current Best View — R22 HRRRv4 effective-radius producer-liveness extension

Date: 2026-09-11
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

213. Stream observability and producer liveness are separate contracts. A state can be validly exposed through runtime I/O while the algorithm that normally refreshes it is inactive.
214. `ProducerExecutionEligibility` should be a vector, not a Boolean: at minimum preserve package activation, producer-request enablement, downstream-consumer compatibility where applicable, guarded-call eligibility, runtime auxiliary dependencies, and freshness evidence.
215. In locked HRRR v4.1.20, the effective-radius request flags start disabled and are enabled only under `use_mp_re=1` with compatible RRTMG LW and SW radiation plus a supported microphysics option that includes Thompson/ThompsonAero.
216. In locked Thompson, `calc_effectRad` is guarded by all three effective-radius request flags being nonzero. Therefore `mp_physics=28` by itself does not prove that `RE_CLOUD/RE_ICE/RE_SNOW` will be freshly computed.
217. The shipped locked `em_scm_xy` baseline uses `mp_physics=2`, `ra_lw_physics=1`, and `ra_sw_physics=1`. Merely changing its microphysics to 28 while leaving radiation at 1/1 can produce a false instrumentation test: the fields may be exposed, yet the effective-radius producer remains unrequested.
218. For the L1 source-path preflight, explicitly set `mp_physics=28`, `ra_lw_physics=4`, `ra_sw_physics=4`, and `use_mp_re=1`, in addition to the R21 manifest and fail-fast runtime-I/O policy. This is a physics-harness configuration only; it does not make SCM operationally equivalent to HRRR.
219. Value plausibility is not freshness evidence. Locked physics initialization seeds cloud-water, cloud-ice, and snow radiative effective radii with plausible nonzero starting values (2.51, 5.01, 10.01 micrometres respectively), so seeing nonzero or plausible `re_*` cannot prove `calc_effectRad` executed.
220. `CheckpointFreshnessContract` must distinguish `initialized`, `producer-refreshed`, `carried/restarted`, and `unknown` lineage. A checkpoint eligible for replay comparison must prove producer-refreshed lineage at the sampled time, not merely contain a value.
221. The effective-radius diagnostic is demand-coupled to the radiation configuration in this source generation. KAOPU must preserve such `ProducerDemandCoupling` rather than assuming an internal diagnostic is always evaluated whenever its state variable exists.
222. Thompson aerosol-aware initialization has a runtime auxiliary dependency on the CCN activation table. The locked source calls `table_ccnAct` when aerosol-aware and treats CCN table open/read failures as fatal; the operational HRRR forecast workflow stages `hrrr_run_CCN_ACTIVATE.BIN`. L1 must therefore capture auxiliary-table identity as part of the harness, not treat it as an incidental file.
223. Environment/tool availability is part of executable evidence. This bounded run found gfortran and netCDF-C, but no `mpif90`, `nf-config`, or `ncdump`; therefore a real locked-source L1 WRF pair was not executable here without adding MPI/netCDF-Fortran/tooling. This is an execution limitation, not evidence about HRRR physics.
224. R22 corrects the L1 gate before compute is spent. It adds no physical Observation Root, executes no WRF/HRRR model pair, leaves `ReplayStatus=source_callpath_authenticated`, and leaves Frozen unchanged.

R22 evidence status:
- Observation: no new physical atmospheric Observation Root.
- Candidate: `ProducerExecutionEligibility`, `ProducerDemandCoupling`, `CheckpointFreshnessContract`, corrected L1 source-path configuration.
- Current Best View: L1 must prove both stream exposure and producer liveness; neither substitutes for the other.
- Frozen: none.
- Rejected: “field exposed ⇒ freshly computed”; “mp_physics=28 alone ⇒ effective radius refreshed”; “plausible nonzero re_* ⇒ producer executed”; “SCM with mp28+RRTMG ⇒ operational HRRR equivalence”.
- Unknown: actual L1 execution/non-interference, exact produced re_* on real or SCM state, performance/I/O cost, L3 real-input pair, independent runtime checkpoint, visible-band liquid/ice optical closure.
- Executable source/semantic probe: `PROBES/hrrrv4_effective_radius_liveness_probe_r22.py`, result `14/14 PASS`.
