# KAOPU bounded learning cycle — R22 HRRRv4 effective-radius producer liveness

Date: 2026-09-11  
Learning question: `LQ-ATMOSPHERE-001`  
Status: `candidate-partial`  
Production Mother mutation: forbidden; none performed.

## Why this question was selected

R21 made the three `RE_CLOUD/RE_ICE/RE_SNOW` states source-level instrumentable, but the planned L1 SCM pair still assumed that making the fields observable plus selecting `mp_physics=28` would make them meaningful effective-radius checkpoints. That inference is incomplete. The highest-value bounded question is therefore: **what exact locked-source conditions make the Thompson effective-radius producer live, and how can L1 distinguish a freshly computed value from an initialized-but-never-refreshed value?**

## Primary-source engineering evidence roots

### Engineering Evidence Root A — locked shipped SCM configuration
The locked `em_scm_xy` baseline is 3×3 and uses `mp_physics=2`, `ra_lw_physics=1`, and `ra_sw_physics=1`. This root establishes only the shipped harness baseline.

### Engineering Evidence Root B — locked HRRRv4 producer-request logic
In `module_physics_init.F`, `has_reqc/has_reqi/has_reqs` start at zero. The source connects microphysics-computed effective radii to radiation only when `use_mp_re==1`, LW is RRTMG (or its fast variant), SW is RRTMG (or its fast variant), and the selected microphysics is in the supported set including Thompson/ThompsonAero. `Registry.EM_COMMON` gives `use_mp_re` a default of 1.

### Engineering Evidence Root C — locked Thompson guarded refresh
In `module_mp_thompson.F`, the `calc_effectRad` call is inside a guard requiring all three request flags to be nonzero. Runtime-I/O exposure is outside this producer guard and therefore cannot prove producer liveness.

### Engineering Evidence Root D — initialization values
`module_physics_init.F` seeds starting radiative effective radii with 2.51 µm cloud water, 5.01 µm cloud ice, and 10.01 µm snow when requested. These values are physically plausible-looking. Consequently “nonzero/plausible checkpoint” is not a freshness test.

### Engineering Evidence Root E — operational CONUS configuration
Locked `parm/conus/hrrr_wrf.nl` uses `mp_physics=28`, `ra_lw_physics=4`, `ra_sw_physics=4`, `use_aero_icbc=.true.`, and `use_rap_aero_icbc=.true.`. This demonstrates that the operational source configuration is materially different from the shipped SCM radiation configuration. It does not make SCM equivalent to CONUS.

### Engineering Evidence Root F — aerosol-aware runtime table dependency
Locked Thompson calls `table_ccnAct` when aerosol-aware and treats CCN activation table open/read failures as fatal. The operational forecast script includes `hrrr_run_CCN_ACTIVATE.BIN` in the staged runtime inputs. The table is therefore a first-class harness dependency for this path.

No item above is a new physical atmospheric Observation Root. They are source/configuration/workflow evidence from the official NOAA-EMC tree and official WRF documentation.

## Logical errors rejected before implementation

1. **Observability-liveness conflation:** “the state is exposed in history, therefore it was freshly calculated.” False; stream masking and producer execution are separate.
2. **Single-condition inference:** “`mp_physics=28` is enough.” False; the locked producer request is conjunctive and depends on `use_mp_re` plus compatible RRTMG LW/SW.
3. **Plausibility-as-provenance:** “the numbers look like valid effective radii, therefore Thompson computed them.” False; initialization itself creates plausible nonzero radii.
4. **Harness-equivalence leap:** “SCM configured with mp28+RRTMG is HRRR.” False; aerosol initialization, boundaries, dynamics, support, decomposition and real-data state remain different under the R19 evidence ceiling.

## Transferable candidate methods

- `ProducerExecutionEligibility`: keep state declaration/exposure separate from the conditions that actually execute its producer.
- `ProducerDemandCoupling`: record when a diagnostic is computed only because a downstream consumer requests it.
- `CheckpointFreshnessContract`: classify checkpoint lineage as `initialized`, `producer-refreshed`, `carried/restarted`, or `unknown`.
- `AuxiliaryRuntimeDependency`: bind tables/LUTs/data files needed by the selected source path to the harness identity and hash them before evidence-bearing execution.

These transfer beyond WRF: Houdini SOP attributes, Unreal render resources, Blender caches, Substance graph outputs, and procedural field intermediates can all exist or serialize without being freshly evaluated by the intended producer.

## Corrected L1 experiment contract

The next L1 SCM preflight must explicitly bind at least:
- locked HRRRv4 source commit and build identity;
- `mp_physics=28`;
- `ra_lw_physics=4`;
- `ra_sw_physics=4`;
- explicit `use_mp_re=1`;
- the R21 runtime-I/O manifest `+:h:0:RE_CLOUD,RE_ICE,RE_SNOW`;
- `ignore_iofields_warning=.false.`;
- the applicable Thompson/CCN runtime auxiliary files and identities;
- control/instrumented identity and R20 comparator;
- an explicit freshness check showing the producer path ran before a `re_*` checkpoint is treated as replay evidence.

Even a fully passing L1 remains a plumbing/physics-harness result and cannot advance `ReplayStatus`.

## Executable evidence

`PROBES/hrrrv4_effective_radius_liveness_probe_r22.py` ran `14/14 PASS`. It verifies the source-semantic gate: exposure alone fails liveness, mp28 alone fails liveness, disabling `use_mp_re` fails, either non-RRTMG radiation side fails, the corrected 28/4/4/1 configuration satisfies the modeled request gate, plausible initialized radii are not freshness proof, and ReplayStatus remains unchanged.

This probe does **not** execute WRF/HRRR and does not authenticate numerical atmospheric state.

## Execution limitation observed in this bounded environment

The environment has GNU Fortran 14.2.0, GNU Make 4.4.1, and netCDF-C 4.9.3, but `mpif90`, `nf-config`, and `ncdump` were not available. Current official WRF build guidance requires Fortran/C plus netCDF and, for distributed-memory execution, MPI; its compile tutorial explicitly lists netCDF-C and netCDF-Fortran and MPI/OpenMP as applicable libraries. A real locked HRRRv4/WRF L1 pair was therefore not attempted here.

## Status ledger

**Observation:** no new physical atmospheric Observation Root. Official NOAA-EMC source/config/workflow observations remain distinct engineering roots.

**Candidate:** `ProducerExecutionEligibility`, `ProducerDemandCoupling`, `CheckpointFreshnessContract`, `AuxiliaryRuntimeDependency`, and the corrected L1 source-path configuration.

**Current Best View:** stream exposure and producer liveness must both pass before `re_*` can be treated as an instrumentation checkpoint.

**Frozen:** none.

**Rejected:** field-exposed ⇒ fresh; mp28-alone ⇒ refresh; plausible/nonzero ⇒ fresh; SCM mp28+RRTMG ⇒ operational HRRR equivalence.

**Unknown:** real L1 run outcome; exact producer freshness evidence emitted by the run; numerical non-interference; I/O/runtime cost; L3 real-input result; independent source-model checkpoint; visible-band liquid/ice optical closure.

## Routing recommendation

Weather: adopt `ProducerExecutionEligibility`, explicit 28/4/4/1 L1 config, auxiliary-table identity, and checkpoint freshness status.  
Atmosphere: accept `re_*` for replay comparison only after producer-refreshed lineage is established.  
KAOPU semantic core: make producer liveness/freshness and auxiliary runtime dependencies typed provenance.  
Lighting: no physical promotion; effective radius remains upstream of spectral optical closure.

## Next bounded gate

Run the corrected locked-source L1 SCM `ControlInstrumentedPair` only when the build/runtime dependencies are available. First verify zero runtime-I/O warnings and producer-liveness/freshness, then apply the R20 two-layer comparator and measure performance/I/O separately. Do not advance ReplayStatus from L1. L3 locked HRRRv4 real-input execution remains the authentication gate.
