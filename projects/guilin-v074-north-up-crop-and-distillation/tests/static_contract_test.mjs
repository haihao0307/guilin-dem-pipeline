import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const current = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(current, '..');
const web = path.join(project, 'web');
const read = relative => fs.readFileSync(path.join(project, relative), 'utf8');
const json = relative => JSON.parse(read(relative));
const require = createRequire(import.meta.url);
const geo = require(path.join(web, 'geo.js'));

const manifest = json('web/data/mosaic_manifest.json');
const contract = json('web/data/runtime_contract.json');
const status = json('web/data/aoi_status.json');
const landmarks = json('web/data/landmarks.json');
const footprints = json('web/data/source_footprints.geojson');
const sources = json('web/data/source_manifest_compact.json');
const html = read('web/index.html');
const css = read('web/styles.css');
const app = read('web/app.js');

assert.equal(manifest.schema, 'guilin-v074-north-up-crop/v1');
assert.deepEqual(manifest.source_dem, {
  file: 'guilin_raw_union_12_5m.tif',
  sha256: '9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4',
  bytes: 124348471,
  crs: 'EPSG:32649',
  resolution_m: [12.5, 12.5],
  grid: [17408, 18867],
  bounds_epsg32649: [349862.5, 2703012.5, 567462.5, 2938850.0],
  world_size_m: [217600.0, 235837.5],
  valid_pixels: 284579268,
  nodata_pixels: 43857468,
  valid_fraction: 0.8664660094539486,
  nodata_fraction: 0.13353399054605147,
  elevation_range_m: [-6, 2093],
  crop_applied: false,
  gap_fill_applied: false,
});
assert.equal(manifest.preview.orientation, 'north-up');
assert.equal(manifest.preview.satellite_imagery, false);
assert.equal(manifest.preview.photo_texture, false);
assert.equal(manifest.preview.provenance_status, 'PENDING_SOURCE_TIFF_HASH_RECONCILIATION');
assert.equal(manifest.preview.exact_locked_tiff_derivation_verified, false);
assert.deepEqual(manifest.hydrology.systems, ['li', 'xiang']);
assert.equal(manifest.hydrology.centerline_mutated, false);

assert.equal(contract.north_up, true);
assert.equal(contract.rotation_allowed, false);
assert.equal(contract.perspective_allowed, false);
assert.equal(contract.source_dem_read_only, true);
assert.equal(contract.nodata_fill_allowed, false);
assert.equal(contract.active_30m_dem_allowed, false);
assert.equal(contract.vertical_scale, 1);
assert.equal(contract.one_meter_meaning, 'procedural field evaluation spacing, not measured DEM accuracy');
assert.equal(status.status, 'UNCONFIRMED');
assert.equal(status.accepted, false);
assert.equal(status.distillation_allowed, false);
assert.equal(status.geometry_sha256, null);

assert.equal(Object.keys(landmarks).length, 4);
const expected = {
  zhenbaoding: [482534.53046244296, 2890708.122979571],
  guilin: [429459.2395402428, 2795494.225020682],
  yangtang: [414949.56581014313, 2789301.889164384],
  yangshuo: [448648.4929454023, 2740850.7563219704],
};
for (const [id, landmark] of Object.entries(landmarks)) {
  const actual = geo.forward(landmark.lon, landmark.lat);
  assert.ok(Math.hypot(actual[0] - expected[id][0], actual[1] - expected[id][1]) < 1, `${id} projection drift`);
  const roundTrip = geo.inverse(actual[0], actual[1]);
  assert.ok(Math.abs(roundTrip[0] - landmark.lon) < 1e-7);
  assert.ok(Math.abs(roundTrip[1] - landmark.lat) < 1e-7);
}
const northToSouth = ['zhenbaoding', 'guilin', 'yangtang', 'yangshuo'];
for (let index = 1; index < northToSouth.length; index += 1) {
  assert.ok(landmarks[northToSouth[index - 1]].lat > landmarks[northToSouth[index]].lat);
}

assert.equal(footprints.type, 'FeatureCollection');
assert.equal(footprints.features.length, 12);
assert.equal(sources.source_count, 12);
assert.equal(sources.sources.length, 12);
assert.deepEqual(
  new Set(footprints.features.map(feature => feature.properties.sha256)),
  new Set(sources.sources.map(source => source.sha256)),
);

assert.match(html, /id="toolPolygon"/);
assert.match(html, /id="toolRectangle"/);
assert.match(html, /id="toolEdit"/);
assert.match(html, /id="deleteAoi"/);
assert.match(html, /id="clearSelection"/);
assert.match(html, /id="downloadGeojson"/);
assert.match(html, /id="downloadWkt"/);
assert.match(html, /id="copyCoordinates"/);
assert.match(html, /id="layerFootprints"/);
assert.match(html, /id="layerNodata"/);
assert.match(html, /id="layerRivers"/);
assert.match(html, /id="layerLandmarks"/);
assert.match(html, /id="layerScale"/);
assert.doesNotMatch(html, /data-mode="rotate"|id="rotate"|rotate-control/i);
assert.doesNotMatch(html, /<script[^>]+src="https?:/i);
assert.doesNotMatch(html, /<link[^>]+href="https?:/i);
assert.match(css, /\.landmark-label\s*\{[\s\S]*background:\s*transparent\s*!important/);
assert.match(css, /Noto Sans CJK TC/);
assert.match(app, /element\.dataset\.coordinateLines = '1'/);
assert.match(app, /single_active_aoi/);
assert.match(app, /cjk_glyphs_rendered/);
assert.match(app, /EPSG:32649/);
assert.match(app, /WGS84/);
assert.doesNotMatch(app, /mapbox|google maps|satellite|three\.js|webglrenderer/i);
assert.match(app, /rotation_allowed:\s*false/);
assert.match(app, /source_dem_read_only:\s*true/);

const sample = [[390000, 2730000], [500000, 2730000], [500000, 2830000], [390000, 2830000]];
assert.equal(geo.polygonArea(sample), 11_000_000_000);
const imageNorth = geo.utmToImage([400000, 2890000], manifest.source_dem.bounds_epsg32649, 8192, 8879);
const imageSouth = geo.utmToImage([400000, 2740000], manifest.source_dem.bounds_epsg32649, 8192, 8879);
assert.ok(imageNorth[1] < imageSouth[1], 'north must render above south');

console.log(JSON.stringify({
  schema: 'guilin-v074-static-contract-qa/v1',
  passed: true,
  source_sha256: manifest.source_dem.sha256,
  footprint_count: footprints.features.length,
  landmark_count: Object.keys(landmarks).length,
}, null, 2));
