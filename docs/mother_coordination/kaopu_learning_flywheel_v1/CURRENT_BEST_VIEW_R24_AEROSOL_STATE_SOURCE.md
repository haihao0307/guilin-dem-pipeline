# KAOPU Current Best View — R24 HRRRv4 aerosol state-source extension

Date: 2026-09-11
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

237. Algorithm-path identity and state-source identity are separate. Two runs can execute the same locked ThompsonAero implementation while receiving different aerosol initial/boundary state and therefore cannot be treated as the same physical experiment.
238. In locked HRRRv4 Thompson, `is_aerosol_aware` is enabled by presence of `nwfa2d`, `nwfa`, and `nifa`; it is not defined by whether those values came from operational aerosol IC/BC, a climatology, or the source-internal fallback profile.
239. Locked `thompson_init` explicitly checks the existing NWFA and NIFA fields. When their maxima are below the scheme epsilon, it constructs basic terrain-following vertical aerosol profiles from internal constants. Therefore absence of externally supplied aerosol IC/BC does not, by itself, prevent the ThompsonAero algorithm path from becoming live.
240. The shipped `em_scm_xy` input contract contains meteorological sounding/soil/forcing inputs but no operational aerosol IC/BC product. For a bounded L1 instrumentation harness, source-internal aerosol fallback is therefore a legitimate low-assumption execution route if the actual run confirms initialization and producer liveness.
241. Operational HRRR CONUS is a different state-source identity: the locked namelist uses `use_aero_icbc=.true.` and `use_rap_aero_icbc=.true.`. A fallback-profile SCM must never be represented as aerosol-state equivalent to operational HRRR even when both select `mp_physics=28` and the same Thompson source.
242. `AerosolStateSourceIdentity` should bind at least source class (`external-operational`, `external-climatology`, `source-internal-fallback`, `carried/restart`, `unknown`), source artifact/version when applicable, initialization epoch, boundary-update policy, and any source-level constants used for fallback generation.
243. `AlgorithmPathEquivalence` and `StateSourceEquivalence` are independent axes in `HarnessEquivalenceVector`. Matching the first does not promote the second.
244. For L1, a fallback-aerosol SCM may be used to validate runtime-I/O resolution, producer liveness, temporal freshness, non-interference, and tooling plumbing. Its Evidence Ceiling is `algorithm-path-only`; it cannot authenticate operational HRRR state or numerical replay.
245. The R22 source-path contract remains required: `mp_physics=28`, `ra_lw_physics=4`, `ra_sw_physics=4`, `use_mp_re=1`. R21 fail-fast runtime-I/O and R23 post-producer sampling remain separate gates.
246. The CCN activation lookup table remains an auxiliary runtime dependency even when aerosol state is produced by the source-internal fallback profile. State-source simplification does not imply dependency elimination.
247. A later L3 locked HRRRv4 real-input pair must use the operational aerosol state-source identity. Numerical agreement obtained only from the fallback SCM cannot be promoted into `runtime_authenticated`.
248. R24 adds no physical Observation Root, performs no WRF/HRRR numerical model execution, leaves `ReplayStatus=source_callpath_authenticated`, and leaves Frozen unchanged.

R24 evidence status:
- Observation: no new physical atmospheric Observation Root. NOAA-EMC source/configuration and UCAR/NCAR documentation remain engineering/model evidence roots and are not counted as independent physical observations.
- Candidate: `AerosolStateSourceIdentity`, separate `AlgorithmPathEquivalence`/`StateSourceEquivalence`, and a fallback-aerosol L1 harness with an explicit Evidence Ceiling.
- Current Best View: use the lowest-dependency state source that is sufficient for the validation question, but preserve its identity and never silently promote algorithm-path agreement into operational-state equivalence.
- Frozen: none.
- Rejected: “no external aerosol IC/BC means ThompsonAero cannot run”; “same Thompson code path means same aerosol state”; “fallback profile is operationally representative”; “an L1 fallback numerical match authenticates HRRR runtime”.
- Unknown: whether the locked SCM actually executes successfully under the corrected 28/4/4/1 configuration in the target build; exact initialized fallback fields produced in that run; L1 bitwise non-interference and I/O cost; state-source-aligned L3 HRRRv4 execution and external replay numerical gap.
- Executable source/semantic probe: `PROBES/hrrrv4_aerosol_state_source_probe_r24.py`, result `12/12 PASS`, SHA256 `b9217fcbe7521fdc6dca2e02f150719f97e3941edd6717ac241ab45ceba94f84`.
