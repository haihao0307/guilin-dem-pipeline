# KAOPU Learning R14 — HRRRv4 Thompson effective-radius source lock and bounded replay

Date: 2026-09-10
Status: Candidate-partial. No production Mother mutation.

## Bounded question

Can the R13 `MicrophysicsDiagnosticReplay` be tied to an exact operational HRRRv4 source identity instead of a generic Thompson/WRF-family interpretation, and what still prevents that source-locked effective-radius diagnostic from becoming a complete visible-light cloud optical closure?

This is the highest-value unresolved sub-question of `LQ-ATMOSPHERE-001`. R13 explicitly left exact HRRRv4 implementation/version authentication open.

## Independent evidence roots

### Engineering Root A — NOAA-EMC HRRR operational source
NOAA-EMC commit `40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827` is explicitly described as a sync from NCO's `hrrr.v4.1.20` operational directory on 2026-05-01. `release_notes_v4.1.20` identifies v4.1.20 as released 2025-06-18. The locked Thompson source is `sorc/hrrr_wrfarw.fd/WRFV3.9/phys/module_mp_thompson.F`, blob `1e6cdb1e718473ee1a031e16b1c00c96113f19f8`.

The same source contains `calc_effectRad`, which computes radiation effective radii for cloud water, cloud ice and snow from thermodynamic and hydrometeor inputs and applies explicit bounds. The locked CONUS namelist uses `mp_physics=28` for the primary domain. However, the module sets `is_aerosol_aware` from the presence of aerosol arguments, so `mp_physics=28` alone is not sufficient evidence that every invocation follows the same runtime branch.

### Engineering Root B — upstream WRF V3.9
The official `wrf-model/WRF` V3.9 source contains the same bounded `calc_effectRad` subroutine. Direct comparison of the fetched complete subroutine found no textual difference in its formula/control-flow block. This comparison is deliberately scoped to `calc_effectRad`: the full module blobs differ, so the HRRR operational fork is not thereby equivalent to upstream WRF V3.9.

No new atmospheric physical Observation Root is added in R14.

## Logical corrections

1. A directory named `WRFV3.9` is not sufficient implementation identity. HRRR is an operational fork; a reproducible replay must lock model release, repository commit, source blob/path and relevant runtime configuration.
2. Identical `calc_effectRad` source does not prove bitwise equivalence to operational HRRR output. Inputs, option state, calling path, preprocessing, compilation and numerical environment can still change results.
3. `mp_physics=28` does not by itself prove the internal `is_aerosol_aware` branch state; the source sets that flag from argument presence.
4. Radiation effective radius is still an intermediate model-derived diagnostic, not extinction/scattering/albedo/phase. A separate `SpectralOpticalClosure` remains mandatory.

## Transferable methods

- Add `SourceImplementationIdentity` to model-derived replay contracts: provider/model release, exact commit/tag, source path, blob hash, option/namelist evidence, runtime branch prerequisites and comparison scope.
- Distinguish `source-locked` from `runtime-authenticated`. Source-locked means the algorithm text/version is fixed; runtime-authenticated additionally requires matching operational inputs/configuration and a numerical checkpoint.
- Require `RuntimeBranchContract` for conditionally selected physics paths. Do not infer internal branch state from a high-level scheme number when the source has additional conditions.
- Keep source-algorithm equivalence scoped to the exact compared routine. Never propagate a local source match into a claim of whole-model equivalence.
- Preserve the R13 sequence: Weather microphysics -> source-locked diagnostic replay -> moment/PSD closure -> spectral optical closure -> renderer-neutral optical packet -> evaluator adapters.

## Executable evidence

Probe: `PROBES/hrrrv4_thompson_effective_radius_replay_r14.py`.

The probe transcribes only the cloud-liquid branch of the locked HRRR v4.1.20 `calc_effectRad` and uses synthetic test values. It verifies: finite bounded replay; condensate and number-concentration sensitivity; exact 2.51–50 micrometre source clamps; sensitivity to aerosol-aware versus fixed-`Nt_c` configuration; and the fact that one effective radius does not uniquely specify per-metre extinction without an optical efficiency/closure.

Run before publication: `7/7 PASS`.

Example synthetic result: a test state produced `re_cloud = 9.142284 um`; changing number concentration produced `6.161869 um`; forcing the non-aerosol-aware fixed-`Nt_c` branch produced `9.651619 um`. These are wiring/replay values only, not HRRR observations or forecast values.

## State ledger

### Observation
- No new physical atmospheric Observation Root.

### Candidate
- `SourceImplementationIdentity`.
- `RuntimeBranchContract`.
- `ReplayStatus.source_locked` distinct from `ReplayStatus.runtime_authenticated`.
- HRRR v4.1.20 `calc_effectRad` as a source-locked candidate for `MicrophysicsDiagnosticReplay`.

### Current Best View
The R13 version-authentication gap is materially reduced: an exact NOAA operational-sync commit and Thompson source blob are now locked, and the bounded `calc_effectRad` block matches upstream WRF V3.9. KAOPU may therefore call this a **source-locked HRRR v4.1.20 diagnostic candidate**, but not yet an operationally numerically authenticated HRRR replay. Runtime branch state and actual HRRR field values must still be verified. Effective radii remain upstream of a separate visible-band optical closure.

### Frozen
None.

### Rejected
- Treating `WRFV3.9` directory naming as sufficient HRRR implementation identity.
- Replacing the HRRR fork with latest WRF Thompson code.
- Claiming whole-model equivalence because one subroutine matches upstream WRF V3.9.
- Claiming `mp_physics=28` alone proves all internal aerosol-aware branch state.
- Calling a source-locked formula operationally validated without matching real inputs/configuration.
- Treating effective radius as renderer-ready extinction/scattering.

### Unknown
- Exact runtime argument-presence/branch state for the operational `calc_effectRad` invocation at a selected HRRR cycle.
- A materialized official HRRR native GRIB subset and a numerical replay checkpoint using its actual fields.
- Whether an operational diagnostic/output exists that permits direct numerical comparison of `re_cloud/re_ice/re_snow`; if not, an instrumented source-model checkpoint is needed.
- Final visible-band liquid scattering model and separately justified ice habit/roughness/scattering model.
- Remaining representativeness/disaggregation and two-evaluator error budgets.
- Independent NRLMSIS/HITRAN and runtime-atmosphere gates remain open.

## Routing

Candidate only. Weather should carry source implementation/version and runtime-branch provenance with any replay request. Atmosphere should accept effective radius only as intermediate model-derived state. Lighting must continue to consume a renderer-neutral optical packet, never raw effective radius as extinction. KAOPU semantic core should make source-locked versus runtime-authenticated replay status explicit. Noise/Field remains downstream of resolved source support and must not rewrite the source diagnostic. No production Mother branch is modified.

## Next gate

Materialize a tiny official HRRR native subset for one fixed cycle containing the required thermodynamic/microphysics fields and exact support metadata. Resolve the operational `is_aerosol_aware` call-path state for that cycle, run the source-locked replay on actual values, and establish at least one numerical checkpoint. Only after that promote the diagnostic replay to runtime-authenticated Candidate and proceed to liquid/ice spectral optical closure and dual-evaluator validation.
