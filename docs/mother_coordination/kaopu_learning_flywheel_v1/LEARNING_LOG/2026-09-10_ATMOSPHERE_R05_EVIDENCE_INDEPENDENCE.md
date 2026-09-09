# KAOPU Atmosphere Learning R05 — Evidence Independence, Empirical State, and Coverage

Status: Candidate learning note. No production Mother mutation. No Frozen promotion.

## Bounded question

When an atmosphere reference is an empirical model fitted from measurements, how should KAOPU distinguish raw/derived observations, fitted model state, holdout validation, external sensors, and retrievals that themselves depend on the model under test?

This is a continuation of `LQ-ATMOSPHERE-001`, which remains the highest-priority unresolved coordinator question under explicit user priority.

## Logical correction before implementation

Two shortcuts are invalid:

1. **"Different data set" does not imply "independent Observation Root."** A withheld sample can come from the same instruments and retrieval chain used to fit a model. A nominally external sensor product can also depend on the model being evaluated during its retrieval.
2. **"A model accepts a driver" does not imply "that dependence is well constrained by observations."** A parameter may exist in the interface while the underlying data have weak coverage along that dimension.

Therefore evidence independence and evidence coverage cannot be represented as booleans.

## Observation Root A — current NASA CCMC model identity

Primary official source:
- NASA CCMC NRLMSIS 2.1 model page: https://ccmc.gsfc.nasa.gov/models/NRLMSIS~2.1/

Current NASA CCMC documentation (last updated 2026-09-03) still identifies NRLMSIS 2.1 as the current hosted model. It exposes time, geodetic position/altitude, local apparent solar time, F10.7 and geomagnetic inputs and returns neutral-species densities, total mass density, exospheric/local temperature, and NO.

Transferable role: authoritative model identity/interface and hosted-run source. **The model output is an empirical estimate/reference state, not a direct observation.**

## Observation Root B — NRLMSIS 2.0/2.1 model-development papers

Primary sources:
- Emmert et al. (2021), *NRLMSIS 2.0: A Whole-Atmosphere Empirical Model of Temperature and Neutral Species Densities*, https://doi.org/10.1029/2020EA001321
- Emmert et al. (2022), *NRLMSIS 2.1: An Empirical Model of Nitric Oxide Incorporated Into MSIS*, https://doi.org/10.1029/2022JA030896

The 2.0 paper explicitly defines the model as a parameterized description of the **average observed behavior** of atmospheric state variables, with physical constraints such as hydrostatic/diffusive equilibrium. It distinguishes measurements used for assimilation/fitting from independent samples used for validation.

The 2.1 NO paper states that six satellite/instrument data sets are assimilated into the NO fit (HALOE, SNOE, MIPAS, ACE/FTS, SMR, SOFIE) and that SCIAMACHY is used as an additional independent comparison. It also documents an important coverage limitation: the original NO data have poor continuous local-time coverage because several instruments are sun-synchronous or solar-occultation instruments. The authors explicitly state that this makes true local-time effects difficult to distinguish from inter-data-set biases.

Transferable role: model-formulation/fitting/validation provenance. These papers are primary evidence for **how the model was inferred**, not a replacement for the underlying measurements.

## Observation Root C — official NRL sample provenance

Primary official source:
- NRL public data-sample README: https://map.nrl.navy.mil/map/pub/nrl/NRLMSIS/NRLMSIS2.1/data/readme.txt

The official README distinguishes NO samples used to tune the model from samples used to validate it and identifies the instrument IDs and physical fields stored in the sample files. This supports a first-class `validationKind=holdout` distinction.

### Primary-source conflict retained

The README says `NO.01.txt`-`NO.15.txt` are tuning samples and also says `NO.15.txt`-`NO.30.txt` are validation samples, which overlaps file 15. The 2022 paper describes the first 15 ensembles as fitting and the second 15 as validation, which would normally imply 1-15 versus 16-30.

R05 does **not** silently repair this discrepancy. Exact file-15 membership is recorded as a source-level conflict/Unknown until an authoritative clarification is obtained. The transferable conclusion does not depend on that boundary: a holdout split can be statistically separate without becoming a new instrument/source Observation Root.

## Observation Root D — 2025 SABER NO validation and dependency chain

Primary source:
- Wang et al. (2025), *Thermospheric Nitric Oxide Density From SABER: Local Time Dependence and Validation Against Independent Observations*, https://doi.org/10.1029/2025JA034803

This later data set is especially valuable because SABER covers all local times from roughly 120 to 250 km. The study reports strong NO local-time structure: a diurnal component at all examined altitudes and an additional semidiurnal component around 120-130 km at low latitudes. Those variations are not represented by the current MSIS 2.1 NO formulation except indirectly through temperature coupling; assimilating SABER NO around 120-130 km improves the modeled local-time dependence.

However, the SABER NO concentration retrieval itself uses NRLMSIS 2.1 estimates of temperature, O, and O2 together with a non-LTE model. That makes the SABER product **sensor-source independent from the six original NO fitting instruments, but not fully model-independent** with respect to NRLMSIS 2.1.

This is a concrete reason KAOPU must preserve a dependency graph instead of counting named data products as independent votes.

## Executable probe

Added and executed before publication:

`PROBES/evidence_independence_vector_r05.py`

The probe uses a conservative four-axis evidence vector:
- `sample_split_independent`
- `instrument_source_independent`
- `retrieval_uses_model_under_test`
- `shared_upstream_prior_dependency`

It intentionally refuses to collapse Unknown dependencies into `independent=true`.

Executed assertions:
- same-instrument holdout -> **not fully independent**;
- SCIAMACHY external sensor -> **full independence remains Unknown** unless retrieval/upstream dependencies are also checked;
- SABER NO v1.1 -> **not fully independent** because its retrieval consumes NRLMSIS 2.1 fields.

This probe is a semantic evidence-contract test, not a replacement for physical validation.

## Candidate transferable methods

1. **Make `EvidenceClass` explicit.** At minimum distinguish direct measurement, retrieved measurement, empirical/fitted model output, physics-model output, derived cache/product, and synthetic test fixture.
2. **Replace `independent: true/false` with an `IndependenceVector` or dependency DAG.** Sample-split independence, instrument/source independence, retrieval-model dependence, and shared-prior dependence answer different questions.
3. **Keep `fitInputs`, `validationInputs`, and external-comparison roots distinct.** Holdout validation measures generalization within a source family; it is not automatically independent evidence about the world.
4. **Attach a per-variable `coverageEnvelope`.** A driver appearing in the model signature does not prove that the target quantity is well identified over that driver. Local time for NRLMSIS 2.1 NO is the concrete example.
5. **Attach `supportedDependence` separately from `acceptedInput`.** A system may accept time/local-time coordinates while a particular fitted quantity has weak observational support for that dependence.
6. **Never count a retrieval as fully independent confirmation of fields it borrowed from the model under test.** It can still add new independent information through its raw sensor measurement, geometry, time coverage, or other retrieval terms; the dependency must simply remain visible.
7. **Treat empirical model state as an inferred reference family, not an Observation measurement.** Model output can be a powerful state source, but its fitting data, physical constraints, validity/coverage, and validation evidence must remain linked.

## Failure modes rejected

- `different filename/product == independent root`
- `withheld sample == independent sensor evidence`
- `external sensor == fully independent` without checking retrieval dependencies
- `model has a local-time input == local-time dependence is observationally constrained`
- `empirical model output == direct observation`
- silently resolving contradictory primary-source metadata

## Practical constraints

An ordinary implementation cannot turn this into a universally authoritative independence score automatically because retrieval chains are often incompletely documented, products can share calibration/priors/reanalyses, and historical data products may have transitive dependencies that are hard to recover. The correct near-term architecture is therefore an explicit dependency graph with `Unknown` edges, not a fabricated scalar confidence score.

The R04 numerical promotion gates remain open. The official NRL binary release and Wiley supporting archive were discoverable from primary sources in this cycle, but the binary package could not be materialized into the current execution environment for an authoritative compile/run. HITRAN HAPI still documents that an API key is required for data download. Therefore `U-ATMOS-005` and `U-ATMOS-006` remain Unknown; no numerical values were promoted or invented.

## Status ledger

- Observation: current NASA CCMC identifies NRLMSIS 2.1 as the current hosted model and documents its driver-conditioned interface.
- Observation: NRLMSIS 2.0/2.1 are empirical/semi-empirical fitted models built from measurements plus physical constraints; their output is inferred model state, not a raw observation.
- Observation: the 2022 NO fitting database has limited local-time coverage.
- Observation: the 2025 SABER NO product adds full-local-time sensor information and exposes local-time structure not represented by the current MSIS 2.1 NO dependence.
- Observation: SABER NO retrieval uses NRLMSIS 2.1 T/O/O2, so the product is not fully independent of the model under test.
- Candidate: `EvidenceClass`, `IndependenceVector`, `EvidenceDependencyDAG`, `coverageEnvelope`, and `supportedDependence` as first-class KAOPU evidence semantics.
- Current Best View: evidence independence is multidimensional; model/retrieval dependency must survive routing and reduction; empirical model state remains a derived reference state with linked fitting/validation provenance.
- Frozen: none added.
- Rejected: boolean independence; counting holdouts or model-dependent retrievals as new independent world roots; assuming an input dimension is empirically constrained merely because the model accepts it.
- Unknown: exact complete dependency graphs for SCIAMACHY and other retrieval products; exact `NO.15` tuning/validation membership conflict; official NRL release-vector execution; authenticated HITRAN line checkpoints.

## Routing recommendation

Weather:
- tag atmosphere state sources as measurement/retrieval/empirical-model/derived;
- carry per-quantity coverage and supported-dependence metadata;
- do not treat NRLMSIS 2.1 NO local-time behavior as equally constrained across all local times.

Future-Space:
- retain model-fit/validation provenance with high-altitude neutral-state packets;
- distinguish empirical climatological/reference state from contemporary observation.

KAOPU semantic core:
- make `EvidenceDependencyDAG` and multidimensional independence first-class;
- do not increment evidence confidence simply because two products have different names or files;
- preserve Unknown dependency edges rather than pretending independence.

General evidence-bearing Mothers:
- the same rule applies to historical photographs, scans, reconstructions, maps, meshes, and derived datasets: copies, restorations, AI reconstructions, orthophotos, and products derived from one upstream source are not independent votes merely because they are separate assets.

No production Mother branch was modified.

## Next gate

1. Keep `LQ-ATMOSPHERE-001` at `candidate-partial`.
2. Preserve the original R04 authoritative numerical gates: official NRLMSIS 2.1 execution confirmation plus a tiny authenticated HITRAN checkpoint set.
3. In parallel, require any future Earth fixture to carry `EvidenceClass`, dependency/independence metadata, and per-variable coverage so numerical agreement cannot be mistaken for independent observational confirmation.
