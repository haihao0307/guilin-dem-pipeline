# KAOPU Learning R18 — HRRRv4 checkpoint surface and instrumentation validity

Date: 2026-09-10
Status: Candidate-partial. No production Mother mutation.

## Bounded question

Does an already-existing, publicly accessible, untouched HRRRv4 operational restart/state artifact provide `re_cloud/re_ice/re_snow` for replay authentication; if the bounded public search does not prove one, what evidence gate must a runtime-I/O-instrumented HRRRv4 experiment satisfy before its checkpoint can be trusted?

This remains the highest-value unresolved sub-question of `LQ-ATMOSPHERE-001` after R17. R17 established that the locked default HRRRv4 ARW history path does not emit the effective-radius states and proposed runtime-I/O as the least invasive exposure path. R18 tests whether continued search for a pre-existing public restart is still justified and whether “output-only instrumentation” may safely be assumed non-interfering.

## Observation / engineering roots kept distinct

No new physical atmospheric Observation Root is added in R18. All evidence is publication-surface, workflow, I/O, or reproducibility-method evidence.

### Engineering Root A — NOAA/NCO official HRRR public product inventory

The official NCEP/NCO HRRR inventory enumerates pressure-level GRIB2, native-level GRIB2, 2-D surface GRIB2, sub-hourly surface GRIB2 and BUFR sounding products. On the checked public product surface, no restart/wrfrst product family is listed.

Primary source:
- https://www.nco.ncep.noaa.gov/pmb/products/hrrr/
- checked 2026-09-10.

This is negative evidence only for this publication surface. It is not proof that no internal operational restart exists.

### Engineering Root B — NOAA/GSL official HRRR archive description

The official HRRR page describes the Google Cloud, AWS and Azure HRRR archives as native/isobaric/surface archives. No restart archive class is advertised there.

Primary source:
- https://rapidrefresh.noaa.gov/hrrr/
- checked 2026-09-10.

Again, absence from documented public archive classes is not universal non-existence evidence.

### Engineering Root C — NOAA/NCEP live NOMADS nwges surface

Current checked NOMADS HRRR `nwges` exposes two candidate storage families:
- `hrrrdasges/`;
- `hrrrges_sfc/`.

Primary live surfaces:
- https://nomads.ncep.noaa.gov/pub/data/nccf/com/hrrr/prod/nwges/
- https://nomads.ncep.noaa.gov/pub/data/nccf/com/hrrr/v4.1/nwges/

No restart- or wrfrst-named public surface was present in the checked listing. Directory naming alone is not used to classify file semantics; the locked HRRR workflow below supplies that evidence.

### Engineering Root D — locked NOAA-EMC HRRRv4 workflow

Locked source identity:
- repository: `NOAA-EMC/HRRR`
- commit: `40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827`

`exhrrr_post.sh` takes `wrfout_d01_<time>` as the WRF post input and the locked workflow copies those `wrfout` objects into `HRRRGES_SFC`.

`hrrrdas/exhrrr_fcst.sh` explicitly constructs `wrfout_small_d02` by applying `ncks` to `wrfout_d02`, then copies `wrfout_d01`, `wrfout_d02`, and `wrfout_small_d02` into `HRRRDASGES` under the `hrrrdas_*` names.

Therefore both current public `nwges` candidate families can be traced to WRF history/model-output streams, not to restart files. Their large sizes do not change stream identity.

The locked CONUS forecast namelist still contains `restart=.false.` and `restart_interval=5000`.

### Engineering Root E — official WRF runtime-I/O semantics

The official WRF Users Guide states that runtime I/O can alter output-stream membership of existing Registry state without a Registry edit/recompile. It also explicitly warns that runtime I/O can cause a performance hit and recommends Registry changes for production runs.

Locked documentation source:
- repository: `wrf-model/Users_Guide`
- commit: `cc8dc53ef00a466adf5c20fa230a704c1e3f12f8`
- file: `output.rst`

This establishes that runtime-I/O is lower source-code perturbation, but it does **not** establish zero numerical or timing perturbation for the locked HRRRv4 configuration.

### Engineering Root F — WRF paired bit-wise reproducibility method

WRF documents a paired-run restart reproducibility method: run matching simulations to the same output time and compare output with `diffwrf` for bit-wise identity. R18 transfers the **paired-control comparison method**, not the conclusion from the restart example.

Primary source:
- https://github.com/wrf-model/WRF/wiki/How-to-Check-Bit-for-Bit-Results-with-Restart-Capability

## Core logical corrections

1. **Not found on checked public surfaces != does not exist anywhere.** Negative evidence must carry the exact archive/publication surfaces searched.
2. **A large `nwges` object != restart state.** Locked producer workflow, not file size or directory name, determines stream identity.
3. **No recompile != no perturbation.** Runtime-I/O changes only output selection at the source/configuration level, but official WRF documentation warns of a performance cost. Numerical non-interference still requires an actual paired execution test.
4. **Output-only intent != validated output-only behavior.** An instrumented run is eligible as a replay checkpoint only after all pre-existing comparison fields remain unchanged under a declared equality policy.
5. **Bit-wise/non-interference success != physical validation.** Even a perfect source-model/replay checkpoint match authenticates implementation replay only; it does not prove Thompson microphysics or cloud optical physics is correct.

## Transferable methods

1. Add `NegativeEvidenceScope`: every “not found” result must record the searched surfaces and the unsearched remainder.
2. Add `ArchiveSurfaceCoverage`: distinguish product inventory, cloud archive, live operational distribution, internal filesystem and offline archive surfaces.
3. Add `SearchStopRule`: once all documented public surfaces plus candidate live stores are checked and the candidate stores are source-traced to ineligible stream classes, stop repeated archive hunting unless a new primary pointer appears.
4. Add `InstrumentationValidityVector` with separate dimensions:
   - `stateExposureValid`;
   - `preexistingFieldNonInterferenceValid`;
   - `performancePerturbationMeasured`;
   - `checkpointIdentityComplete`;
   - `sourceReplayMatchValid`.
5. Use a `ControlInstrumentedPair`: same source commit, executable/build, initial/boundary data, namelist, MPI/OpenMP decomposition and output times; only the declared runtime-I/O instrumentation may differ.
6. Compare all **pre-existing** fields at matching output times; the newly exposed `re_*` diagnostics are excluded from the control-equality set because they do not exist in the control history stream.
7. Prefer bit-wise equality where the locked platform/build supports it. If bit-wise equality is not attainable, any tolerance policy must be declared before the run and cannot be chosen after seeing the result.
8. Measure performance separately. A checkpoint can be numerically non-interfering while still imposing unacceptable I/O/runtime cost.
9. Keep the resulting checkpoint typed `InstrumentedSourceModelCheckpoint`, even if the control/instrumented pair is bit-wise identical on all pre-existing fields.

## Executable evidence

Probe: `PROBES/hrrrv4_checkpoint_surface_probe_r18.py`

The bounded semantic probe validates eleven invariants:
- checked public NCO product classes contain no restart class;
- checked official cloud archive categories contain no restart class;
- checked live NOMADS `nwges` surface contains no restart-named family;
- locked `hrrrges_sfc` origin is `wrfout` history;
- locked `hrrrdasges` origins are `wrfout`/reduced-`wrfout` history;
- runtime-I/O can expose existing state without Registry recompile;
- documented performance perturbation is not silently assumed zero;
- negative evidence remains bounded rather than universal;
- a control/instrumented comparison accepts unchanged pre-existing fields;
- the same gate rejects a change to any pre-existing field;
- ReplayStatus cannot advance without both a paired non-interference result and an eligible source-model checkpoint match.

Result: `11/11 PASS`.

The synthetic hash comparison in the probe demonstrates only the gate logic. It is not an HRRR execution.

## State ledger

### Observation

No new physical atmospheric Observation Root.

Primary engineering observations:
- NCO's checked public HRRR product inventory does not publish a restart/wrfrst product class.
- The checked official HRRR cloud-archive description advertises native/isobaric/surface archive classes, not restart artifacts.
- The checked current NOMADS HRRR `nwges` surface exposes `hrrrdasges` and `hrrrges_sfc`, with no restart-named public family.
- Locked NOAA-EMC workflow traces `hrrrges_sfc` to `wrfout_d01` and `hrrrdasges` to `wrfout_d01`, `wrfout_d02`, and `ncks`-reduced `wrfout_small_d02`.
- Official WRF documentation says runtime-I/O can avoid Registry recompilation but can cause a performance hit.

### Candidate

- `NegativeEvidenceScope`.
- `ArchiveSurfaceCoverage`.
- `SearchStopRule` for repeated checkpoint discovery.
- `InstrumentationValidityVector`.
- `ControlInstrumentedPair` as the required non-interference experiment for the future HRRRv4 runtime-I/O checkpoint.
- Paired comparison of all pre-existing output fields at matching times before accepting the new `re_*` values as replay-authentication evidence.

### Current Best View

The bounded official-public search did not produce an eligible untouched HRRRv4 restart checkpoint. The two currently visible `nwges` candidate families are source-traced history/model-output products, so repeatedly treating them as possible restart files is no longer justified. This does **not** prove that no internal/offline operational restart exists. Unless a new primary-source pointer identifies such an artifact, the higher-value path is an isolated HRRRv4 runtime-I/O experiment. That experiment must use a paired uninstrumented control and must prove non-interference on every pre-existing comparison field before its `re_cloud/re_ice/re_snow` values are accepted as an `InstrumentedSourceModelCheckpoint`. Performance perturbation is a separate measured quantity.

### Frozen

None.

### Rejected

- “No restart is listed on NOMADS/NCO, therefore NOAA never creates one.”
- Continuing to infer restart semantics from `nwges` file size or internal-looking names after producer workflow traces them to `wrfout`.
- “Runtime-I/O does not recompile physics, therefore it cannot affect the run.”
- Accepting instrumented `re_*` values without a matching control run.
- Choosing numerical tolerances after seeing a control/instrumented mismatch.
- Treating a non-interference/replay match as physical validation of cloud microphysics or optics.

### Unknown

- Whether an unadvertised/internal/offline fixed-cycle HRRRv4 operational restart containing `re_cloud/re_ice/re_snow` exists and is obtainable.
- Whether the locked HRRRv4 executable is bit-wise invariant under the proposed runtime-I/O addition on the intended platform/decomposition.
- Actual performance cost of exposing the three 3-D effective-radius fields in a controlled HRRRv4 run.
- Actual real-input source-model `re_cloud/re_ice/re_snow` checkpoint values.
- External Thompson replay numerical gap on matching real inputs.
- Visible-band liquid/ice optical closure and dual-evaluator gates from earlier rounds.

## Routing

Route as Candidate only:
- Weather Mother: adopt negative-evidence scope and instrumentation validity; do not treat public archive absence as physical/model absence.
- Atmosphere: accept `re_*` from an instrumented HRRRv4 run only after control-pair non-interference and checkpoint identity are satisfied.
- KAOPU semantic core: make negative-evidence coverage, output instrumentation, control identity and non-interference result first-class provenance.
- Lighting: no direct new physical route; effective radius remains upstream of spectral optical closure.

No production Mother branch is modified.

## Gate result and next gate

R18 closes the **bounded public checkpoint search** as a low-yield path: no eligible untouched restart was found on the documented/checked public surfaces, and the live `nwges` candidates were traced to history output. This is a scoped negative result, not universal non-existence.

Next Weather-coupling gate: stop repeated archive hunting unless a new official pointer appears. Prepare/run one isolated non-production HRRRv4 `ControlInstrumentedPair` with exact locked source/build/input/decomposition and only the runtime-I/O addition `+:h:0:re_cloud,re_ice,re_snow`. Compare every pre-existing output field at matching times using a predeclared bit-wise/tolerance policy, record runtime/I/O cost, then compare the instrumented `re_*` checkpoint with the external source-locked Thompson replay. ReplayStatus remains `source_callpath_authenticated` until real input execution plus eligible checkpoint matching is actually completed.
