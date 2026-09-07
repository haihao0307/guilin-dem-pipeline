# Farmland Object DNA Workbench V0.1 Status

Date: 2026-09-07.

First implementation now combines theory and executable geometry. The workbench contains two procedural paddy samples under one DNA parameter set:

1. flat traditional paddy sample;
2. mountain terrace sample.

Implemented controls: terrain slope, parcel scale, bund width, water depth, household labor count, boundary organicity, crop stage, water route visibility, inlet/outlet nodes, crop visibility and diagnostic grid.

The current implementation deliberately keeps latitude and longitude as region identity only. Satellite imagery, canonical DEM, soil truth and historical land-use evidence are not connected in V0.1, so geographic coordinates do not silently manufacture terrain or crop truth.

The current geometry uses procedural field surfaces, earth volume, bund curves, irrigation routes, small access roads, huts for scale and procedural rice instances. Labor household count constrains the number of generated parcels. Terrace mode increases tier height and contour-following structure with slope.

Known limits for the next iteration:

- flat parcel topology still begins from a coarse shared control lattice and needs stronger historical subdivision logic;
- terrace interruption by ridges, gullies, rock, woodland and settlement is not yet driven by canonical DEM;
- canal capacity, per-field inlet/outlet elevations, seepage and water balance are visual/structural approximations in this first sample;
- settlement-to-field walking cost and household labor calendar are not yet solved as a network;
- regional DNA inference from satellite imagery is not implemented;
- Houdini execution/export is not connected yet;
- visualAcceptance=false and productionReady=false until user review.

Public gate status is recorded separately in PUBLICATION_PROOF.json.
