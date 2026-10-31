# KAOPU Learning Flywheel N220 — exact authoring geometry is not triangle-free runtime proof

## Bounded question

When an authoritative Mechanical/Motor part is stored as exact analytic/NURBS BRep, does that fact prove the production display/runtime path is triangle-free?

## Baseline and freshness

- `main@3ccae4bde0c91973adbb81f99ec4d54bc9357ce0`
- root `AGENTS.md` blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference gate blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91: no Mother/coordinator acknowledgement or new production subject after N219.
- #63: no new Coast production evidence after N49.

No production branch, Mother, main, R2 OS, root AGENTS, renderer, or global gate was modified.

## Primary-source finding

Pinned teacher revision: NVIDIA-Omniverse/usd-brep `3fd5b9548d19aa8c12c29bc9637a96d42a06f8a5` (release 1.0.1; Apache-2.0, third-party notices retained).

The official source separates two subjects:

1. **Authoring subject:** `BrepArray` stores full topology plus analytic or NURBS curves/surfaces.
2. **Display subject:** the official Hydra plugin imports that BRep into SMLib and exposes **tessellated transient meshes** to Hydra renderers. The repository tessellator converts exact geometry to a `PolyBrep`, subdivides faces into triangles, and can author `UsdGeomMesh` output.

Primary sources:

- [USD BRep repository README at the pinned revision](https://github.com/NVIDIA-Omniverse/usd-brep/blob/3fd5b9548d19aa8c12c29bc9637a96d42a06f8a5/README.md)
- [hdUsdBrep behavior at the pinned revision](https://github.com/NVIDIA-Omniverse/usd-brep/blob/3fd5b9548d19aa8c12c29bc9637a96d42a06f8a5/source/HYDRA_USD_BREP/README.md)
- [Tessellation contract at the pinned revision](https://github.com/NVIDIA-Omniverse/usd-brep/blob/3fd5b9548d19aa8c12c29bc9637a96d42a06f8a5/.agents/operations/tessellation.md)
- [USD tessellation API at the pinned revision](https://github.com/NVIDIA-Omniverse/usd-brep/blob/3fd5b9548d19aa8c12c29bc9637a96d42a06f8a5/source/SM_API_USD/inc/SmApiUsdTessellate.h)

Therefore exact BRep authoring is not evidence that the production renderer evaluates exact surfaces directly. A pipeline may preserve analytic/NURBS geometry as canonical truth and still create triangles for every shaded frame.

## What the teacher knows beyond Current Best View

N218/N219 already bind mathematical patches, topology, kernel revision, exact input/output subjects and operation postconditions. USD BRep contributes a narrower and independently useful boundary: the same exact authoring subject can feed a derived polygon display subject without mutating or replacing the canonical BRep.

The resulting KAOPU discriminator is:

`authoritative authoring representation != runtime/display evaluation route`

This is new executable coverage, not a new global principle. R2 already separates evidence layers, but the Mechanical/Motor regression previously had no negative control that rejects an exact-source/triangle-runtime conflation.

## Candidate gate translation

The existing regression `MECHANICAL-SURFACE-RELATION-NOT-SHAPE-LABEL-001` is extended rather than duplicated.

For any `runtimeDisplayClaim=TRIANGLE_FREE`, the receipt now requires:

- exact runtime subject digest, separately from the authoring BRep;
- display evaluation route and trace digest;
- coverage of every production render pass;
- observed `tessellationInvoked` state;
- observed triangle primitives/buffers state;
- independent display-route verifier.

Decision order:

- missing bound route or trace -> `HOLD_RUNTIME_EVALUATION_ROUTE_UNBOUND`;
- incomplete render-pass coverage -> `HOLD_RUNTIME_RENDER_PASS_COVERAGE_INCOMPLETE`;
- any tessellator, `PolyBrep`, `UsdGeomMesh`, transient Hydra mesh, triangle primitive, or triangle buffer in the claimed route -> `REJECT_EXACT_AUTHORING_MISCLAIMED_AS_TRIANGLE_FREE_RUNTIME`;
- complete independently verified direct-parametric route with no tessellation/triangles -> `CANDIDATE_TRIANGLE_FREE_RUNTIME_ROUTE_ELIGIBLE_NOT_REFERENCE_ACCEPTED`.

## Replay

The 17 N218/N219 controls remain unchanged and pass. Five new controls cover:

1. exact authoring with no runtime-route receipt;
2. exact BRep -> transient Hydra mesh (official hdUsdBrep path);
3. exact BRep -> authored `UsdGeomMesh` (official tessellator path);
4. direct-parametric route with incomplete render-pass coverage;
5. a complete synthetic direct-parametric positive control.

Result: `22/22 PASS`.

This is a source/synthetic replay only. It does not execute USD BRep, KAOPU WebGPU, a production browser/device, or a Mechanical/Motor part.

## Teacher and lifecycle decision

- teacher status remains `TEACHER_CANDIDATE`;
- useful scope: exact authoring topology, validation layering, operation postconditions, and explicit authoring/display separation;
- rejected scope: using its documented viewing path as a triangle-free runtime teacher;
- not promoted to `AUDITION`: no Mother-selected part/operation or production runtime trace exists.

Lifecycle: `POSTED=false / ACKNOWLEDGED=false / IMPLEMENTED=true(candidate checker) / GATE-RUN=true(source+synthetic) / ADOPTED=false / USER-ACCEPTED=false` before coordinator routing.

## Smallest falsifiable audition

On one Mother-selected Mechanical/Motor part only, bind the exact authoring subject and the exact production runtime build, trace every render pass, and inject one hidden tessellation/triangle negative control. The candidate passes only if the independent verifier detects the injected route and the honest direct-parametric route emits no triangle primitive/buffer. Until a Mother selects the part and route: `NOT_QUERIED / UNKNOWN`.
