# Common person contract v1 (historical minimal adapter)

> Version boundary: this document describes the preserved legacy `kaopu-unified-person/1` minimal adapter in `src/`. Its `src/AnnyModel.js` actually consumes XYZ Euler degrees. The current full workbench uses `kaopu-common-person/rebuild-1` and native Anny local-ref **rotation-vector components in degrees**, not Euler angles. GNM axis-angle channels use radians. Do not reinterpret saved v1 values as current full-workbench values. See `full/src/State.mjs`, `full/UI-CONTRACT.json` and [the boxing runtime contract](full/boxing/MOTION.md) for the current interfaces.

## Stable identity

personId identifies a persistent synthetic character, not a verified real person. topologySha256 identifies the exact immutable Uint32 face sequence. Units are metres, Z-up, front -Y. adapterFingerprint binds canonical correspondence/weights, MHR projection, exact teacher asset hashes and adapter implementation. It is required in profiles; same face topology alone is insufficient for cross-build reproducibility. Vertex order is frozen at build time and remains identical across all controls and exported poses.

## State

- schema: kaopu-unified-person/1
- personId: bounded text identifier
- phenotypes: Anny-native gender, age, muscle, weight, height, proportions. Age is a phenotype coordinate, never a year count
- localChanges: empty in the supported UI contract
- pose: canonical Anny joint labels to three XYZ Euler degrees in local-ref parameterization
- headIdentity: 253 GNM-native PCA coefficients
- headExpression: 383 GNM-native PCA coefficients
- mhr: {channel: identity_000, amount: [-1,1]} for a torso-only transported displacement

No coefficient vector is interchangeable with any other vector. Conversion must happen through geometry or an explicitly calibrated semantic adapter.

## Runtime

new UnifiedModel(annyTeacher, gnmTeacher, canonicalMap, mhrTorsoDelta, adapterFingerprint).compute(state) writes Float32Array positions in place. faces is allocated once, topology is never reselected. metrics() returns topology, seam statistics and localized fairing displacement. Profiles validate against the same topology before replacement; invalid imports leave the character unchanged.

Teacher modules are development assets. Future production adapters may bake their required output into common shape bases and a common rig, provided they satisfy the same fixed-index contract and publish error metrics. The current sparse MHR transfer does not require the full MHR model at runtime.

## Adapter responsibilities

1. Declare source version, asset hashes and licensing
2. Declare coordinate, joint/pose and coefficient conventions
3. Evaluate source geometry independently
4. Subtract a declared neutral if transferring a displacement
5. Use frozen source-face/barycentric correspondence; never nearest-neighbor switch per frame
6. Preserve unmapped dimensions as unsupported. Never silently drop a channel or relabel it
7. Return coverage, neutral-registration residual, deformation transfer residual, held-out shapes/poses and failure cases
8. Do not claim semantic identity equivalence from a low interpolation error

## Verification boundaries

When MHR amount is zero, body is exact Anny before canonical neck operations; face is exact retained GNM outside the protected neck transition plus uniform cranial size (head-joint-to-fixed-scalp-vertex distance) and rig attachment. The attachment uses an explicit neck02/head two-joint geodesic blend; all official face/eye/oral labels are rigid-head-only. GNM aging, neck photorealism, nonrigid semantic facial retargeting, MHR pose correctives and all 72 MHR facial channels are not implemented in this adapter. The UI retains the independent teacher workbenches rather than implying all source features fit this contract today.
