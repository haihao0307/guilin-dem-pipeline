# KAOPU Learning R16 — HRRRv4 checkpoint independence versus semantic equivalence

Date: 2026-09-10
Status: Candidate-partial. No production Mother mutation.

## Bounded question

What kind of effective-radius result can legitimately serve as the independent numerical checkpoint required by the R15 `ReplayAuthenticationLadder`, and can the locked HRRRv4 source/post stack supply a useful route without falsely treating any independent computation as the same quantity?

This remains the highest-value unresolved sub-question of `LQ-ATMOSPHERE-001`. R15 correctly required an independent checkpoint, but `independent` alone is insufficient: a separately implemented diagnostic may target a different definition, support, branch, or downstream radiative-transfer approximation.

## Observation roots

No new physical atmospheric Observation Root is added in R16. All new evidence is official engineering/source/product evidence and remains separate from Weather truth.

### Engineering Root A — locked NOAA-EMC HRRRv4 Thompson source

Locked HRRR commit: `40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827`.

`module_mp_thompson.F` blob `1e6cdb1e718473ee1a031e16b1c00c96113f19f8` defines:

`calc_effectRad(t1d,p1d,qv1d,qc1d,nc1d,qi1d,ni1d,qs1d -> re_qc1d,re_qi1d,re_qs1d)`.

This remains the source-model diagnostic that the current replay is trying to reproduce.

### Engineering Root B — locked HRRR postprocessor has a separate EFFR implementation

The same HRRR operational source snapshot contains `sorc/hrrr_wrfpost.fd/CALRAD_WCLOUD_newcrtm.f`, blob `ae63de2b906d5cba475b1140181ddcdb8155e0f6`. Its history explicitly says a `FUNCTION EFFR` was added to compute effective particle radii for CRTM. Its signature is:

`EFFR(pmid,t,q,qqw,qqi,qqr,f_rimef,nlice,nrain,qqs,qqg,qqnr,qqni,mp_opt,species)`.

This is genuinely a separate implementation path from Thompson `calc_effectRad`; however, the input signature and branch controls are materially different. Therefore it is a useful **differential comparator candidate**, not automatically a semantically equivalent expected value.

### Engineering Root C — model-state routing exists, but file emission is not yet proven for CONUS ARW

The locked HRRR ARW source passes `grid%re_cloud`, `grid%re_ice`, and `grid%re_snow` through the physics/radiation path. The repository also contains a NEMS post-reader path that explicitly requests `re_cloud` on mid layers, and the NMM Registry describes `re_cloud/re_ice/re_snow` as effective radii in metres.

This is important but must be bounded: the NMM Registry/NEMS reader cannot prove that the operational HRRR CONUS ARW history/restart product actually emits those fields. `variable exists in source` is not equivalent to `field exists in the runtime file`.

### Engineering Root D — current NOAA-EMC UPP / RRFS carries Thompson effective radii explicitly

Current UPP defines `EFFRL`, `EFFRI`, and `EFFRS` as Thompson cloud-water, cloud-ice and snow effective radius arrays for RRFS. Its NetCDF reader reads `cleffr/cieffr/cseffr`, and the UPP unified-variable table documents those fields.

This is not HRRRv4 evidence and cannot authenticate HRRRv4 numerically. It is transferable mature-system evidence for a better interface pattern: emit a source-model diagnostic with provenance at the producer boundary when downstream systems need to validate or consume it, rather than forcing every downstream consumer to recreate it.

### Engineering Root E — current official HRRR product availability

NOAA NOMADS currently lists the 2026-09-10 00Z CONUS native analysis `hrrr.t00z.wrfnatf00.grib2` at 667 MB with a 59 KB index. The bounded environment could confirm current official availability, but could not materialize/decode the GRIB bytes. Therefore R16 does not claim actual HRRR gridpoint values and does not advance to `real_input_executed`.

## Core logical correction

Two checkpoint properties are orthogonal:

1. **Producer independence** — the expected result was not produced by the implementation being evaluated.
2. **Semantic equivalence** — the expected result is demonstrably the same physical/diagnostic quantity under matching model/configuration, algorithm definition, cycle/time, grid/vertical support, units/reference and validity rules.

A self replay can be semantically close but non-independent. A separate postprocessor can be independent but semantically non-equivalent or still Unknown. Neither is sufficient by itself.

The fallacy to reject is: `independent number -> independent checkpoint for the same quantity`.

## Transferable methods

1. Refine `IndependentNumericalCheckpoint` into a `CheckpointValidityVector` containing at least:
   - producer independence;
   - diagnostic/quantity semantic identity;
   - source model + configuration identity;
   - derivation/algorithm identity or proven equivalence relation;
   - cycle/valid time;
   - horizontal and vertical support;
   - units/reference and missing-value semantics;
   - provenance of the expected bytes/value.
2. Separate comparator classes:
   - `SelfConsistencyReplay`: same replay implementation; useful for deterministic execution only.
   - `DifferentialComparator`: separately implemented calculation such as HRRR post `EFFR`; useful for discrepancy detection, but authentication requires an explicit equivalence proof.
   - `SourceModelStateCheckpoint`: diagnostic emitted by the exact locked model runtime/history/restart; strongest candidate when independently produced and support identity is locked.
   - `CrossGenerationReference`: e.g. RRFS/modern UPP `cleffr/cieffr/cseffr`; useful for interface/migration learning but not HRRRv4 authentication.
3. Require both independence **and** equivalence before setting `independent_checkpoint_matched=true`.
4. Treat same name and units as insufficient. The derivation identity and support must also match.
5. Prefer carrying producer-native diagnostics through an explicit output contract when the producer already computes them. Recomputing downstream creates an avoidable semantic-equivalence burden.
6. If only a differential comparator is available, use it to localize disagreements by hydrometeor/species, branch, vertical level and input transform; do not use agreement alone to silently promote runtime authenticity.
7. Keep current product accessibility separate from execution. A file listed by NOMADS is not `real_input_executed` until bytes are decoded and the selected record identities are preserved.

## Executable evidence

Probe: `PROBES/hrrrv4_checkpoint_equivalence_probe_r16.py`.

Result: `8/8 PASS`.

It verifies the evidence-state logic:
1. self replay is rejected as an independent checkpoint;
2. HRRR post `EFFR` is rejected for authentication while semantic equivalence remains Unknown;
3. the locked Thompson and postprocessor input signatures are materially different;
4. a hypothetical independently emitted exact-runtime source-model-state checkpoint becomes eligible only when semantic equivalence and support identity are proven;
5. same variable name/unit without derivation equivalence remains insufficient;
6. RRFS effective-radius fields cannot authenticate HRRRv4 because model/lifecycle support identity differs;
7. a field absent from the inspected public HRRR native product cannot serve as a checkpoint;
8. replay status remains `source_callpath_authenticated` while actual input execution and an eligible independent checkpoint are missing.

The probe contains no atmospheric Observation values and invents no HRRR gridpoint data.

## State ledger

### Observation
- No new physical atmospheric Observation Root is added.

### Candidate
- `CheckpointValidityVector`.
- `ComparatorClass.SelfConsistencyReplay`.
- `ComparatorClass.DifferentialComparator` for locked HRRR post `EFFR`, with semantic equivalence still Unknown.
- `ComparatorClass.SourceModelStateCheckpoint` as the preferred future authentication route when exact-runtime emission is proven.
- `ComparatorClass.CrossGenerationReference` for RRFS/modern UPP effective-radius fields.
- Producer-native diagnostic carry-through as a preferred interface pattern.

### Current Best View
R15's requirement for an independent effective-radius checkpoint is necessary but not sufficient. The expected value must also be semantically the same diagnostic under matching model/configuration/support identity. The locked HRRR postprocessor provides a valuable independent `EFFR` implementation, but its different input signature means it should first be used as a differential comparator. The strongest checkpoint route remains an effective-radius state emitted by the exact locked HRRR runtime/history/restart, if such emission can be proven and retrieved. Current UPP/RRFS demonstrates that explicit producer-diagnostic carry-through is a mature pattern, but it is a different model generation and cannot authenticate HRRRv4.

Replay state therefore remains `source_callpath_authenticated`; R16 does not claim `real_input_executed`, `independent_checkpoint_matched`, or `runtime_authenticated`.

### Frozen
None.

### Rejected
- Any independently computed radius automatically qualifies as the same-quantity checkpoint.
- Agreement between the HRRR post `EFFR` function and Thompson replay would by itself prove operational Thompson equivalence.
- `re_cloud` appearing in repository source proves the HRRR CONUS ARW operational file contains it.
- NMM Registry/NEMS reader evidence can be silently generalized to CONUS ARW output.
- Current RRFS `cleffr/cieffr/cseffr` values can authenticate HRRRv4 because both are Thompson-family diagnostics.
- Same field name and metre/micron unit conversion is sufficient checkpoint identity.
- A current NOMADS file listing is equivalent to decoded real-input execution.

### Unknown
- Whether an exact HRRRv4 CONUS ARW history/restart/NEMSIO artifact containing `re_cloud/re_ice/re_snow` is accessible for a fixed cycle.
- Whether the HRRR post `EFFR` branch for the matched HRRRv4 configuration is mathematically/diagnostically equivalent to Thompson `calc_effectRad` for any or all species.
- Actual decoded values from a fixed current or archived native HRRR packet remain unavailable in this bounded execution environment.
- A matched independent numerical source-model effective-radius checkpoint has not yet been acquired.
- The later visible-band liquid/ice optical closure, local disaggregation, dual evaluator and NRLMSIS/HITRAN gates remain open.

## Constraints for ordinary implementation

A normal developer cannot quickly close this by downloading one public GRIB file. The current native analysis is hundreds of megabytes; practical extraction needs GRIB indexing/subsetting plus a decoder such as ecCodes/wgrib2 or a server-side reduction service. More importantly, the public native product does not expose the desired effective-radius expected output. Reproducing the model/post stack requires old Fortran/NEMSIO/WRF/CRTM tooling and exact configuration knowledge. Modern RRFS/UPP has cleaner explicit effective-radius plumbing, but substituting it changes the source-model identity rather than validating HRRRv4.

## Routing

Route as Candidate only:
- Weather Mother: add `CheckpointValidityVector`; keep self-consistency, differential comparison and source-runtime checkpoints distinct.
- Atmosphere: accept effective-radius diagnostics only with comparator class and replay/authentication status; do not treat postprocessor agreement as physical truth.
- Lighting: no direct change; renderer-neutral spectral optics remain downstream of authenticated effective radius plus separate optical closure.
- KAOPU semantic core: independence and semantic equivalence become separate evidence dimensions; same name/unit is not identity.
- Tool routing: prefer exact model history/restart diagnostic extraction for authentication; use HRRR post `EFFR` for differential testing; use RRFS/UPP only as interface/migration reference.

No production Mother branch is modified.

## Gate result and next gate

R16 does not advance replay authentication status, but it removes an ambiguity in the R15 gate: `independent_checkpoint_matched` now requires both producer independence and proven semantic equivalence/support identity.

Next bounded Weather gate: first test whether a fixed HRRRv4 CONUS ARW history/restart or operational intermediate artifact exposes `re_cloud/re_ice/re_snow`. If available, lock its exact cycle/configuration/support and use it as the preferred independent source-model-state checkpoint while separately decoding the matching public/native input subset. If unavailable, run the locked HRRR post `EFFR` as a differential comparator on the same real inputs and explicitly measure/diagnose its equivalence gap before deciding whether it can contribute to authentication. Do not promote beyond `source_callpath_authenticated` until actual input execution plus an eligible checkpoint exist.
