# KAOPU Learning R21 — HRRRv4 runtime-I/O instrumentation preflight

Date: 2026-09-11
Status: Candidate-partial. No production Mother mutation.

## Bounded question

Before spending compute on the R19/R20 L1 SCM `ControlInstrumentedPair`, is the exact `re_cloud/re_ice/re_snow` runtime-I/O request actually resolvable and eligible in the locked HRRR v4.1.20 source generation, and what fail-fast conditions are required so a completed run cannot be mistaken for successful instrumentation?

This remains the highest-value unresolved sub-question of `LQ-ATMOSPHERE-001`: R20 made the post-run comparator semantics precise, but the proposed paired run was still vulnerable to failing before comparison because documentation-level runtime-I/O capability had not yet been tied to the exact locked fields, package activation and parser behavior.

## Observation / engineering roots kept distinct

No new physical atmospheric Observation Root is added in R21. All new evidence concerns model-state exposure, source-generation-specific I/O behavior and validation plumbing.

### Engineering Root A — locked HRRRv4 Registry/package state

Locked identity:
- repository: `NOAA-EMC/HRRR`
- commit: `40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827`
- path: `sorc/hrrr_wrfarw.fd/WRFV3.9/Registry/Registry.EM_COMMON`
- blob: `f3e86038a161c18d2644e6276110a01fc13839f3`

The locked Registry declares:
- internal symbol `re_cloud`, DNAME `RE_CLOUD`, real `ikj`, units `m`, default I/O `r`;
- internal symbol `re_ice`, DNAME `RE_ICE`, real `ikj`, units `m`, default I/O `r`;
- internal symbol `re_snow`, DNAME `RE_SNOW`, real `ikj`, units `m`, default I/O `r`.

The same Registry package table declares `thompsonaero` for `mp_physics==28` and includes `state:re_cloud,re_ice,re_snow` in that active package.

Transferable consequence: Registry declaration and package activation are separate evidence axes. A field being globally declared is not sufficient to call it a meaningful checkpoint in a run whose relevant package is inactive.

### Engineering Root B — locked HRRRv4 runtime-I/O parser

Locked identity:
- repository: `NOAA-EMC/HRRR`
- commit: `40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827`
- path: `sorc/hrrr_wrfarw.fd/WRFV3.9/frame/module_domain.F`
- blob: `9ca0c7ea385d3038323f1386403ecfa325581ab3`

Source inspection establishes:
1. requested field tokens are passed through `change_to_lower_case(...,lookee)`;
2. state-variable `DataName` is also lower-case normalized before matching;
3. a matching `+` operation calls `set_mask` for the selected stream when not already set;
4. a missing variable sets warning state and emits an inability-to-modify-mask warning;
5. the implementation hard-codes `max_hst_mods=200`, with a fatal error when exceeded.

Thus the exact three Registry DNAMEs are parser-resolvable in this locked source generation and a resolved request can move a restart-only default state onto a history stream without editing the Registry itself.

### Engineering Root C — locked HRRRv4 runtime-I/O documentation

Locked identity:
- repository: `NOAA-EMC/HRRR`
- commit: `40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827`
- path: `sorc/hrrr_wrfarw.fd/WRFV3.9/README.io_config`
- blob: `cf3b213b3b3b2996c28c262f2f33dca95bfc336b`

The document states that runtime I/O can add or exclude existing state variables from history/input streams without recompiling; stream 0 is the main history/input stream; a runtime-I/O line may not exceed 256 characters; and `ignore_iofields_warning` defaults to `.TRUE.`, which warns but continues, while `.FALSE.` aborts on errors.

Current official WRF documentation independently corroborates the architecture: runtime-I/O names are the Registry quoted names, fields must already be Registry state, stream 0 is standard history, and `.false.` changes malformed/unresolved requests from warning-and-continue to abort.

### Engineering Root D — locked HRRRv4 SCM baseline

Locked identity:
- path: `sorc/hrrr_wrfarw.fd/WRFV3.9/test/em_scm_xy/namelist.input`
- blob: `50571a305625bdf5ddecb91c7493a8acb5eb3dd9`

The shipped SCM is a 3x3 periodic single-domain harness and its baseline namelist uses `mp_physics=2`, not 28. R19 already established its evidence ceiling. R21 adds the practical implication: an L1 Thompson-aerosol instrumentation test must explicitly activate `mp_physics=28`; merely adding the output manifest to the shipped default SCM would not exercise the intended package state.

## Core logical corrections

1. **Documented runtime-I/O capability != exact-field eligibility.** The exact locked Registry, package and parser must resolve the intended fields. R21 now establishes that source-level eligibility for the three effective-radius fields.
2. **Successful process exit != successful instrumentation.** The default `ignore_iofields_warning=.true.` can allow a malformed or missing request to warn and continue. An authentication-oriented run must fail fast with `.false.` and preserve the log.
3. **Registry field exists != field is semantically active.** Package activation matters. The intended checkpoint belongs to the `thompsonaero` path selected by `mp_physics=28`.
4. **Internal symbol == runtime-I/O identity is not a safe general rule.** WRF runtime I/O is keyed by the quoted Registry DNAME. For these fields the symbol and DNAME differ only in case, but KAOPU should preserve both identities explicitly.
5. **Case-insensitive matching here != portable cross-version guarantee.** The locked parser normalizes case, but other source generations/tools need their own source lock.
6. **Source eligibility != numerical non-interference.** Parser/Registry proof does not replace the R18/R20 control/instrumented comparison.
7. **SCM package activation != HRRR equivalence.** Setting the L1 harness to mp=28 is necessary to exercise the state path, but the R19 EvidenceCeiling remains unchanged.

## Transferable methods

Introduce `FieldExposureEligibility` with separately auditable axes:
- `declaredStateVariable`;
- `activePackageMember`;
- `runtimeParserResolvable`;
- `streamMaskMutable`;
- `failFastConfigured`.

Introduce `InstrumentationPreflightContract` binding:
- source commit/build identity;
- Registry path/blob;
- runtime parser path/blob;
- harness identity;
- physics/package activation;
- internal symbol ↔ Registry DNAME mapping;
- expected units/dimensions;
- stream type and stream ID;
- exact added-variable manifest;
- warning/fail-fast policy;
- syntax and modification-count limits;
- evidence ceiling.

Introduce `InstrumentationOutcomeClass`:
- `configured_and_resolved`;
- `configured_but_warned`;
- `configured_but_semantically_inactive`;
- `execution_failed`;
- `not_executed`.

Only `configured_and_resolved` is eligible to proceed to the R20 non-interference comparator. This does not itself make the exposed state physically correct or operationally authenticated.

For the first L1 attempt, use the canonical Registry DNAME manifest:

`+:h:0:RE_CLOUD,RE_ICE,RE_SNOW`

and set `ignore_iofields_warning=.false.`. Preserve the exact iofields text, namelist, run log, source/build identity and output schema in provenance.

## Executable evidence

Probe:
`PROBES/hrrrv4_runtime_io_preflight_probe_r21.py`

SHA256:
`aa27206d164b75884f01c8bf276cc2fdad62a154dad1aafe431303cd60ee948d`

The probe is source/semantic evidence derived from the locked official Registry, parser and README excerpts. It does not execute WRF or HRRR and contains no atmospheric truth values. It verifies:
1. all three Registry state definitions and DNAME/unit/default-I/O identity;
2. `thompsonaero` package membership under `mp_physics==28`;
3. parser case normalization of request and DataName;
4. `+` stream-mask mutation;
5. missing-variable warning behavior;
6. the locked 200-modification hard bound;
7. the requirement to override warning-and-continue for validation;
8. the exact three-field line is within the 256-character syntax bound;
9. exact DNAME resolution after normalization;
10. a synthetic absent field is rejected by preflight;
11. the evidence ceiling remains source-level eligibility only.

Result: `13/13 PASS`.

## State ledger

### Observation

No new physical atmospheric Observation Root.

Primary engineering observations:
- locked HRRRv4 Registry declares the three effective-radius state fields as restart-only by default and associates them with `thompsonaero` for mp=28;
- locked parser resolves Registry DataName after lower-case normalization and can set a requested history-stream mask;
- missing fields can warn and continue under the default warning policy;
- locked runtime-I/O limits include 256 characters per line and a 200-modification parser bound;
- shipped SCM baseline uses mp=2.

### Candidate

- `FieldExposureEligibility`.
- `InstrumentationPreflightContract`.
- `InstrumentationOutcomeClass`.
- canonical instrumentation identity using both internal symbol and Registry DNAME.
- fail-fast validation rule: `ignore_iofields_warning=.false.` for evidence-bearing paired runs.

### Current Best View

The exact three-field history instrumentation request is source-eligible in locked HRRR v4.1.20 when the `thompsonaero` package is active. Use the locked DNAME manifest `+:h:0:RE_CLOUD,RE_ICE,RE_SNOW`, require fail-fast runtime-I/O error handling, and preserve parser/Registry/build/harness identity. This closes a source-level preflight gap before L1 but does not establish numerical non-interference or operational HRRR replay authentication.

### Frozen

None.

### Rejected

- “Runtime I/O exists, therefore these exact three fields will definitely be output.”
- “The run finished, therefore the requested instrumentation resolved.”
- “A Registry declaration alone proves the field is active and meaningful in the current physics package.”
- “The internal Fortran symbol is always the portable runtime-I/O field name.”
- “The locked parser is case-insensitive, therefore every WRF/HRRR version can be assumed case-insensitive.”
- “A source-level preflight PASS establishes control/instrumented non-interference.”
- “Changing SCM to mp=28 makes the SCM an HRRR-equivalent harness.”

### Unknown

- Whether the locked-source L1 SCM control/instrumented pair actually runs successfully with mp=28 under an available compatible build.
- Whether all pre-existing L1 fields remain bit-wise equal after instrumentation.
- Exact runtime/I/O performance delta from exposing the three 3D fields.
- Whether the L1 SCM requires additional aerosol/profile initialization choices to reach a useful Thompson-aerosol physics path; these choices remain below the L3 evidence ceiling regardless.
- L3 locked HRRRv4 real-input control/instrumented equality.
- Source-model `re_*` checkpoint versus external source-locked Thompson replay numerical gap.
- Visible-band liquid/ice optical closure and downstream dual-evaluator validation.

## Ordinary-user implementation constraints

This still cannot be turned into a trustworthy HRRR validation by editing one text line on an ordinary laptop. The next real step needs a compatible legacy HRRRv4/WRF Fortran-MPI-NetCDF build, a working SCM executable and its runtime dependencies, a deliberately configured mp=28 experiment rather than the shipped mp=2 baseline, two otherwise identical executions, locked `diffwrf`, the R20 schema/metadata sidecar, retained logs, and independent runtime/I/O measurement. A successful L1 remains only a low-cost plumbing result; full L3 operationally representative execution is much more computationally and operationally demanding.

## Routing

Route as Candidate only:
- Weather Mother: require `InstrumentationPreflightContract`, canonical DNAME manifest and fail-fast warning policy before any paired weather-model instrumentation run.
- Atmosphere: treat `re_*` as eligible source-model diagnostic state only after package activation and runtime resolution are proven; do not accept warned/unresolved output as a checkpoint.
- KAOPU semantic core: make field-exposure eligibility and instrumentation outcome typed provenance rather than a run-success Boolean.
- Lighting: no physical promotion; effective radius remains upstream of spectral optical closure.

No production Mother branch is modified.

## Gate result and next gate

R21 closes the source-level eligibility/preflight question and records a meaningful new fail-fast constraint. It does not run L1/L3 and therefore does not advance `ReplayStatus`, which remains `source_callpath_authenticated`.

Next, if a compatible locked-source execution environment is available:
1. create an L1 SCM control with the chosen mp=28 harness configuration;
2. create an otherwise identical instrumented run with `iofields_filename`, `ignore_iofields_warning=.false.` and exactly `+:h:0:RE_CLOUD,RE_ICE,RE_SNOW`;
3. require zero runtime-I/O resolution warnings and exact expected added-variable schema;
4. apply locked `diffwrf(control,instrumented)` plus the R20 schema/metadata sidecar;
5. measure runtime and output-I/O cost separately;
6. do not advance ReplayStatus from L1 regardless of PASS;
7. reserve replay-authentication advancement for an eligible L3 locked HRRRv4 real-input pair and independent source-model checkpoint comparison.
