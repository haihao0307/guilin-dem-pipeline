# Surface-covering root-cause review

K3.0.2 fixes an actual geometric defect: directly adding a fixed backward grooming vector to the skin normal could send frontal hair tips inside the skin. Grooming is now projected onto the tangent plane before its outward component is added. A regression checks every generated strand tip has positive outward normal displacement.

The avian body coverts previously lay on an approximate ellipsoid rather than the actual generated trunk and left a bare collar band. The new shared covering algorithm samples the actual continuous skin by triangle area and orients tapered, curved feather vanes using the local tangent frame. Geometry, seed, color and replay remain deterministic. Tortoise head/neck receive small geometric wrinkle relief, and its mouth seam is repositioned toward the visible surface. These refinements remain approximate interpretation of the supplied single-view images, not measured anatomy.

- [x] No generated image substitutes for real 3D.
- [x] Actual production source modified.
- [x] Real Three.js surfaces and interactive camera retained.
- [ ] Public fixed URL and real-browser verification require the new exact-head proof.
- [x] Screenshots alone do not count as delivery.
