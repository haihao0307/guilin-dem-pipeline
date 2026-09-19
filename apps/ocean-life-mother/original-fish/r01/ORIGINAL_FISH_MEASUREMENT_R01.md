# Original Fish Measurement Kernel R01

This is a clean measurement-first kernel. It intentionally contains no invented clownfish, snapper, bass, tuna, reef-fish or other species values.

The central representation follows the user's sketch and discussion:

1. A longitudinal coordinate `u` runs from snout (`0`) to tail end (`1`).
2. Side view is stored as two continuous score lines: dorsal and ventral offsets from the body axis.
3. Top view is stored as left/right half-width score lines on the same `u` grid.
4. A transverse section can therefore be measured from body height + width at each `u`; later versions can add section-shape exponent/profile only when evidence exists.
5. Eyes, mouth, gills, fins and skeleton are not baked into a mesh. They are identified anchors with normalized longitudinal/side/top coordinates plus optional relative size.
6. Life history is a sequence of measured evidence points. Each point has age, physical length and a declared fish-length definition (`TL`, `FL`, or `SL`).
7. Between measured stages, the kernel can interpolate the same identified quantities. It does not extrapolate outside the measured age range by default.
8. A feature missing at either bracketing evidence point is returned as `unknown_between_evidence_points`; it is not silently invented.
9. Mixing total length, fork length and standard length in one growth series is rejected.
10. Absolute millimetre sections are derived from normalized form × measured physical length, so a single life slider can drive both size and proportional form change without reducing growth to uniform scale.

This R01 establishes the ruler, not a species. The next production step is to populate the ruler with source-backed stage measurements for the first ordinary reef-fish species, then compare real observations against the reconstructed side/top/section curves.

All values in the test file are explicitly synthetic fixtures used only for invariants; they are not biological claims.
