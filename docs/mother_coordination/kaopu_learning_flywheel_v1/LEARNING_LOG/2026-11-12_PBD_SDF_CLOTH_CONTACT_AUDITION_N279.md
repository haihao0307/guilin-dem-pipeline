# KAOPU Learning Flywheel N279 — PBD + SDF 布料接触 audition

- Date/time: 2026-11-12 23:44–23:58 Asia/Shanghai
- Baseline main: `2573fb0b928feabfe528fe4901e88ef8b3a80a13`
- Previous learning head: `0fa54468cbfcb9c3e9e58fd72882c00c871777fc`
- Scope: learning-only; no production Mother branch, main, R2 OS, asset, or public release changed.
- Selected lane: external teacher candidate
- Bounded question: **For an already-3D garment, is vertex-only body projection sufficient, or must body contact and cloth metric constraints be solved together and bound to the same body/SDF version?**

## Current Best View and real gap

Fabric R02 proves a public WebGPU indexed mesh and material surface, but it does not yet prove garment-on-body contact dynamics. Existing regression history covers solver failure and yarn reruns, but no cloth-body contact case was found that simultaneously gates penetration, garment metric preservation, and body-pose/SDF freshness.

## Teacher audition

Candidate: `InteractiveComputerGraphics/PositionBasedDynamics` (RWTH Aachen Interactive Computer Graphics).

Teacher status: `TEACHER_CANDIDATE`

Lifecycle: `AUDITION` (not PROBATION, ACTIVE_TEACHER, ADOPTED, or USER-ACCEPTED).

### What it knows beyond KAOPU Current Best View

On one bounded problem, it supplies a concrete, executable decomposition absent from the current Fabric R02 evidence: represent the collider with a signed distance field; solve collision at particle level in the same iterative position-constraint loop as cloth stretch/bend; expose contact tolerance, friction, substeps, stiffness, and SDF resolution as separate parameters. Its `ClothOnBunny.json` additionally binds a mesh collision object to an explicit SDF resolution rather than treating “collision” as a visual claim.

### Screening

1. Source/provenance: official Interactive Computer Graphics GitHub organization and repository.
2. Maintenance: repository head `10a70bc146a97873dc3c8fef372f5217e010542e`, 2026-09-01; repository is not archived.
3. Runnable evidence: C++ demos, Python bindings/examples, scene JSONs, and successful Linux/Windows wheel-build workflows at the audited head. No conventional physics-validation unit-test suite was observed.
4. License/rights: MIT License for code. Example meshes/assets still require per-asset provenance checks before reuse; this audition copied no external asset.
5. Direct relevance: high for cloth/body collision architecture; not evidence of garment fit, tailoring, skinning, or user acceptance.
6. Novelty: joint constraint/contact loop plus explicit SDF collision object and parameter semantics are new relative to the current static Fabric R02 evidence.
7. Cost/risk: C++/CMake/Eigen/Discregrid integration is heavy for a WebGPU workbench; SDF generation has memory/precompute cost; animated/skinned bodies need a pose-coherent SDF update strategy.
8. Failure boundaries: official examples primarily demonstrate static/rigid colliders, not a production animated human, and build success is not physical validation.

## Minimal falsifiable replay

Synthetic 11×11 cloth, fixed top edge, 0.2 rest spacing, body sphere radius 0.9, clearance 0.02. This is an independent principle probe, not a port of the teacher and not a production garment.

| Case | Penetrating vertices | Minimum signed distance | Mean absolute edge strain | Max absolute edge strain |
|---|---:|---:|---:|---:|
| No contact | 45 | -0.4000 | 13.2003% | 264.0055% |
| Vertex projection only | 0 | 0.0200 | 24.5520% | 264.0055% |
| Distance + contact, 160 iterations | 0 | 0.0200 | 0.1087% | 0.4267% |
| Stale body-pose/SDF control | 18 | -0.1415 | 0.1052% | 0.4229% |

Executed: `node n279_cloth_sdf_probe.mjs`

All four smoke gates passed:
- projection alone can remove penetration;
- joint solve removes penetration;
- joint solve reduces mean edge strain by more than half;
- a stale collider pose is detected against the current body.

## New failure mechanism

**Zero penetration is not sufficient evidence of a valid garment candidate.** A vertex-only pushout can satisfy collision while catastrophically changing garment metric. Conversely, a well-preserved cloth metric solved against a stale body/SDF can still penetrate the current body. The two invariants must be checked together and against one pose/version identity.

Candidate regression: `CANDIDATE_CLOTH_BODY_CONTACT_AND_METRIC_001`.

## Candidate operationalization

For a clothing/fabric Task Anchor or Delivery Receipt, add or bind:

- `garmentMeshSha`
- `restMetricSha` (or explicit rest-edge/bending constraint version)
- `bodyMeshSha`
- `bodyPoseSha`
- `bodySdfSha`
- `sdfResolution`
- `contactTolerance`
- `friction`
- `substeps`
- `solverIterations`
- `penetratingVertexCount`
- `minSignedDistance`
- `meanAbsoluteEdgeStrain`
- `maxAbsoluteEdgeStrain`
- `selfCollisionStatus`
- `producerId` / `verifierId`
- `currentHeadSha`

Candidate verifier gate: fail if any identity is missing/mismatched, penetration exceeds the task threshold, or metric error exceeds the task-specific threshold. The numeric thresholds used by this synthetic smoke test are not production thresholds.

## Applicability boundary

Applies after a real 3D garment and explicit rest metric already exist. It does not solve 2D pattern construction, sewing topology, material calibration, self-collision, animated-body SDF updates, or final visual/user acceptance. Do not import the full library into production from this result.

## State and routing

- Research: `GATE-RUN`
- Teacher: `TEACHER_CANDIDATE / AUDITION`
- Mother routing: `POSTED` to #91 as comment `6828412955`.
- Mother ACK: `UNKNOWN` until a real reply.
- Production implementation: not done.
- Adoption: not done.
- User acceptance: not done.
