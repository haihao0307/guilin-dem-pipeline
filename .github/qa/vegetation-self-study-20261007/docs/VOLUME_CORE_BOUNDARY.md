# Derived core volumes, not an opaque replacement tree

The retained biological/art-directed axis graph remains the source of truth. Only the main trunk, the two dominant deadwood leaders, basal supports, roots and upper hooked leader are selected for a fused core. The original fine branches remain separate. Every selected axis keeps its ID, parent, attachment coordinate, path and cumulative arc offset.

## Executed original teacher

The unmodified official Three.js r170 MarchingCubes implementation (MIT) is run against an analytic sphere. The 40³ input yields 4,808 triangles; volume error is 0.586%, maximum radial error 0.000555 and normals point outward. The input fixture and import-resolution adapter are declared. Source hash is recorded in qa/marching-original-baseline.json.

## Independent volume layer

1. Sample selected axes into variable-radius capsule segments
2. Hard-min segments within the same axis, then smooth-union only distinct axes; subdivision must not inflate an axis
3. Subtract a trunk interior and volume windows, producing actual inner surfaces
4. Extract the isosurface with the original kernel
5. Weld coincident vertices at 1e-5 scene units and remove only collapsed microtriangles
6. Transfer nearest axis ID, local circumferential/arc UV, cumulative growthV and a junction blending weight to the derived surface

This is a reconstruction of a volume modelling workflow. It is not the source author's Houdini scene, not OpenVDB or Karma equivalence, and not a finished bark mapping. Nearest-axis UVs are an explicit interface, not a guarantee of seamless production texturing across every junction.

## Checks and controls

CPU tests verify parent connectivity is retained, the centre is empty while the back wall remains solid, surface windows join the void, inner-facing surface normals exist, oriented volume is positive and every indexed edge is paired exactly twice. The browser has controls for union radius, interior radius and axis-ID colour inspection; rebuilding must change the actual mesh while keeping axis identity.

Default pine voxel spacing is anisotropic, approximately 0.045 × 0.129 × 0.030 scene units. Deadwood spacing is approximately 0.050 × 0.068 × 0.031. These grids address the core mass, not millimetre bark detail. The initial controlled forms and all source-reference fidelity remain visually unaccepted. 04 bark stays frozen and is not applied.

R13 corrects a real R12 defect: smoothing adjacent capsules of one axis made the shape thicker as sampling increased. A straight-axis fixture now checks 6 versus 24 capsules with exactly zero field difference. The pine hook is shortened before its free end can rejoin the trunk. These changes still require actual browser/reference review.

R14 restores the retained sweep cross-section (lobe amplitude and count) to the derived core. The first R12/R13 wrapper only used circular radii and therefore discarded the source sweep's twisting relief. The capsule radial field now evaluates the same bounded cross-section function in its transported axis frame. This is an implicit approximation, not an exact Euclidean distance function or a bark shader. The original MarchingCubes teacher remains unmodified.
