# KAOPU Learning R17 — HRRRv4 runtime-I/O checkpoint boundary

Date: 2026-09-10
Status: Candidate-partial. No production Mother mutation.

## Bounded question

Can a fixed HRRRv4 CONUS ARW runtime expose `re_cloud/re_ice/re_snow` as a source-model checkpoint, and if the normal operational history path does not expose them, what is the least invasive reproducible method to instrument them without changing microphysics?

This is the highest-value unresolved sub-question of `LQ-ATMOSPHERE-001` after R16. The logical risk is assuming that an internal state variable or a very large raw model-output file automatically contains the desired checkpoint.

## Observation roots / engineering roots kept distinct

No new physical atmospheric Observation Root is added in R17. All evidence below is source/configuration/workflow evidence.

### Engineering Root A — locked HRRRv4 ARW Registry

At NOAA-EMC HRRR commit `40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827`, `Registry.EM` includes `Registry.EM_COMMON`. In `Registry.EM_COMMON`, `re_cloud`, `re_ice` and `re_snow` are model state with IO token `r`; the `thompsonaero` package (`mp_physics==28`) carries those three states.

Primary source:
- NOAA-EMC/HRRR, locked commit above.

Official WRF Registry documentation defines `r` as restart and `h` as history. Therefore the locked default ARW Registry does **not** put these fields in the main history stream merely because they are model state.

Primary documentation:
- wrf-model/Users_Guide `software.rst`, commit `cc8dc53ef00a466adf5c20fa230a704c1e3f12f8`.

### Engineering Root B — locked HRRRv4 CONUS time-control template

`parm/conus/hrrr_run_namelist.input` at the locked HRRR commit contains:
- `run_hours = 12`;
- `restart = .false.`;
- `restart_interval = 5000` minutes;
- NetCDF history/restart format 2.

The template does not activate `iofields_filename` in the time-control block.

This means the template by itself does not provide a useful restart checkpoint during its 12-hour run. Operational scripts may modify run length or other settings, so R17 does **not** claim that every production cycle lacks restart artifacts.

### Engineering Root C — HRRR/WRF runtime I/O

The locked HRRR `README.io_config` states that existing state variables can be added to or removed from history/input streams at run time without recompiling. The form is:

`op:streamtype:streamid:variables`

and history stream 0 is the main history stream. `iofields_filename` defaults to `NONE_SPECIFIED`.

Therefore this is a valid **candidate instrumentation request**:

`+:h:0:re_cloud,re_ice,re_snow`

This changes output-stream membership, not Thompson microphysics code. It is still an experiment and must carry instrumentation lineage.

### Engineering Root D — HRRR `hrrrges_sfc` workflow and current distribution

The locked `exhrrr_post.sh` copies `INPUT_DATA/wrfout_d01_<time>` into `HRRRGES_SFC/hrrr_<cycle>f<forecast-hour>`. `exhrrr_wrfbufr.sh` later copies those stored objects back to `wrfoutd01_<time>` names. HRRR v4.1.20 release notes say the first 18 forecast hours of model output are saved to `COM/nwges/hrrrges_sfc` and that this adds about 2.59 TB/day.

Current NOAA/NCEP NOMADS listings checked on 2026-09-10 expose `hrrrges_sfc` CONUS objects around 15 GB each.

This is strong evidence that `hrrrges_sfc` is carried WRF history/model output. File size is not evidence of restart semantics or of `re_*` presence. The bounded runtime could not range-fetch/decode the 15-GB NetCDF object, so byte-level field inventory remains Unknown.

## Core logical corrections

1. **State existence != file emission.** A field can exist in the model and be routed through a physics package while not belonging to the default history stream.
2. **Large/raw model output != restart checkpoint.** A multi-gigabyte `wrfout` remains history output unless stream identity proves otherwise.
3. **Instrumented source output != untouched operational output.** Runtime-I/O can expose a source-model diagnostic without altering physics, but that output must be labeled as instrumented.
4. **Instrumentation can validate replay behavior, not physical truth.** Matching a source-model runtime state can authenticate the external replay of that diagnostic; it does not independently prove Thompson cloud physics is physically correct.

## Transferable methods

1. Add `OutputStreamIdentity` to evidence identity: at least input/history/restart/aux stream, stream id, format and emission rule.
2. Add `InstrumentationLineage`: configuration-only runtime I/O changes must be recorded even when source code and physics are unchanged.
3. Split source-model checkpoints into at least:
   - `OperationalSourceModelStateCheckpoint` — pre-existing untouched operational artifact;
   - `InstrumentedSourceModelCheckpoint` — source-model execution with diagnostic-only output instrumentation;
   - `DifferentialComparator` — independent/recomputed diagnostic path such as the HRRR post `EFFR` path.
4. Prefer runtime-I/O instrumentation over Registry/physics source modification when the sole purpose is to expose an already-existing model state. This reduces perturbation and avoids a recompile.
5. Do not advance `ReplayStatus` because instrumentation is theoretically available. Advance only after actual bytes from a locked execution are produced/decoded and the checkpoint identity is complete.

## Executable evidence

Probe: `PROBES/hrrrv4_runtime_io_checkpoint_probe_r17.py`

The probe uses locked Registry/configuration excerpts and validates:
- each of `re_cloud/re_ice/re_snow` has restart association;
- none has default history association;
- `thompsonaero` carries all three states;
- the locked template restart interval lies beyond the template run;
- `+:h:0:re_cloud,re_ice,re_snow` parses as addition to main history stream;
- the candidate instrumentation asks only for the three diagnostic states;
- runtime-I/O override is not default behavior.

Result: `11/11 PASS`.

This is a semantic/configuration probe, not a compiled HRRR execution and not atmospheric validation.

## State ledger

### Observation

No new physical atmospheric Observation Root.

Primary engineering observations:
- Locked HRRRv4 ARW Registry assigns `re_cloud/re_ice/re_snow` to restart (`r`) and not default history (`h`).
- Locked `thompsonaero` package carries these states.
- Locked CONUS namelist template uses a 5000-minute restart interval for a 12-hour template run and does not activate runtime-I/O override.
- Locked WRF/HRRR runtime-I/O documentation permits adding existing state variables to history without recompiling.
- Locked HRRR workflow carries `wrfout` into `hrrrges_sfc`; current NOMADS exposes very large instances of this store.

### Candidate

- `OutputStreamIdentity`.
- `InstrumentationLineage`.
- `OperationalSourceModelStateCheckpoint` versus `InstrumentedSourceModelCheckpoint`.
- Minimal runtime-I/O instrumentation: `+:h:0:re_cloud,re_ice,re_snow`.
- A controlled locked-source HRRRv4 execution with only runtime-I/O output instrumentation as the preferred next source-model checkpoint experiment if an untouched operational restart artifact cannot be proven.

### Current Best View

The normal locked HRRRv4 ARW history path should not be assumed to contain `re_cloud/re_ice/re_snow`, because their Registry IO membership is restart-only. `hrrrges_sfc` is carried `wrfout` history/model output, not evidence of restart state. The least invasive path to expose these diagnostics for replay authentication is WRF runtime-I/O, which can add the already-existing state to history without changing Thompson physics or recompiling. Such output is an `InstrumentedSourceModelCheckpoint`, not an untouched operational checkpoint. Replay status remains `source_callpath_authenticated` until real source-model bytes are produced/decoded and matched.

### Frozen

None.

### Rejected

- “`re_cloud` exists in source, therefore it is in ordinary HRRR history files.”
- “A 15-GB raw model file must contain every internal state.”
- “`hrrrges_sfc` is effectively a restart file because it is large/raw.”
- “A runtime-I/O-instrumented run can be labeled as untouched operational output.”
- “The documented ability to add the variable is equivalent to having executed and validated the checkpoint.”
- Editing Thompson or Registry source merely to expose an existing state when runtime-I/O suffices.

### Unknown

- Whether any accessible fixed HRRRv4 CONUS operational restart artifact already contains these fields.
- Whether production job scripting overrides the locked template in a way that produces a usable restart artifact for a chosen cycle.
- Byte-level variable inventory of a current 15-GB `hrrrges_sfc` object; bounded container networking could not fetch it.
- Actual successful output of `re_cloud/re_ice/re_snow` from a compiled locked HRRRv4 binary using runtime-I/O instrumentation.
- Matching real-input numerical checkpoint against the external KAOPU replay.
- The separate visible-band liquid/ice optical-closure and dual-evaluator gates from earlier rounds.

## Routing

Route as Candidate only:
- Weather Mother: preserve stream identity and instrumentation lineage; prefer output-only instrumentation for a future isolated HRRRv4 diagnostic experiment.
- Atmosphere: treat `re_*` as source-model diagnostics only after checkpoint class and runtime identity are explicit.
- Lighting: no direct promotion; effective radius is still upstream of spectral optical closure.
- KAOPU semantic core: make output stream and instrumentation lineage first-class evidence fields.

No production Mother branch is modified.

## Gate result and next gate

R17 closes the question of **default file semantics**: the locked ARW Registry does not make the effective-radius fields default history outputs, and the standard `hrrrges_sfc` route is carried `wrfout` history output. It also identifies a lower-perturbation instrumentation route.

R17 does **not** close runtime authentication. Next gate: use an isolated, non-production HRRRv4 source-model execution with exact locked source/build/input and only runtime-I/O instrumentation to emit `re_cloud/re_ice/re_snow`, or find and prove an untouched operational restart artifact first. Decode a small spatial/vertical subset, retain cycle/support/stream/instrumentation identity, and compare it with the external source-locked Thompson replay. Only then may `real_input_executed` and a checkpoint match advance; physical cloud-optics validation remains separate.
