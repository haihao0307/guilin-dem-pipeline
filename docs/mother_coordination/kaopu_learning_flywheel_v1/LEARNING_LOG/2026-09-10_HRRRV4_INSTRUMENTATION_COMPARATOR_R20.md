# KAOPU Learning R20 — HRRRv4 instrumentation comparator contract

Date: 2026-09-10
Status: Candidate-partial. No production Mother mutation.

## Bounded question

For the R19 L1/L3 `ControlInstrumentedPair`, what exactly must be compared when the instrumented run intentionally adds `re_cloud/re_ice/re_snow`, and is the locked HRRRv4 `diffwrf` sufficient by itself to prove instrumentation non-interference?

This is the highest-value unresolved sub-question of `LQ-ATMOSPHERE-001` because R19 already identified execution as the next gate. Before paying the cost of WRF/HRRR execution, the comparison semantics must be correct; otherwise a valid paired run could be falsely rejected or an invalid run could be falsely accepted.

## Observation / engineering roots kept distinct

No new physical atmospheric Observation Root is added in R20. All new evidence concerns validation tooling and comparison semantics.

### Engineering Root A — locked NOAA-EMC HRRRv4 `diffwrf`

Locked identity:
- repository: `NOAA-EMC/HRRR`
- commit: `40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827`
- path: `sorc/hrrr_wrfarw.fd/WRFV3.9/external/io_netcdf/diffwrf.F90`
- blob: `0be8681f8b5c33181ed21a76051ca53c0f939295`

Source inspection establishes:

1. `diffwrf` iterates the variables in **file 1**, then looks up the same variable name in **file 2**.
2. Therefore, if the control file is first and the instrumented file is second, variables added only to the instrumented file are naturally outside the traversal. This is useful for a control/instrumented comparison.
3. The locked HRRRv4 copy enters numerical field comparison only for `WRF_REAL` variables.
4. For traversed real variables it checks time label, dimension count/length, WRF type and exact element inequality (`a .ne. b`), while also reporting RMS/error diagnostics when differences exist.
5. It is not a complete instrumentation manifest validator: the source does not establish equality for skipped integer/string state, full variable attributes, an exact allowlist of added fields, or every dataset-manifest property.

This means the locked `diffwrf` is valuable but has a narrower evidence ceiling than “the two NetCDF files are equivalent except for exactly three new variables.”

### Engineering Root B — current upstream WRF `diffwrf`

Inspected official source:
- repository: `wrf-model/WRF`
- commit: `06d4240ae989cc3e50af412bb472df3d9048783c`
- path: `external/io_netcdf/diffwrf.F90`
- blob: `4c72cfed7f65f2784c399eb808ae6b15044eaa50`

The inspected current upstream implementation compares both `WRF_REAL` and `WRF_INTEGER` values. That is useful evidence that the comparison utility itself evolves across source generations.

Transferable consequence: **validation-tool identity is part of evidence provenance.** A current WRF `diffwrf` may be used as a supplementary comparator, but it cannot be silently substituted for the locked HRRRv4 tool while claiming an unchanged HRRRv4 validation harness.

### Engineering Root C — official WRF bit-wise validation method

Official WRF documentation uses paired runs plus `external/io_netcdf/diffwrf` to establish bit-wise reproducibility and recommends increasing output frequency to identify the first differing variable/time when a comparison fails.

Primary sources:
- https://github.com/wrf-model/WRF/wiki/How-to-Check-Bit-wise-Identical-Results
- https://github.com/wrf-model/WRF/wiki/How-to-Check-Bit-for-Bit-Results-with-Restart-Capability

R20 inherits the paired-run/field-comparison method, not an assumption that one historical `diffwrf` executable covers every instrumentation-specific invariant.

## Core logical corrections

1. **Expected schema change != numerical interference.** Adding `re_cloud/re_ice/re_snow` must change the output file structure and therefore usually its bytes. Whole-file hash equality is the wrong invariant for an intentionally instrumented run.
2. **`diffwrf` pass != complete dataset-equivalence proof.** The locked HRRRv4 comparator has a real-field comparison scope; fields/types/metadata outside that scope need separate validation.
3. **Comparator direction is semantic.** For the locked asymmetric traversal, `control -> instrumented` is the intended order. Reversing the order asks the tool to find the new instrumented variables in the control and changes the meaning of the test.
4. **Same variable values != same variable identity.** Units, dimensions, staggering and other required metadata remain part of state/evidence identity even when values match.
5. **A newer validation tool != the locked validation tool.** Improved current WRF coverage can supplement a locked-HRRR check but does not erase source-generation provenance.
6. **File-byte identity is too strong while unscoped field equality can be too weak.** The correct invariant is an allowlisted schema delta plus equality of all pre-existing state covered by a declared comparison policy.

## Transferable methods

1. Add `ComparatorIdentity`:
   - tool repository/commit/blob/build;
   - traversal direction;
   - value types actually compared;
   - dimension/type checks;
   - time-axis behavior;
   - attribute/schema coverage;
   - result/sentinel interpretation.

2. Add `ComparatorCoverageVector` with independent axes such as:
   - `sharedRealValues`;
   - `sharedIntegerValues`;
   - `sharedDimensions`;
   - `sharedTypes`;
   - `timeLabels`;
   - `timeCount`;
   - `sharedAttributes`;
   - `exactAddedVariableSet`.

3. Add `InstrumentationManifest` declaring exactly which variables may be added by the experiment. For R17-R20 the initial allowlist is `re_cloud`, `re_ice`, `re_snow`, with expected dimensions/units/staggering supplied by the locked model state definition.

4. Use a `TwoLayerInstrumentationComparator`:
   - Layer A: locked HRRRv4 `diffwrf(control, instrumented)` for shared real-valued WRF state under the historical tool identity;
   - Layer B: a schema/metadata sidecar that verifies identical time axis, required dimensions/types/attributes for shared state, exact allowlisted added-variable set, and exact integer/string state where relevant.

5. The control file must be the first operand for the locked asymmetric `diffwrf` policy.

6. Do not use whole-file SHA equality for an intentional instrumentation delta. File hashes remain useful for artifact identity, not non-interference equality between intentionally different schemas.

7. Record value equality separately from schema equality and separately again from performance perturbation. None substitutes for another.

8. If a future comparator has broader coverage, record it as an additional comparator with its own identity; never retroactively claim the older locked comparator checked fields it did not check.

## Executable evidence

Probe:
`PROBES/hrrrv4_instrumentation_comparator_probe_r20.py`

The probe is a semantic dataset-comparison fixture; it does not run WRF or HRRR and contains no atmospheric truth values. It verifies:

1. adding the three expected fields changes a deterministic whole-dataset hash, demonstrating why whole-file identity is an invalid non-interference criterion;
2. an allowlisted asymmetric shared-state comparison passes when every pre-existing field is unchanged;
3. an unexpected added variable is rejected;
4. an integer shared-state change is detected by the sidecar policy;
5. a shared metadata/units change is detected;
6. an extra time record is detected;
7. a real-valued bit change is detected;
8. an exact bitwise policy distinguishes `+0.0` from `-0.0`, showing that “numerically close/equal” and bitwise identity are distinct policies.

Result: `8/8 PASS`.

## State ledger

### Observation

No new physical atmospheric Observation Root.

Primary engineering observations:
- the locked HRRRv4 `diffwrf` traverses file-1 variables and looks them up in file 2;
- with control first, added instrumented-only fields are outside that traversal;
- the locked HRRRv4 copy numerically compares `WRF_REAL` fields but does not provide complete instrumentation-manifest/metadata coverage;
- the inspected current upstream WRF comparator also handles `WRF_INTEGER`, demonstrating comparator-generation drift;
- official WRF uses paired-run `diffwrf` comparison for bit-wise reproducibility testing.

### Candidate

- `ComparatorIdentity`.
- `ComparatorCoverageVector`.
- `InstrumentationManifest`.
- `TwoLayerInstrumentationComparator`.
- `SharedStateInvariant`: all pre-existing state must satisfy a predeclared equality policy while only the exact allowlisted instrumentation delta may be added.
- `ArtifactIdentity` separated from `StateNonInterferenceIdentity`.

### Current Best View

The R19/R18 ControlInstrumentedPair needs a comparison contract, not a file-hash rule. For locked HRRRv4, run the historical `diffwrf` with **control first** and **instrumented second** to compare shared real-valued state, then run a versioned sidecar manifest comparator to verify the exact added-field allowlist, time support, integer/string state and required schema/metadata. A pass requires both layers plus the separately measured performance gate. This improves the validity of the upcoming L1/L3 experiment but does not itself execute WRF or advance ReplayStatus.

### Frozen

None.

### Rejected

- “Control and instrumented NetCDF files must have identical hashes.”
- “Any `diffwrf` pass proves the complete files differ only by the intended instrumentation.”
- Running the locked asymmetric comparator with unspecified operand order.
- Ignoring integer/string/metadata state because the real-valued physics arrays match.
- Using current WRF comparator behavior to claim that the locked HRRRv4 comparator historically checked the same types.
- Lowering the R18/R19 L3 evidence ceiling because a richer comparator is available.

### Unknown

- Actual L1 locked-source SCM control/instrumented output and whether runtime-I/O is numerically non-interfering on that harness.
- Exact HRRRv4 NetCDF attributes that should be mandatory in the R20 sidecar allowlist for `re_cloud/re_ice/re_snow`.
- Actual runtime/I/O performance delta for the three 3D fields.
- L3 locked HRRRv4 real-input control/instrumented equality.
- Source-model `re_*` checkpoint versus external Thompson replay numerical gap.
- Visible-band liquid/ice optical closure and dual-evaluator gates from earlier rounds.

## Ordinary-user implementation constraints

An ordinary developer cannot validate this by comparing two downloaded files with SHA256. The experiment intentionally changes the file schema, and the historical HRRR comparison utility has limited type/schema coverage. A real run still requires a compatible legacy HRRRv4/WRF Fortran-MPI-NetCDF build, paired control/instrumented executions with identical decomposition and inputs, the locked `diffwrf`, plus a second manifest/metadata comparison tool. Full-domain L3 remains computationally and operationally expensive even after the comparison semantics are corrected.

## Routing

Route as Candidate only:
- Weather Mother: attach `ComparatorIdentity`, `ComparatorCoverageVector` and `InstrumentationManifest` to paired weather-model runs.
- Atmosphere: accept exposed `re_*` only when the shared-state and instrumentation-manifest gates both pass at the applicable harness level.
- KAOPU semantic core: separate artifact identity, schema identity and state non-interference identity; make comparator provenance first-class.
- Lighting: no physical promotion; effective radius remains upstream of spectral optical closure.

No production Mother branch is modified.

## Gate result and next gate

R20 does not execute L1 or L3 and therefore does not advance `ReplayStatus`, which remains `source_callpath_authenticated`.

The next executable gate is now unambiguous:
1. run the locked-source L1 SCM control/instrumented pair;
2. compare with locked HRRRv4 `diffwrf(control, instrumented)`;
3. run the R20 manifest/schema sidecar over both outputs;
4. record runtime/I/O cost separately;
5. regardless of L1 pass, do not advance ReplayStatus;
6. use the same comparison contract at L3, where only eligible locked HRRRv4 real-input evidence may advance authentication.
