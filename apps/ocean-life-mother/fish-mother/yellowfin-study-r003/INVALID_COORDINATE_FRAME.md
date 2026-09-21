# Yellowfin 3D Measure R003 — INVALIDATED

Date: 2026-09-21

R003 is preserved as a failed measurement experiment and must not be used for source-copy dimensions.

## Failure

The workbench mixed two different coordinate spaces:

- `ANATOMY_PARTITION_R01_SUMMARY.json` key anchors are already normalized as `[x/bodyLength, u, z/bodyLength]`;
- live Sketchfab node matrices are viewer/model matrix coordinates.

R003 incorrectly treated the normalized anatomy anchors as raw source coordinates and derived `u` a second time.

## Consequence

Any A/B measurement that mixes a preloaded anatomy anchor with live matrix coordinates is invalid.

## Replacement

R004 separates:
1. normalized anatomy/reference measurements;
2. live viewer raw-node measurements.

Cross-frame distance is forbidden unless an explicit coordinate calibration transform passes residual checks.

No Source Copy geometry may use R003 measurements.
