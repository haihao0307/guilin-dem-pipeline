# Bounded glass depth-cap recovery, research candidate

Frozen baseline: 3c21c7aa. Runtime R07 source geometry, 6 mm pane thickness, outward union coverage, optical path, glass recipe and frame material are unchanged. Only this isolated facade renderer wraps its aperture trace shader.

## Corrected diagnosis
The ID of the dark pixels was correct but their selected face was wrong. GPU readback run 39760448270 observed a back-face t of 17.136287689 m, transmission weights about 3.669e-32 / 9.850e-16 / 8.112e-26 and reflection weight 0. Both secondary scene colors were non-black. Thus the opaque black was the consequence of incorrectly interpreting camera-to-back-face distance as travel inside glass, not proof that the secondary scene trace failed.

The redundant self-neighbour test reconstructed a world point and transformed it back to local space. Float32 cancellation exceeded its fixed 2 micrometre test. The matching CPU non-fused witness has 2.142 micrometre near-cap residual and rejects the near face. Real GPU arithmetic need not match a scalar simulator exactly.

## Narrow recovery
Successful old checks are retained. A failed old check can recover only for a convex glass primitive, an exact endpoint of its original depth slab, normal sign consistent with that endpoint, depth residual within a scale-aware roundoff budget, planar edge distance greater than four times the budget, and budget less than one-quarter half-depth. The time error is propagated into planar coordinates, including its denominator dependence at grazing incidence. Nearly parallel rays and uncertifiable cases keep the original behavior. No thickness clamp, geometry expansion, fixed larger global epsilon, opaque fallback, or changed source mask is used.

The arithmetic budget treats packed Float32 inputs as authoritative and assumes finite normal IEEE-like arithmetic. Its evaluation is not implemented with directed rounding; it is a conservative engineering budget, not a universal GPU certification or complete renderer proof. Uncovered extreme grazing/corner behavior remains separately testable. The wrapper applies to all convex glass in this renderer, including secondary rays, so old windows and all cases are regression-tested.

The mathematical roundoff concepts were checked against the primary reference https://pbr-book.org/4ed/Shapes/Managing_Rounding_Error . No PBRT source was copied. This repair is original project code. Existing source/material notices remain unchanged.
