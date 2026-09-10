# KAOPU Current Best View — R18 checkpoint-surface and instrumentation-validity extension

Date: 2026-09-10
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

163. Negative evidence must be scoped. “Not found” is meaningful only together with the exact publication/archive surfaces searched; it must not be promoted to universal non-existence.
164. The checked official NCO HRRR product inventory exposes pressure/native/surface/sub-hourly GRIB2 and BUFR families but no restart/wrfrst product class.
165. The checked official HRRR archive description advertises native/isobaric/surface cloud-archive classes but no restart class.
166. The checked live NOMADS HRRR `nwges` surface exposes `hrrrdasges` and `hrrrges_sfc`; no restart-named public family is present on that surface.
167. Locked NOAA-EMC HRRRv4 workflow source traces `hrrrges_sfc` to `wrfout_d01` and `hrrrdasges` to `wrfout_d01`, `wrfout_d02`, and a reduced `wrfout_small_d02`. These candidate stores are therefore history/model-output streams, not restart checkpoints, regardless of file size.
168. R18 therefore stops repeated public-archive hunting as the preferred path unless a new primary-source pointer identifies an untouched restart/state artifact. This is a search stop rule, not a claim that internal/offline restart artifacts do not exist.
169. WRF runtime-I/O is lower source-code perturbation than Registry edits because it can expose an already-declared state without recompilation. Official WRF documentation nevertheless warns that it can impose a performance hit.
170. “No physics recompile” is not equivalent to “numerically non-interfering.” An `InstrumentedSourceModelCheckpoint` is eligible only after a paired control/instrumented execution demonstrates that every pre-existing comparison field remains unchanged under a predeclared equality policy.
171. The control and instrumented HRRRv4 runs must lock source commit, executable/build, initial/boundary inputs, namelist, MPI/OpenMP decomposition and output times. The only permitted experimental difference is declared runtime-I/O instrumentation.
172. Newly exposed `re_cloud/re_ice/re_snow` are not part of the control-equality set because they are absent from default history; all fields that existed before instrumentation are part of the non-interference comparison set.
173. Prefer bit-wise comparison when the platform/build permits it. Any tolerance-based policy must be chosen before the result is observed and carried as evidence metadata.
174. Runtime and I/O cost are a separate validity dimension. Numerical non-interference does not imply acceptable performance, and performance cost does not by itself invalidate the source-model state values.
175. Even a successful control-pair non-interference test plus source-model/replay match authenticates implementation replay only. Thompson physical validity and visible-band cloud optical validity remain separate gates.
176. ReplayStatus therefore remains `source_callpath_authenticated` after R18. It cannot advance until an actual locked real-input HRRRv4 execution emits an eligible checkpoint and the matching external replay is numerically compared.

R18 evidence status:
- No new physical atmospheric Observation Root was added.
- Primary engineering/distribution roots remain distinct: NOAA/NCO public product inventory; NOAA/GSL HRRR archive description; NOAA/NCEP live NOMADS `nwges`; locked NOAA-EMC HRRRv4 workflow; official WRF runtime-I/O documentation; WRF paired bit-wise reproducibility method.
- Executable semantic probe: `PROBES/hrrrv4_checkpoint_surface_probe_r18.py`, result `11/11 PASS`.
- Frozen: none.
