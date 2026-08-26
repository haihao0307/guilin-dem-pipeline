# Kunming OSM and historical hydrology V001

## Branch and PR policy

Work only on `project/kunming-dem-v001` and PR #20. Keep the PR open and Draft. Do not merge, force push, rewrite history, modify `main`, or replace the authoritative DEM.

Start from the latest remote head and fast-forward normally.

## Read first

1. `projects/kunming/knowledge/KUNMING_OSM_HISTORICAL_HYDROLOGY_V001.md`
2. `projects/kunming/knowledge/KUNMING_HYDROLOGY_SOURCE_REGISTER_V001.json`
3. `projects/kunming/knowledge/osm/KUNMING_OSM_HYDROLOGY_CURRENT.ql`
4. `projects/kunming/knowledge/KUNMING_DEM_KNOWLEDGE_V001.json`

## Purpose

Create a cited, dated, topology-aware hydrology knowledge layer covering lakes, reservoirs, rivers, streams, canals, ditches, drains, springs and water-control structures within the clean Kunming crop.

The target historical epoch is 1940–1945. Prefer the earliest sufficiently detailed source and preserve each dated geometry version separately.

## Stage A: current OSM reference

1. Run the fixed Overpass query without changing the bbox.
2. Preserve the raw JSON response and retrieval timestamp.
3. Convert to GeoPackage or GeoJSON layers without losing OSM IDs, versions, timestamps, tags, relation roles or geometry type.
4. Separate at minimum:
   - river and stream centerlines;
   - canals, ditches and drains;
   - lake and reservoir polygons;
   - wide-river polygons;
   - springs, dams, weirs, waterfalls, rapids and lock gates;
   - `type=waterway` relations and member roles.
5. Reproject working copies to `EPSG:32648` while retaining original WGS84 geometry and IDs.
6. Attribute OSM-derived files as `© OpenStreetMap contributors, ODbL 1.0`.

## Stage B: OSM object history

Use one of these methods:

1. local OSM full-history PBF plus `osmium` filtering; or
2. ohsome full-history extraction while the chosen API version remains available.

For every current or deleted water object, retain geometry versions with:

- OSM type and ID;
- version;
- valid-from and valid-to timestamps;
- changeset;
- tags;
- geometry.

Do not interpret OSM edit time as the physical creation date of a river, lake or reservoir. OSM history is primarily modern mapping history after 2007.

## Stage C: historical source discovery

Search official non-Chinese repositories first:

1. Library of Congress Geography and Map Division;
2. Army Map Service and War Office/GSGS map series indexes;
3. OpenHistoricalMap;
4. other institutional map and aerial-photo archives with clear provenance and reuse terms.

Prioritize:

1. 1940–1945 maps and aerial photographs;
2. pre-1940 large-scale maps;
3. earlier regional maps for old names and major hydrography.

For every candidate source record:

- store catalog title, year, institution and URL;
- record map scale or image ground resolution;
- record whether the clean crop is actually covered;
- mark `geometry_usable`, `name_only`, `context_only`, or `rejected`;
- never claim a catalog record covers Kunming until the sheet or image is inspected.

## Stage D: DEM validation

Using the authoritative 12.5 m clean crop:

1. calculate depression handling, D8 or D-infinity flow direction, flow accumulation, valley bottoms and local slope;
2. test every OSM/historical centerline for downhill continuity;
3. test lake polygons for flatness and plausible outlet locations;
4. create conflict records when vectors cross ridges, flow uphill, fail to connect or disagree with dated maps;
5. never silently snap a cited historical feature to the DEM.

DEM-derived channels remain candidates until independently confirmed.

## Knowledge output

Create small, regenerable outputs under `projects/kunming/hydrology-knowledge-v001/`:

- `source_registry.json`
- `osm_current_manifest.json`
- `osm_history_manifest.json`
- `hydro_features.geojson` or GeoPackage manifest
- `hydro_topology.json`
- `historical_versions.json`
- `dem_conflicts.json`
- `QA_REPORT.json`
- `HANDOFF_KUNMING_HYDROLOGY_V001.md`

Large raw downloads remain local or in a separate release/cache. The repository stores source IDs, URLs, hashes, algorithms, parameters, vector knowledge and QA.

## Web rules

1. Remove all uncited hand-drawn water from the formal viewer.
2. Modern OSM, historical verified, historical candidate and DEM candidate layers must have separate toggles.
3. River centerlines stay fixed. A width slider changes only lateral rendering width.
4. Lake shorelines stay fixed. Waves change only shading, normals and highlights.
5. Water flow animation must follow the stored downstream direction.
6. Until historical verification passes, label modern OSM as modern reference, never as 1940–1945 truth.

## Completion gate

Do not declare completion until:

- raw OSM query and manifest exist;
- lake and waterway classes are separated;
- OSM IDs, versions and tags are preserved;
- current topology has no unexplained breaks in accepted main streams;
- historical source register contains inspected coverage status;
- every accepted historical object has date, source and confidence;
- DEM conflicts are explicit;
- browser water geometry is generated from accepted knowledge objects;
- no hand-drawn prototype geometry remains in the accepted layer.

Stop after the knowledge layer, QA and handoff are complete. Do not begin vegetation, buildings, roads, Gaea erosion or historical land-use reconstruction in this task.
