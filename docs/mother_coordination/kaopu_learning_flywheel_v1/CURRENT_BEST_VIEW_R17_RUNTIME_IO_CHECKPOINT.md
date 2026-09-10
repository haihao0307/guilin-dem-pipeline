# KAOPU Current Best View — R17 runtime-I/O checkpoint extension

Date: 2026-09-10
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

153. WRF Registry I/O association is part of runtime evidence identity. In the locked HRRRv4 ARW Registry, `re_cloud`, `re_ice` and `re_snow` carry IO token `r`, meaning restart, and do not carry `h`, meaning history.
154. The locked HRRRv4 `thompsonaero` package nevertheless carries `re_cloud/re_ice/re_snow` as model state. State existence and default history emission are therefore separate capabilities.
155. `hrrrges_sfc` is carried WRF history/model output: the locked HRRR post workflow copies `wrfout_d01_*` into that store and downstream workflow copies those objects back under `wrfoutd01_*` names. Its very large size does not make it a restart checkpoint.
156. The locked CONUS run template sets `restart=.false.`, `restart_interval=5000` minutes and a 12-hour run. That template alone does not yield a useful restart-state checkpoint; operational scripts may override template timing, so absence of all operational restart artifacts remains Unknown rather than proven.
157. WRF runtime I/O is a transferable instrumentation mechanism: `iofields_filename` can add existing state variables to a history stream without changing physics source or recompiling. For the locked HRRR source, `+:h:0:re_cloud,re_ice,re_snow` is a candidate minimal instrumentation request.
158. A checkpoint emitted by such an altered output configuration must be typed `InstrumentedSourceModelCheckpoint`, not `OperationalSourceModelStateCheckpoint`. Instrumentation lineage is part of evidence identity even when physical algorithms are unchanged.
159. `InstrumentedSourceModelCheckpoint` can authenticate whether an external KAOPU replay reproduces the locked source-model runtime diagnostic, provided executable/build, initial state, configuration, cycle/time/support and runtime-I/O alteration are all locked. It does not validate the atmospheric physics itself.
160. Runtime-I/O exposure is less invasive than editing Registry/source because it avoids physics-code changes and recompilation, but it is still an experiment and must never be relabeled as an untouched operational product.
161. Current public NOMADS `hrrrges_sfc` availability is not sufficient to advance `ReplayStatus`: the multi-gigabyte objects were not byte-inspected in this bounded cycle and default Registry semantics predict no `re_*` history fields unless an override was active.
162. After R17, the preferred bounded authentication route is a small controlled HRRRv4 source-model execution with runtime-I/O instrumentation or an already-existing restart artifact if one can be proven. The post `EFFR` path remains a differential comparator, not an automatic substitute.

R17 evidence status:
- No new physical atmospheric Observation Root was added.
- Primary engineering roots: locked NOAA-EMC HRRRv4 ARW Registry, CONUS namelist template, runtime-I/O documentation, post/nwges workflow, and official WRF Registry I/O semantics.
- Live distribution root: NOAA/NCEP NOMADS current `hrrrges_sfc` listing; file bytes were not decoded.
- Executable semantic probe: `PROBES/hrrrv4_runtime_io_checkpoint_probe_r17.py`, result `11/11 PASS`.
- Frozen: none.
