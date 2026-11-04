# KAOPU Learning Flywheel N245 — Simscape excavator method-teacher screen

Date: 2026-11-04  
Baseline: `main@34553e93d75a427c10dbf5b0077d42f8cdda0a63`  
Scope: external teacher candidate only; no production Mother, main, R2, asset, registry, or schedule change.

## One bounded question

Can `simscape/Excavator-Simscape` teach Mechanical / Vehicle / Engineering-Machinery Mother a reproducible **pin-location → linkage geometry → hydraulic force/load-chart/dig-cycle** method that exceeds the current static-mesh Current Best View, without importing its restricted code or assets?

## Current failure and comparison baseline

N241 and N242 showed the present failure mode clearly: a visually detailed mesh or named part partition is not a kinematic or engineering teacher when it lacks joint axes, strokes, forces, constraints and executable checks.

Applicable current rules:

- `MOTHER-NO-METHOD-INVENTION-001`: a teacher cannot silently replace the frozen production method or become a copied production baseline.
- `CANDIDATE-SOURCE-RIGHTS-METADATA-CLOSURE-001`: source rights and intended use must be explicit before audition.

## Pinned upstream facts

Subject: <https://github.com/simscape/Excavator-Simscape>  
Pinned commit: `455c74d1b24f488ab9645b0cde84a710dcf5c674`  
Pinned release: `26.1.51.9 / R2026a`, published 2026-05-17.

The pinned tree contains:

- 1,332 entries;
- 61 MATLAB files and 13 Simulink models;
- 52 CAD-path entries, including 24 SolidWorks part files, 2 assemblies, 23 STEP files and 1 STL;
- explicit BOF/TOF, pin-location, load-chart, hydraulic-system and dig-cycle paths;
- named scenario/test scripts and recorded example outputs.

No `matlab.unittest` or assert-based formal unit-test suite was found in the pinned tree. No current KAOPU-run MATLAB/Simscape receipt exists.

## What it knows beyond Current Best View

For one bounded question, the repository adds knowledge that N241/N242 did not contain:

1. editable pin locations as engineering inputs;
2. global/local pin-coordinate transformation;
3. boom/stick/bucket cylinders and relief-pressure semantics;
4. BOF/TOF workflows labelled against ISO 6015;
5. pin loads and load charts across arm positions;
6. dynamic dig-cycle time/efficiency scenarios;
7. a linked CAD–mechanical–hydraulic model rather than a flat visual part hierarchy.

This is real novelty for **verification structure and parameter semantics**. It is not evidence that its geometry matches any user reference or manufacturer machine.

## Rights and integration boundary

`LICENSE.md` permits redistribution but adds a decisive restriction: the software, modifications and derivatives are licensed solely for use with MathWorks products and services.

Therefore:

- do not copy/import its MATLAB code, Simulink models, CAD, STEP/STL, screenshots, data tables or derived assets into KAOPU production or final assets;
- do not treat it as a reference-replication geometry source;
- only study transferable method concepts unless a separate rights review clears a specific use;
- commercial MATLAB/Simulink/Simscape/Multibody/Fluids dependencies remain a high cost and reproducibility risk.

## Decision

`TEACHER_CANDIDATE`

Lifecycle: `RADAR_FOUND -> TEACHER_CANDIDATE`.

It does **not** enter `AUDITION / PROBATION / ACTIVE_TEACHER`, Teacher Registry, referenceSet or method candidate in this run.

Exact answer to the required question:

> It knows how to organize excavator pin geometry, hydraulic actuator parameters and standard-labelled force/load/dig-cycle checks into one executable engineering workflow; KAOPU's current rejected static-mesh observations do not.

## Minimum falsifiable audition

Only after the affected Mother confirms relevance:

1. pin commit `455c74d...`, release `26.1.51.9`, MATLAB R2026a and exact toolbox versions;
2. choose one named BOF scenario and one named dig-cycle scenario;
3. capture exact pin ledger, pressures, cylinder areas and model identities;
4. run pristine and record force/pressure/pin-load outputs;
5. change one pin coordinate by a declared delta and require the executed outputs to change;
6. restore the pin and require deterministic return within a declared tolerance;
7. have an independent verifier check transform, stroke-limit and result lineage.

Reject or hold if the mutation is not consumed, outputs do not restore reproducibly, or required resources are unavailable.

## Eight-factor screen

| Factor | Result |
|---|---|
| Source/provenance | Pinned public MathWorks-authored repository/commit/release |
| Maintenance | R2026a release and commit in 2026 |
| Runnable code/tests/data | Substantial code/models/data; no formal unit suite found; not run here |
| License/assets | Restricted to MathWorks-product use; method observation only |
| Current KAOPU relevance | High for excavator linkage/force verification |
| Novelty | Yes, explicit pin/hydraulic/load/dig-cycle semantics |
| Dependency/cost/integration | High commercial-toolchain risk |
| Demo-only/version opacity | Not demo-only, but current independent replay is absent |

## Routing state

Target: Mechanical / Vehicle / Engineering-Machinery Mother.

Before posting: `NOT_QUERIED / UNKNOWN`.  
After targeted issue comment, only `POSTED` may become true. No acknowledgement is inferred.
