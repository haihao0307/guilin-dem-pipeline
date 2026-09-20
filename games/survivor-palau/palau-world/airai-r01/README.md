# Palau Airai / Stone Money focused world R01

This line deliberately ignores high-detail work outside the immediate story area.

## Focus AOI

- WGS84 bbox: `[134.5305390567, 7.3128140607, 134.6029523562, 7.3852485779]`
- UTM 53N bbox: `[448182.29, 808356.63, 456182.29, 816356.63]`
- Candidate game-island anchor: `134.5667427743 E, 7.3490326380 N`
- Airai Airport marker: `134.5443 E, 7.3673 N`
- Candidate-island distance from the airport: about `3.20 km`

The earlier east marker at roughly `134.5805 E, 7.3395 N` fell in open water in the uploaded DEM and is rejected. The new anchor is a real connected land component in the user-supplied DEM. It remains a **game-site candidate**, not an asserted official island name.

## One conductor

Every evidence source is subordinate to:

```text
PalauWorld.sample(E, N, Z, time, observationBand)
```

The uploaded DEM supplies the current land low/mid/high-frequency wave field. NOAA ENC, multibeam, Sentinel-2, Allen Coral Atlas, OSM and GMRT are evidence voices, not separate worlds.

## Current factual boundary

- Land macro/mid shape: user-supplied Palau DEM pair.
- Nearshore/deep seabed: not yet accepted; current visual seabed is explicitly a candidate.
- Water: current bridge surface only; final integration must reuse the accepted Ocean Mother surface.
- Overhangs, caves and arches: later local 3-D implicit field, because a single-valued height field cannot represent them.

## First focused intake

The workflow downloads and spatially clips only this AOI:

- NOAA ENC product catalog and intersecting/fallback Palau cells;
- clipped S-57 content with `SOUNDG`, `DEPCNT`, `DEPARE`, `SBDARE`, `M_QUAL`, `M_SDAT`, coastline and hazards;
- Palau OSM GeoPackage;
- Sentinel-2 low-cloud STAC scene inventory;
- Allen Coral Atlas WFS/WMS capabilities;
- GMRT measured-mask and context grids.

No vertical datum is silently merged. Failures remain explicit in `FOCUS_SOURCE_RECEIPT.json`.
