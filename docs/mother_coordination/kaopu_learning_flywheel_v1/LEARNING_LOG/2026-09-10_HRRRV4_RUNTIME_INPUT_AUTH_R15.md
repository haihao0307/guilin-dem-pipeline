# KAOPU Learning R15 — HRRRv4 source-callpath authentication and real-input checkpoint boundary

Date: 2026-09-10
Status: Candidate-partial. No production Mother mutation.

## Bounded question

Can the HRRR v4.1.20 Thompson replay branch be authenticated more precisely from the locked operational source/configuration, and what exact input-adapter/checkpoint contract is required before a public HRRR native product can support a defensible numerical replay claim?

This is the highest-value unresolved sub-question of `LQ-ATMOSPHERE-001`. R14 source-locked `calc_effectRad`, but left the aerosol-aware branch and operational numerical checkpoint open.

## Observation Roots

No new physical atmospheric Observation Root is added in R15. All new evidence is engineering/product-schema evidence and is therefore kept distinct from Weather Observation truth.

### Engineering Root A — NOAA-EMC HRRR v4.1.20 source/configuration

Locked HRRR commit: `40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827`.

The CONUS namelist uses `mp_physics=28`. The HRRR Registry maps `mp_physics==28` to `thompsonaero`. The `THOMPSONAERO` driver path requires `QNWFA_CURR`, `QNIFA_CURR`, and `QNWFA2D`, then passes `NWFA`, `NIFA`, and `NWFA2D` to `mp_gt_driver`. In the locked Thompson module, `is_aerosol_aware` is set true when all three arguments are present.

Therefore the **locked source/configuration call path** is now authenticated as aerosol-aware. This is stronger than the R14 statement based on `mp_physics=28` alone, but it is still not a cycle-specific executable trace or binary provenance claim.

### Engineering Root B — NOAA/NCO public HRRR native product inventory

The official native-analysis inventory publishes the input categories required by `calc_effectRad`: `PRES`, `TMP`, `SPFH`, `CLWMR`, `NCONCD`, `CIMIXR`, `NCCICE`, and `SNMR` on hybrid levels. It also publishes `MASSDEN`.

However, the inspected public native inventory contains no `Effective Radius`, `EFRCWAT`, `EFRCICE`, or `EFRSNOW` output. Thus it can provide real replay inputs but does not provide an independent expected effective-radius result for the same packet.

### Engineering Root C — NCEP GRIB2 parameter semantics

The official NCEP GRIB2 moisture table defines `EFRCWAT`, `EFRCICE`, and `EFRSNOW`. Therefore absence of those quantities from the inspected HRRR native inventory is a product-publication choice, not a limitation of GRIB2 as a format.

## Logical corrections

1. `mp_physics=28` by itself is insufficient proof of the aerosol-aware branch. The complete source/configuration call chain is needed. R15 now supplies that chain at source level.
2. Running the locked replay on real HRRR inputs does **not** by itself create an independent numerical checkpoint. A replay compared only with itself proves deterministic execution/self-consistency, not operational numerical equivalence.
3. `SPFH` and Thompson `qv1d` both use `kg/kg`, but they are not the same typed quantity. The public product labels `SPFH` as specific humidity, whereas the Thompson driver documents `Qv` as water-vapor mixing ratio. The adapter must explicitly compute `r=q/(1-q)`.
4. A same-unit type mistake can be numerically masked. In the ordinary cloud-liquid effective-radius branch, density multiplies both cloud-water mass concentration and drop-number concentration, so part of the density error cancels in their ratio away from floors/clamps. Numerical agreement there is not evidence that the input semantics were correct.
5. Public `MASSDEN` may be used as an independent diagnostic/cross-check, but silently substituting it for the source routine's internally reconstructed density would no longer be a source-identical replay unless equivalence is separately demonstrated.
6. GRIB2 being able to encode effective radius does not mean HRRR's public native product publishes that field.
7. `source_callpath_authenticated` must not be collapsed into `runtime_authenticated`.

## Transferable methods

Introduce a `ReplayAuthenticationLadder`:

`source_locked -> source_callpath_authenticated -> real_input_executed -> independent_checkpoint_matched -> runtime_authenticated`.

Each transition needs its own evidence. Later states may not be inferred from earlier states.

Introduce a typed `ReplayInputAdapter` that records source parameter name, source physical quantity type, units, target routine argument type, transform, vertical support, time/cycle, grid support, missing-value policy, and transform error/provenance.

For the current HRRR Thompson bridge:
- `PRES -> p1d` directly after unit/support validation;
- `TMP -> t1d` directly after unit/support validation;
- `SPFH specific humidity -> qv1d mixing ratio` through `q/(1-q)`;
- `CLWMR -> qc1d`;
- `NCONCD -> nc1d`;
- `CIMIXR -> qi1d`;
- `NCCICE -> ni1d`;
- `SNMR -> qs1d`.

`MASSDEN` is a cross-check quantity, not a replacement input for source-identical replay.

Define `IndependentNumericalCheckpoint` as an expected output that does not originate from the same replay implementation being evaluated. Acceptable future routes include an official HRRR/WRF output carrying the corresponding effective-radius diagnostics, a locked operational executable rerun with captured output, or another independently generated official checkpoint with matching model/configuration/support identity.

## Executable evidence

Probe: `PROBES/hrrrv4_runtime_input_auth_probe_r15.py`.

Result: `8/8 PASS`.

The probe verifies:
1. `mp_physics=28` plus Registry mapping selects `THOMPSONAERO`.
2. The source call path passes all aerosol arguments required by the Thompson presence test, so the source/configuration branch is aerosol-aware.
3. The official public native schema contains all field categories required to drive `calc_effectRad` after typed humidity adaptation.
4. Specific humidity -> mixing ratio -> specific humidity round-trips correctly.
5. A specific-humidity/mixing-ratio type error can be numerically masked in a synthetic cloud-liquid effective-radius case even while reconstructed density differs.
6. `MASSDEN` is not part of the locked `calc_effectRad` signature and is therefore a cross-check, not a source-identical replacement input.
7. GRIB2 defines effective-radius parameters while the inspected HRRR public native inventory publishes none of them.
8. The authentication ladder refuses `runtime_authenticated` while real input execution and an independent checkpoint remain missing.

All atmospheric numbers in this probe are synthetic test values. No observed HRRR gridpoint value is promoted.

## State ledger

### Observation
- No new physical atmospheric Observation Root is added.

### Candidate
- `ReplayAuthenticationLadder`.
- `ReplayStatus.source_callpath_authenticated` for the locked HRRR v4.1.20 THOMPSONAERO path.
- `ReplayInputAdapter` with typed quantity conversion and support lineage.
- `IndependentNumericalCheckpoint` as a distinct evidence object.
- Public HRRR native input schema as sufficient in field categories for a future `calc_effectRad` replay, subject to real byte/value acquisition and support validation.

### Current Best View
The HRRR v4.1.20 Thompson effective-radius replay is now stronger than R14: its source/configuration path can be identified as aerosol-aware. Public native HRRR provides the required microphysical/thermodynamic input categories, but public native output does not expose an independent effective-radius checkpoint. Therefore the correct current state is `source_callpath_authenticated`, not `runtime_authenticated`. Real-input execution is the next useful step, but even that alone will not close numerical authentication without an independent expected output.

### Frozen
None.

### Rejected
- `mp_physics=28` alone proves the branch.
- Real HRRR input + our own replay output is an independent operational checkpoint.
- Same unit string means `SPFH` may be passed directly as Thompson `Qv` without a quantity-type transform.
- `MASSDEN` may silently replace the routine's internal density reconstruction while still claiming source-identical replay.
- Missing effective-radius fields mean GRIB2 cannot represent effective radius.
- Source/configuration call-path authentication equals cycle-specific runtime authentication.

### Unknown
- Actual values from a materialized, fixed official HRRR native GRIB subset were not decoded in this bounded runtime.
- Cycle-specific binary/executable provenance and runtime trace remain unavailable.
- An independent operational `re_cloud/re_ice/re_snow` numerical checkpoint for a matched public packet has not been found.
- Whether an official HRRR history/restart/UPP route can expose effective-radius diagnostics with matching cycle/configuration identity remains to be tested.
- R13 visible-band liquid and ice spectral optical closures remain open.
- R11 local disaggregation error, dual evaluator validation, NRLMSIS/HITRAN physical-reference gate and geodetic gates remain open.

## Constraints for an ordinary implementation

A normal application cannot currently treat this as a quick browser-side hookup. Native HRRR files are hundreds of megabytes per file; a practical workflow needs GRIB subsetting/byte-range extraction or a server-side reduction step. The public native product exposes the replay inputs but not the independent effective-radius expected output, so operational numerical validation requires additional tooling or a controlled model rerun. Exact quantity-type conversion and model-level support metadata must survive extraction. Even after effective-radius replay is authenticated, visible-light extinction/scattering and 3-km-to-local cloud structure are separate unsolved gates.

## Routing

Route as Candidate only:
- Weather Mother: adopt `ReplayInputAdapter`, authentication ladder, typed `SPFH -> qv` transform, and keep real-input execution distinct from runtime authentication.
- Atmosphere: accept source-model effective radius only with replay-status/provenance; spectral optical closure remains separate.
- Lighting: no promotion; continue to consume only renderer-neutral spectral optical coefficients, not raw HRRR microphysics/effective radius.
- KAOPU semantic core: make same-unit/different-quantity typing and independent-checkpoint evidence first-class.
- Noise/Field: remain downstream of support/disaggregation and cannot increase replay authentication status.

No production Mother branch is modified.

## Gate result and next gate

R15 closes the **source call-path branch ambiguity** from R14 and defines the exact typed input adapter. It does not close `runtime_authenticated`.

Next bounded Weather gate: materialize one tiny official HRRR native subset for a fixed cycle/gridpoint or small window; preserve GRIB record identity, hybrid level, cycle/time and field metadata; execute the source-locked liquid/ice/snow replay on actual values. In parallel, seek an independent official effective-radius checkpoint or create a reproducible exact-HRRR executable checkpoint. Do not promote to `runtime_authenticated` until both real-input execution and independent checkpoint matching exist.
