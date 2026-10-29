# Finite-footprint receiver correction

The original R04/R06 authored closures are unchanged. The added receiver integrates periodic tile/grout coverage over a chart-aligned finite box, using surface-projected primary ray differentials. This enclosing box approximates the sheared pixel support; it is not an exact elliptical reconstruction filter. Ceramic dimensions, apertures and authoritative hit shapes are unchanged.

Resolved per-tile firing and narrow glaze pooling retain their mother output. Unresolved firing blends toward its ensemble mean; pooling blends toward its analytic rectangular-tile mean. These are explicitly statistical microvariation filters, not exact finite random-tile integrals. The 1 mm rounded shading bevel is retained when resolved and converges to its area mean when unresolved; its profile never changes ray geometry. Secondary ray footprints use a conservative cone approximation.

Exterior cap role 11 remains horizontal tile. Room-side cap, crown and reveal faces use role 12 design paint based on authored inward-depth coordinates, not camera-facing normals. No interior finish is asserted as surveyed.

The final union material query now has an independently switchable axial lower-bound shortcut: min(capDistance,0) >= currentBest-1e-8 safely skips polygon-distance evaluation. The original ordered winner and final union query remain. CPU witnesses alone are not GPU proof; same-camera raw hit and RGBA A/B are required.
