# KAOPU Current Best View — R21 HRRRv4 runtime-I/O preflight extension

Date: 2026-09-11
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

201. Runtime-I/O syntax being documented is not sufficient evidence that a particular model state is instrumentable in a locked source generation. Field exposure must be source-locked against the Registry identity, active package, runtime parser and target stream.
202. `FieldExposureEligibility` should be a vector, not a Boolean: `declaredStateVariable`, `activePackageMember`, `runtimeParserResolvable`, `streamMaskMutable`, and `failFastConfigured` remain separately auditable.
203. In locked HRRR v4.1.20, `re_cloud`, `re_ice` and `re_snow` are declared real `ikj` state with Registry DNAMEs `RE_CLOUD`, `RE_ICE`, `RE_SNOW`, units metres and default restart-only I/O; the `thompsonaero` package selected by `mp_physics==28` includes all three.
204. The locked runtime-I/O parser lower-case normalizes both a requested token and the Registry `DataName` before comparison. Lower-case requests therefore resolve in this source generation, but canonical instrumentation provenance should still preserve both internal symbol and locked Registry DNAME rather than relying on cross-version case assumptions.
205. For a resolved `+` request, the locked parser sets the selected stream mask. Thus a restart-only default state can be exposed on history stream 0 without editing its Registry I/O flag, provided the state is present in the active package.
206. Process completion is not instrumentation success. Locked HRRR/WRF defaults `ignore_iofields_warning=.true.`, so an unresolved or malformed runtime-I/O request may warn and continue. Evidence-bearing control/instrumented runs must set `ignore_iofields_warning=.false.` and retain the run log.
207. `InstrumentationOutcomeClass` must distinguish at least `configured_and_resolved`, `configured_but_warned`, `configured_but_semantically_inactive`, `execution_failed`, and `not_executed`. Only the first is eligible to proceed to a non-interference comparison.
208. Runtime-I/O operational limits are part of preflight identity. The locked text syntax limits a line to 256 characters and the inspected parser hard-limits history modifications to 200; the three-field `+:h:0:RE_CLOUD,RE_ICE,RE_SNOW` manifest is within both bounds.
209. Registry declaration alone does not establish semantic initialization. A requested field must also belong to the package active for the run; for the intended checkpoint path this requires the `thompsonaero`/`mp_physics==28` path already source-authenticated in earlier rounds.
210. The shipped locked `em_scm_xy` baseline still uses `mp_physics=2`. An L1 experiment intended to preflight the Thompson-aerosol checkpoint must explicitly use `mp_physics=28`; doing so does not make SCM operationally equivalent to HRRR and does not raise the R19 evidence ceiling.
211. `InstrumentationPreflightContract` should bind source commit, Registry blob, parser blob, harness identity, physics/package activation, internal symbol↔DNAME mapping, stream type/id, fail-fast warning policy, syntax/modification limits, expected added-variable set and evidence ceiling before compute is spent.
212. R21 establishes source-level eligibility for the exact three-field history-stream instrumentation request and a fail-fast policy. It executes no WRF/HRRR model pair, proves no numerical non-interference, adds no physical Observation Root, and leaves `ReplayStatus=source_callpath_authenticated` and Frozen unchanged.

R21 evidence status:
- No new physical atmospheric Observation Root.
- Engineering roots remain distinct: locked NOAA-EMC HRRRv4 Registry/package definition; locked HRRRv4 runtime-I/O parser; locked HRRRv4 runtime-I/O documentation; locked HRRRv4 SCM baseline; current official WRF runtime-I/O documentation as corroborating architecture evidence.
- Executable source/semantic probe: `PROBES/hrrrv4_runtime_io_preflight_probe_r21.py`, result `13/13 PASS`.
- Frozen: none.
