# KAOPU Atmosphere Learning R06 — Per-Quantity Validity and Validation-Overlap Semantics

Status: Candidate learning note. No production Mother mutation. No Frozen promotion.

## Bounded question

Before authoritative NRLMSIS 2.1 binary execution is available, what can current primary NRL/NASA/model-team sources already establish about (a) the difference between a model's global query domain and an individual output quantity's validity domain, and (b) the evidential meaning of fitting/validation ensembles when random sampling permits repeated observations?

This cycle deliberately does not broaden into new atmosphere rendering features. It targets two promotion-critical semantic failure modes that can silently corrupt later reference fixtures.

## Logical corrections before implementation

1. **A model accepting an altitude does not imply that every returned quantity is valid at that altitude.** NASA CCMC documents NRLMSIS 2.1 input altitude from 0–1000 km, while the primary NRLMSIS 2.1 paper defines NO only from about 73 km to the exobase and states that the supplied code returns missing NO below 72.5 km. Treating the global model domain as a per-variable validity domain is a category error.

2. **A label such as `validation` or `holdout` does not prove sample-level disjointness or statistical independence.** The primary NRLMSIS 2.1 paper states that its 30 random ensembles were sampled with duplicates allowed, including duplicates across ensembles. The first 15 were used for fitting and the second 15 for validation, but this split alone does not certify that individual observations do not overlap.

3. **Matching archive filename/size does not prove artifact identity.** The Wiley Supporting Information S2/S3 sizes match the public NRL tar/zip sizes, but size equality is not a cryptographic or execution-level identity test. It cannot promote mirror-transported reference vectors to authoritative evidence.

4. **A numeric missing sentinel is not a tiny physical density.** If a sentinel is allowed through logarithms, interpolation, normalization, optical-depth calculation, or a State Reducer, it can become an apparently valid finite number and silently fabricate physical structure.

## Observation Roots kept distinct

### Observation Root A — NASA CCMC NRLMSIS 2.1 model interface

Primary official source:
- NASA Community Coordinated Modeling Center, NRLMSIS 2.1: https://ccmc.gsfc.nasa.gov/models/NRLMSIS~2.1/

Current NASA CCMC documentation identifies version 2.1, geodetic altitude input from 0 to 1000 km, time/location/solar/geomagnetic drivers, and output fields including neutral species, total mass density, temperatures, and NO. NASA also describes the NO component as spanning approximately 73 km to the exobase.

Transferable observation: the **global model query domain** is not sufficient metadata for an individual output field.

### Observation Root B — NRLMSIS 2.1 primary model-development paper

Primary model-team source:
- Emmert et al. (2022), *NRLMSIS 2.1: An Empirical Model of Nitric Oxide Incorporated Into MSIS*, JGR Space Physics, DOI 10.1029/2022JA030896: https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2022JA030896

The paper states:
- the NO model covers approximately 73 km to the exobase;
- 30 random ensembles were assembled, with the first 15 used for fitting and the second 15 for validation;
- random selection did not exclude duplicates, so an observation can occur more than once within an ensemble or across ensembles;
- final model parameters were averaged from ensembles 6–15 after omitting the first five fitting ensembles as spin-up;
- although the vertical B-spline basis and fitted data extend down to 70 km geopotential height, the authors analyze model output only above 72.5 km and the supplied code returns missing values below 72.5 km;
- that cutoff is motivated by an unrealistic local NO-density maximum near 72 km in the fitted baseline profile, i.e. a model-edge artifact rather than a physical atmospheric discontinuity.

These are **Observation** claims because they are statements from the primary model-development publication about the model's own construction and validity contract.

### Observation Root C — official NRL public release directory

Primary official source:
- U.S. Naval Research Laboratory public NRLMSIS 2.1 directory: https://map.nrl.navy.mil/map/pub/nrl/NRLMSIS/NRLMSIS2.1/

The official directory exposes `nrlmsis2.1.tar.gz` and `nrlmsis2.1.zip`. The publisher's S2/S3 supporting archives are listed with the same nominal sizes as those official packages, but the binary archives could not be materialized in this bounded execution environment. Same nominal size is retained only as a transport clue, not evidence of byte identity.

### Candidate implementation transport — public GitHub mirror

Non-authoritative transport only:
- https://github.com/jacobwilliams/NRLMSIS2.1

The mirror's Fortran source implements the 72.5 km NO cutoff and returns a generic missing-density sentinel below a species' minimum supported altitude. It defines the sentinel as `9.999e-38`.

Status: the exact sentinel value and mirror code are **Candidate implementation evidence**, not a new Observation Root. The cutoff itself is already independently supported by the primary model paper, but the mirror does not upgrade the numerical sentinel or release vectors to authoritative status.

## Executable semantic probe

Added:

`PROBES/atmosphere_quantity_validity_probe_r06.py`

The probe was executed before publication and all assertions passed. It encodes only the contract distinctions established above; it does not pretend to run NRLMSIS itself.

Checks:
- model global domain: 0–1000 km — Observation from NASA CCMC;
- NO minimum supported altitude: 72.5 km — Observation from the primary model paper;
- exact `9.999e-38` sentinel — Candidate from the non-authoritative mirror;
- 70.0 and 72.49 km classify as `quantity-unsupported` while remaining inside the global model domain;
- 72.5 and 500 km classify as `quantity-valid` for the bounded NO contract;
- the Candidate sentinel is parsed to typed `missing` before any transform;
- a deliberately unsafe `log10(9.999e-38)` is finite (~-37.000043), demonstrating why sentinel masking must happen before logarithmic or interpolation stages;
- a validation contract with sampling-with-replacement and possible cross-ensemble duplicates cannot claim guaranteed sample disjointness.

The probe is **derived executable evidence** and is not an Observation Root.

## Transferable methods

### 1. Separate model domain from per-quantity validity

Candidate schema:

`modelDomain`

`quantityValidityEnvelope[quantity]`

`quantitySupportStatus`

`missingPolicy`

A query can therefore be `inside-model-domain` while a specific field is `unsupported`, `missing`, or `outside-variable-validity`.

### 2. Missing is a typed state

A physical-state parser should convert any source-specific sentinel to a typed absence at the ingestion boundary. Downstream reducers/evaluators must never receive the raw sentinel as if it were a physical number.

Required ordering:

`source numeric/sentinel -> source-aware parse -> value | missing/unsupported -> unit conversion -> transform/interpolation/reduction`

Rejected ordering:

`raw numeric -> log/interpolate/normalize -> later notice sentinel`

### 3. Validity cutoffs require causal labels

The 72.5 km boundary is a **model-validity cutoff caused by a fitted-profile edge artifact**. It is not an atmospheric layer boundary and must not be rendered/simulated as a physical discontinuity.

If a later KAOPU reducer needs NO below that boundary, it may:
- keep the value Unknown/missing; or
- switch explicitly to another compatible Observation Root/property provider, with source/provenance and cross-source reconciliation recorded.

It may not silently zero-fill, extrapolate, or extend NRLMSIS authority downward.

### 4. Validation split metadata must record the sampling process

Candidate evidence metadata should retain at least:
- `samplingScheme`;
- `samplingWithReplacement`;
- `sampleOverlapStatus` (`none-proven`, `possible`, `known`, `unknown`);
- `source/instrument overlap`;
- `fit/validation role`;
- `parameterAggregationLineage` where relevant.

The word `holdout` alone is insufficient evidence of independence.

### 5. Artifact identity requires stronger proof than size/name

For executable reference fixtures, promotion should prefer one of:
- authoritative-source execution;
- byte hash from an authoritative package;
- signed/release provenance sufficient to establish identity;
- authoritative hosted output for the exact query.

Matching nominal archive sizes or filenames are only search/transport signals.

## Assumptions and constraints

- This cycle did not execute the official NRL binary package. The official NRL and Wiley source archives are discoverable, but their binary contents could not be materialized in the bounded runtime.
- NASA CCMC Instant Run is a browser workflow; no unattended authoritative numerical result was captured here. Runs-on-Request also involves submission workflow and should not be impersonated with user identity in an unattended cycle.
- A compatible Fortran toolchain, exact release files/parameter data, build flags, and execution working directory are required for a true official-package reproducibility test.
- Authenticated HITRAN line retrieval remains unavailable in this environment; the spectral numerical gate is unchanged.

These constraints prevent an ordinary quick implementation from claiming authoritative end-to-end ground-to-space numeric truth today. They do not block the semantic findings of this cycle.

## Failure modes rejected

- `model 0–1000 km => every variable valid 0–1000 km`;
- `validation ensemble => independent/disjoint observations`;
- `same archive size => same authoritative artifact`;
- `missing sentinel => tiny but valid density`;
- `artifact-driven cutoff => physical atmospheric boundary`;
- silent zero-fill/extrapolation across an unsupported quantity range.

## Status ledger

- **Observation:** NASA CCMC NRLMSIS 2.1 accepts geodetic altitude 0–1000 km and exposes NO among its output fields.
- **Observation:** primary NRLMSIS 2.1 publication defines NO from ~73 km to the exobase and states that supplied code returns missing values below 72.5 km because of a fitted-profile edge artifact.
- **Observation:** primary publication uses first 15 ensembles for fitting and second 15 for validation, while random sampling allows duplicate observations within and across ensembles.
- **Observation:** final parameter estimates average ensemble-derived parameters from fitting ensembles 6–15 after five spin-up ensembles.
- **Candidate:** exact `9.999e-38` missing sentinel and the mirror's implementation mapping of the cutoff.
- **Candidate:** `QuantityValidityEnvelope`, typed missing propagation, and explicit sampling-overlap metadata as KAOPU schema fields.
- **Current Best View:** global model validity, per-quantity validity, evaluator validity, and conventional boundaries are separate contracts; unsupported values must become typed absence before numerical transforms; validation labels do not imply sample disjointness.
- **Frozen:** none added.
- **Rejected:** all six failure modes listed above.
- **Unknown:** authoritative execution of selected NRLMSIS 2.1 release vectors; authenticated HITRAN numeric checkpoints; exact NO.15 sample membership in the conflicting public README wording; authoritative confirmation of the mirror's exact numeric sentinel if that value is to be used in a Frozen fixture.

## Routing recommendation

Weather:
- carry `modelDomain` separately from `quantityValidityEnvelope`;
- parse unsupported atmospheric constituent values to typed missing before any transform/reduction;
- never convert a model artifact cutoff into a physical atmosphere layer.

Lighting:
- optical reducers must reject or explicitly handle missing/unsupported constituent state before logarithmic, interpolation, extinction, or optical-depth operations;
- source sentinels must never become absorption coefficients by numerical accident.

Future-Space:
- preserve per-species/per-quantity validity boundaries in high-altitude neutral-state packets;
- source transitions across altitude regimes require explicit provenance rather than silent extrapolation.

KAOPU semantic core:
- add first-class `QuantityValidityEnvelope` and typed `Missing/Unsupported` state;
- extend evidence-split metadata with sampling scheme, replacement policy, overlap status, and parameter-aggregation lineage;
- do not infer artifact identity from filename/size alone.

All evidence-bearing Mothers:
- apply the same validation-overlap rule to historical photos, scans, surveys, maps, data slices, benchmark sets, and AI-derived assets: a `validation` folder or separate file name does not prove information independence.

No production Mother branch was modified.

## Next gate

1. Materialize and execute the authoritative NRLMSIS 2.1 NRL package or capture an authoritative NASA CCMC result for selected locked cases; compare exact numerical outputs with the Candidate release vectors.
2. In that fixture, record both `modelDomain` and per-output `QuantityValidityEnvelope`, plus typed missing behavior and evidence dependency metadata.
3. Retrieve a tiny authenticated HITRAN transition subset and build two or three optical checkpoints with molecule/isotopologue, line provenance, T/P, line-shape model, column/path state, units, tolerance, EvidenceClass, and dependency provenance.
4. Keep `LQ-ATMOSPHERE-001` at `candidate-partial` until both authoritative NRL numerical confirmation and authenticated spectral checkpoints exist. Frozen promotion remains a separate Judgment event.
