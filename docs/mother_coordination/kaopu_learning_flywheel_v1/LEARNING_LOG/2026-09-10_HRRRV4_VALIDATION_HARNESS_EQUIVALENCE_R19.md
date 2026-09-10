# KAOPU Learning R19 — HRRRv4 validation-harness equivalence ladder

Date: 2026-09-10
Status: Candidate-partial. No production Mother mutation.

## Bounded question

Can the locked HRRRv4/WRF single-column model (`em_scm_xy`) be used as a cheaper first-stage `ControlInstrumentedPair` for runtime-I/O exposure of `re_cloud/re_ice/re_snow`, and exactly which claims can such a reduced harness validate without being confused with HRRRv4 operational replay authentication?

This remains the highest-value unresolved sub-question of `LQ-ATMOSPHERE-001`. R18 established that the preferred next evidence is an actual paired HRRRv4 control/instrumented run, but that full operational-scale execution is expensive. R19 asks whether an official reduced harness can de-risk instrumentation without lowering the evidence standard.

## Observation / engineering roots kept distinct

No new physical atmospheric Observation Root is added in R19. All new evidence is model-test, configuration, I/O, or regression-method evidence.

### Engineering Root A — locked NOAA-EMC HRRRv4 SCM source

Locked source identity:
- repository: `NOAA-EMC/HRRR`
- commit: `40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827`
- files:
  - `sorc/hrrr_wrfarw.fd/WRFV3.9/test/em_scm_xy/README.scm`
  - `sorc/hrrr_wrfarw.fd/WRFV3.9/test/em_scm_xy/namelist.input`

The locked HRRR source tree includes WRF's `em_scm_xy` single-column test. The README states that it runs on a 3x3 stencil with periodic X/Y boundaries, supports no horizontal gradients, and has no advection unless explicitly imposed. Initialization is from idealized text sounding/soil inputs through `ideal.exe`.

The locked SCM namelist uses:
- `e_we=3`, `e_sn=3`, `e_vert=60`;
- `dx=4000`, `dy=4000`;
- `mp_physics=2`;
- periodic X/Y boundaries.

This is a real executable harness included in the locked HRRR source tree, but its default configuration is not the locked HRRRv4 CONUS operational configuration.

### Engineering Root B — locked HRRRv4 CONUS configuration

Locked source:
- repository: `NOAA-EMC/HRRR`
- commit: `40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827`
- file: `parm/conus/hrrr_wrf.nl`

The locked CONUS configuration uses:
- 1800 x 1060 horizontal grid;
- 51 vertical levels;
- 3 km horizontal spacing;
- `mp_physics=28`;
- `use_aero_icbc=.true.`;
- `use_rap_aero_icbc=.true.`;
- specified lateral-boundary semantics rather than periodic SCM boundaries.

Therefore the default SCM and operational HRRRv4 differ simultaneously in dynamics support, boundary semantics, microphysics selection, aerosol initialization, grid support and initialization path.

### Engineering Root C — official WRF Thompson aerosol-aware documentation

Official WRF documentation states that `mp_physics=28` is Thompson aerosol-aware microphysics. With `use_aero_icbc=.false.`, the scheme can initialize idealized/common horizontal aerosol profiles internally. With externally supplied aerosol IC/BC enabled, aerosol fields are provided through preprocessing/input data.

Primary sources checked 2026-09-10:
- https://www2.mmm.ucar.edu/wrf/site/documentation/thompson_aerosol-aware.html
- https://www2.mmm.ucar.edu/wrf/site/documentation/users_guide/physics.html

This shows that a reduced WRF run can exercise mp=28 without full external aerosol data by choosing the internal-profile mode, but doing so changes the aerosol state definition relative to locked HRRRv4 and therefore cannot authenticate the operational HRRR aerosol path.

### Engineering Root D — official WRF runtime-I/O documentation

Official WRF runtime-I/O documentation states that already-declared state variables may be added to an output stream without editing the Registry or recompiling, and warns that runtime-I/O can cause a performance hit.

Primary sources:
- https://www2.mmm.ucar.edu/wrf/wrf_tutorial/runtime_io.html
- https://www2.mmm.ucar.edu/wrf/site/documentation/users_guide/output.html

This makes SCM suitable as a low-cost instrumentation-plumbing preflight, but does not prove numerical non-interference on the full HRRRv4 configuration.

### Engineering Root E — official WRF Testing Framework

The current official WRF Testing Framework documentation describes short serial/OpenMP/MPI regression runs and bit-for-bit comparison. In the inspected public ARW physics table, non-aerosol Thompson `mp=8` appears, while aerosol-aware Thompson `mp=28` does not appear.

Primary source:
- https://www2.mmm.ucar.edu/wrf/site/code_contribution/wtf.html

This is scoped negative evidence about the inspected table only. It does not prove that mp=28 is never tested elsewhere by NCAR/NOAA or in other internal/legacy suites. It means KAOPU must not inherit a public `mp=28` regression guarantee from this table without direct evidence.

## Core logical corrections

1. **Same source tree != same validation object.** `em_scm_xy` lives inside locked HRRR source, but a 3x3 periodic no-horizontal-gradient SCM is not the 1800x1060 specified-boundary HRRR CONUS model.
2. **Same microphysics family != same aerosol state.** Switching SCM to `mp_physics=28` with `use_aero_icbc=false` can exercise Thompson aerosol-aware code, but it replaces HRRR's external aerosol IC/BC semantics with an internally generated profile.
3. **A reduced harness pass != operational replay authentication.** SCM can validate runtime-I/O plumbing and expose software-side failures cheaply; it cannot advance `ReplayStatus` to `real_input_executed` or `runtime_authenticated`.
4. **Absence from one public regression table != absence of all testing.** The inspected WRF Testing Framework table does not list mp=28, so no mp=28 guarantee may be inherited from that table; universal non-testing is not claimed.
5. **Bit-wise stability at reduced scale != physical validity.** A perfect SCM control/instrumented match only demonstrates non-interference for that harness/configuration.

## Transferable methods

1. Add `ValidationHarnessIdentity`:
   - source commit/build;
   - dynamical core/test case;
   - horizontal/vertical support;
   - boundary semantics;
   - initialization path;
   - physics selection;
   - aerosol/chemistry state source;
   - decomposition;
   - output instrumentation.

2. Add `HarnessEquivalenceVector` with separate axes:
   - `codePathEquivalent`;
   - `physicsOptionEquivalent`;
   - `stateInitializationEquivalent`;
   - `boundaryEquivalent`;
   - `dynamicsEquivalent`;
   - `supportEquivalent`;
   - `decompositionEquivalent`.

3. Add `EvidenceCeiling`: every harness declares the strongest claim it can support. Evidence from a lower-equivalence harness cannot silently promote a higher-equivalence state.

4. Use a validation ladder:
   - `L0 semantic/static probe`: contract logic only;
   - `L1 SCM instrumentation preflight`: runtime-I/O syntax/state exposure and reduced-case non-interference;
   - `L2 reduced real-data em_real/HRRR-derived case`: selected real initialization/boundary semantics and mp=28 integration;
   - `L3 locked HRRRv4 ControlInstrumentedPair`: operational-equivalent replay checkpoint gate.

5. A modified SCM using `mp=28` plus internal aerosol profiles may become a `PhysicsHarness`, but must retain `stateInitializationEquivalent=false` to HRRRv4.

6. Prefer running L1 before L3 because it can cheaply catch variable-name, stream, NetCDF, runtime-I/O and comparison-pipeline failures. Passing L1 must not change `ReplayStatus`.

7. Preserve the R18 predeclared equality rule at every executable tier: compare all pre-existing fields; record runtime/I/O cost separately.

## Executable evidence

Probe:
`PROBES/hrrrv4_validation_harness_probe_r19.py`

The bounded semantic probe verifies twelve invariants:
- the locked HRRR SCM is 3x3;
- it removes horizontal-gradient dynamics;
- its default `mp_physics` differs from HRRRv4;
- locked HRRRv4 uses external/operational aerosol ICBC flags;
- SCM periodic and HRRR specified-boundary semantics differ;
- official WRF supports an internal-profile mp=28 mode;
- that internal-profile mode is not the locked HRRR aerosol initialization;
- runtime-I/O is low source perturbation but not documented zero-cost;
- the inspected current WRF regression table does not list mp=28;
- the same table does list non-aerosol Thompson mp=8;
- SCM is eligible as an instrumentation-plumbing preflight;
- SCM is ineligible to authenticate HRRRv4 operational replay.

Result: `12/12 PASS`.

This probe does not run WRF or HRRR and contains no atmospheric truth values.

## State ledger

### Observation

No new physical atmospheric Observation Root.

Primary engineering observations:
- locked HRRRv4 source includes a 3x3 periodic `em_scm_xy` test with no horizontal gradients and default `mp_physics=2`;
- locked HRRRv4 CONUS uses 3 km, 1800x1060, `mp_physics=28`, external/rapid-refresh aerosol ICBC and specified boundaries;
- official WRF permits mp=28 with internally initialized aerosol profiles when external aerosol ICBC is disabled;
- official WRF runtime-I/O can expose existing state without Registry recompilation and may impose performance cost;
- the inspected current WRF Testing Framework ARW table includes mp=8 but not mp=28.

### Candidate

- `ValidationHarnessIdentity`.
- `HarnessEquivalenceVector`.
- `EvidenceCeiling`.
- `ValidationScaleLadder` L0/L1/L2/L3.
- `SCMInstrumentationPreflight` as a low-cost de-risking step that cannot advance ReplayStatus.
- `ReducedRealCasePreflight` as an optional intermediate tier if a small real-data case preserves the needed mp=28/aerosol/boundary semantics.

### Current Best View

The full HRRRv4 ControlInstrumentedPair remains the replay-authentication gate. The locked SCM is useful, but only as a cheaper instrumentation preflight: it can catch runtime-I/O/state-exposure/comparison-pipeline failures before an expensive HRRR run. Its default 3x3 periodic no-horizontal-gradient configuration and different microphysics/aerosol initialization prevent it from serving as operational replay evidence. If SCM is changed to mp=28 with internally generated aerosols, it becomes a physics-path harness rather than an HRRR-equivalent state harness. Every reduced test must carry an explicit evidence ceiling.

### Frozen

None.

### Rejected

- “The SCM is inside the HRRR repository, therefore an SCM pass authenticates HRRR.”
- “Set `mp_physics=28` in SCM and it becomes HRRRv4-equivalent.”
- “Internal aerosol climatology is interchangeable with HRRR external aerosol IC/BC.”
- “A bit-wise SCM control pair proves full-domain runtime-I/O non-interference.”
- “The public WRF test table omits mp=28, therefore nobody tests mp=28.”
- Lowering the R18 operational checkpoint standard because the full model is expensive.

### Unknown

- Whether the locked HRRRv4 source can execute an mp=28 SCM with all needed state exposure without additional case-specific initialization changes.
- Whether a compact `em_real` or HRRR-derived limited-domain case can preserve enough aerosol/boundary/state semantics to serve as an L2 preflight.
- Actual control/instrumented non-interference and performance cost on locked HRRRv4.
- Actual real-input source-model `re_cloud/re_ice/re_snow` checkpoint values.
- External Thompson replay numerical gap on matching real inputs.
- Visible-band liquid/ice optical closure and dual-evaluator gates from earlier rounds.

## Ordinary-user implementation constraints

A normal developer cannot turn the SCM into HRRR replay authentication simply by changing one namelist value. The HRRR configuration uses external rapid-refresh aerosol IC/BC, specified lateral boundaries, WRF-Chem-related configuration, 51 operational vertical levels and a large MPI domain. The SCM input format is a small idealized sounding/soil case and does not by itself reproduce that state. Building and running the locked legacy HRRRv4 tree also requires a compatible Fortran/MPI/NetCDF environment. These constraints make SCM valuable as a software preflight, not a shortcut around the operational validation gate.

## Routing

Route as Candidate only:
- Weather Mother: attach `ValidationHarnessIdentity` and `EvidenceCeiling` to every reduced weather-model experiment.
- Atmosphere: accept SCM-exposed `re_*` only as instrumentation/physics-harness evidence, never as an HRRR operational checkpoint.
- KAOPU semantic core: make harness-equivalence axes and evidence ceiling first-class provenance.
- Lighting: no new physical promotion; effective-radius/optical closure remains downstream and unchanged.

No production Mother branch is modified.

## Gate result and next gate

R19 does not close the R18 operational ControlInstrumentedPair gate. It adds a cheaper, correctly bounded preflight tier.

Preferred execution order:
1. run one locked-source SCM control/instrumented pair to verify `re_*` runtime-I/O plumbing and comparison tooling;
2. if a compact real-data case can preserve mp=28 plus the required aerosol/state semantics, use it as L2;
3. perform the locked HRRRv4 ControlInstrumentedPair for any ReplayStatus advancement.

A pass at L1 or L2 must not advance `ReplayStatus` beyond `source_callpath_authenticated`. Only actual eligible L3 real-input checkpoint evidence can do that.
