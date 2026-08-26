# Guilin v0.7.2 rich terrain and seasonal river ribbons

This project extends the verified v0.7.1 coordinate contract without altering source DEM elevation.

## Locked truths

- 12.5 m DEM is read-only.
- Horizontal and vertical world units are metres.
- Vertical scale is 1.00x.
- X is east-positive.
- Z is south-positive.
- OSM centerline coordinates are immutable.
- River width is a lateral rendering field.

## New visual layers

- Richer satellite-style terrain colour derived from elevation, slope, curvature, local relief and hillshade.
- Higher-resolution normal and roughness maps for karst peak-cluster readability.
- River ribbon meshes draped to terrain.
- Adjustable river width, visual depth and colour.
- Winter, spring, summer and autumn presets.

## Online target

https://haihao0307.github.io/guilin-dem-pipeline/guilin-v072-terrain-rivers/
