# KAOPU bounded learning cycle — R24 HRRRv4 aerosol state-source identity

Date: 2026-09-11
Learning question: `LQ-ATMOSPHERE-001`
Status: Candidate partial; no Frozen change; no production Mother mutation.

## Why this question was selected

The coordinator still ranks `LQ-ATMOSPHERE-001` first under explicit user priority. R23 left the Weather-coupling gate blocked on the first real L1 execution. Before paying that execution cost, the highest-value unresolved subquestion was whether the L1 SCM really needs operational aerosol IC/BC simply to exercise the locked ThompsonAero producer path, or whether a lower-dependency source-supported state route exists without corrupting the evidence ceiling.

## Logical errors rejected before implementation

1. **Same implementation ⇒ same state.** False. The same ThompsonAero source can consume operational aerosol IC/BC, climatology, carried state, or source-generated fallback profiles. Implementation identity and state-source identity are independent.
2. **No external aerosol IC/BC ⇒ aerosol-aware Thompson cannot execute.** False at the locked-source semantic level. `thompson_init` sets aerosol awareness from presence of NWFA2D/NWFA/NIFA and explicitly fills basic profiles when NWFA/NIFA are absent/nearly zero.
3. **Fallback profile ⇒ operationally representative aerosol state.** False. Locked HRRR CONUS explicitly enables external aerosol IC/BC; the fallback profile is a software/physics-harness state source, not an operational HRRR state surrogate.
4. **A successful fallback L1 numerical match ⇒ HRRR runtime authentication.** False. Such a run can validate the code path and instrumentation plumbing only. Operational numerical authentication still requires a state-source-aligned L3 real-input pair.

## Primary evidence kept as distinct roots

### Root A — locked NOAA-EMC Thompson source
`NOAA-EMC/HRRR@40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827`, `module_mp_thompson.F`, blob `1e6cdb1e718473ee1a031e16b1c00c96113f19f8`.

Transferable facts: `is_aerosol_aware` depends on presence of NWFA2D/NWFA/NIFA; `thompson_init` checks existing aerosol fields and constructs basic vertical profiles when they are below the source epsilon. This is model-source behavior, not physical observation.

### Root B — locked NOAA-EMC physics initialization
Same commit, `module_physics_init.F`, blob `2a6dac7d3c0c2b9c87ff3a2dfdbcf9e635aa6e6d`.

Transferable fact: the THOMPSONAERO initialization call supplies NWFA2D/NWFA/NIFA arrays to `thompson_init`; array presence does not encode where their values came from.

### Root C — locked shipped SCM
`test/em_scm_xy/README.scm` blob `f1c6ffd1bb755c64e6a30b2616d17e7f18afe4ce`; `namelist.input` blob `50571a305625bdf5ddecb91c7493a8acb5eb3dd9`.

Transferable facts: SCM is a 3x3 periodic harness with no horizontal gradients unless forced. Its documented sounding input is meteorological (`z,u,v,theta,qv`) rather than an operational aerosol-IC/BC product. Baseline physics is 2/1/1 and must still be explicitly changed to the R22 target path.

### Root D — locked operational HRRR CONUS configuration
`parm/conus/hrrr_wrf.nl`, blob `7b9b8ccb34d00bf03558e6abb4915202b1e50860`.

Transferable fact: operational CONUS uses mp=28, RRTMG 4/4 and explicitly enables `use_aero_icbc` plus `use_rap_aero_icbc`. This is a different state-source identity from internal fallback.

### Root E — current official UCAR/NCAR WRF documentation
`https://www2.mmm.ucar.edu/wrf/site/documentation/thompson_aerosol-aware.html` retrieved 2026-09-11.

Transferable fact: for WRFV3.9+ the documented `use_aero_icbc=false` route assumes vertical CCN/IN profiles; external climatological aerosol IC/BC is optional rather than a prerequisite for the aerosol-aware scheme.

The roots above are engineering/model evidence. They are not counted as independent physical Observation Roots merely because several files/document pages agree.

## Executable evidence

`PROBES/hrrrv4_aerosol_state_source_probe_r24.py` executed locally and returned `12/12 PASS`; SHA256 `189dc02a968ee235b77318006777139c1e59491239e9ab0244d128939b0353b0`.

The probe checks source-semantic contracts only: target producer request gate, aerosol-aware array presence, fallback versus external state-source classification, retained CCN-table dependency, Evidence Ceiling, and prohibition on ReplayStatus promotion. It is not a WRF/HRRR model run and produces no atmospheric truth observation.

## Distilled transferable method

Introduce `AerosolStateSourceIdentity` as an instance of a more general `StateSourceIdentity` contract. For any mature-system internal field, preserve separately:
- producer implementation/version;
- state-source class and artifact/version;
- initialization epoch;
- boundary/update policy;
- fallback/default constants;
- whether the current experiment matches the production state source.

Also split `HarnessEquivalenceVector` into at least `AlgorithmPathEquivalence` and `StateSourceEquivalence`. A low-cost harness may deliberately match only the algorithm path when that is sufficient for the question being tested, but its Evidence Ceiling must say so.

This transfers beyond Weather: Houdini attributes, Substance graph inputs, Blender caches, Unreal render resources and procedural Object-DNA intermediate fields can all be generated by the same operator while inheriting materially different source-state provenance.

## Constraints for ordinary developers

The fallback route removes the need to prepare a WPS aerosol climatology merely for L1 plumbing, but it does not make HRRR reproduction easy. A real L1 still needs a compatible legacy WRF/HRRR build, Fortran plus netCDF-Fortran and normally MPI tooling, RRTMG/runtime tables, `CCN_ACTIVATE.BIN`, corrected 28/4/4/1 configuration, fail-fast runtime-I/O, post-producer sampling and paired control/instrumented comparison. In the bounded execution environment used this cycle, GNU Fortran and netCDF-C were present but `mpif90`, `nf-config` and `ncdump` were not available; an attempted dependency installation did not complete within the bounded cycle. Therefore no model pair was claimed.

## Status ledger

- **Observation:** no new physical atmospheric Observation Root.
- **Candidate:** `AerosolStateSourceIdentity`, `AlgorithmPathEquivalence`, `StateSourceEquivalence`, fallback-aerosol L1 harness and explicit Evidence Ceiling.
- **Current Best View:** use the lowest-dependency state source sufficient for a validation question, but preserve its identity and never promote code-path agreement into production-state equivalence.
- **Frozen:** none.
- **Rejected:** same code path implies same state; external aerosol IC/BC is mandatory just to enter ThompsonAero; fallback profile is operationally representative; fallback L1 can authenticate HRRR runtime.
- **Unknown:** actual locked SCM 28/4/4/1 execution, realized fallback NWFA/NIFA fields, L1 non-interference/performance, L3 operational state-source pair, external replay numerical gap.

## Routing / next gate

For L1 only, permit a **fallback-aerosol SCM preflight**: explicit mp=28 / RRTMG 4/4 / use_mp_re=1, `use_aero_icbc=false` (or equivalently no external aerosol state, provided the actual source run proves fallback initialization), locked `CCN_ACTIVATE.BIN`, R21 fail-fast `RE_CLOUD/RE_ICE/RE_SNOW` manifest, and R23 post-producer sampling. Classify it `algorithm-path-only`; then run the R20 comparator and performance measurement. Do not advance ReplayStatus even if it passes.

For L3, restore the locked operational aerosol state-source identity (`use_aero_icbc=true`, HRRR/RAP aerosol lineage) and require the temporally eligible source-model checkpoint to match the external source-locked Thompson replay before any runtime-authentication promotion.
