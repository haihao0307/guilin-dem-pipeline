import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const project = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = relative => fs.readFileSync(path.join(project, relative), 'utf8');
const app = read('web/app.js');
const html = read('web/index.html');
const css = read('web/styles.css');
const version = JSON.parse(read('VERSION.json'));
const aoi = JSON.parse(read('web/data/accepted_aoi.json'));
const geojson = JSON.parse(read('web/data/accepted_aoi.geojson'));

const expectedBounds = [380331.8, 2705928.1, 530128.2, 2926987.2];
const approximately = (a, b, tolerance = 1e-6) => Math.abs(Number(a) - Number(b)) <= tolerance;
const checks = {
  version_075: version.version === '0.7.5',
  branch_exact: version.branch === 'project/guilin-v075-approved-aoi-terrain3d-preview',
  publish_dir_exact: version.publish_dir === 'guilin-v075-approved-aoi-terrain3d',
  aoi_accepted: aoi.status === 'ACCEPTED' && version.aoi_status === 'ACCEPTED',
  aoi_bounds_exact: aoi.bounds_epsg32649.every((value, index) => approximately(value, expectedBounds[index], 0.001)),
  aoi_hash_exact: aoi.geometry_sha256 === '36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80',
  geojson_polygon: geojson.features?.[0]?.geometry?.type === 'Polygon',
  source_12_5m: aoi.source_resolution_m?.every(value => approximately(value, 12.5)),
  nodata_locked: aoi.nodata_policy.includes('no interpolation') && aoi.nodata_policy.includes('no gap fill'),
  no_30m_substitution: aoi.nodata_policy.includes('no 30 m substitution'),
  webgl2_runtime: app.includes("getContext('webgl2'") && app.includes('gl.drawElements(gl.TRIANGLES'),
  conservative_nodata_cells: app.includes('buildNoDataPrefix') && app.includes('regionNoDataCount') && app.includes('hiddenNoDataCells'),
  no_external_runtime_dependency: !html.match(/<script[^>]+src=["']https?:/i) && !app.match(/from\s+["']https?:/i),
  vertical_default_1: html.includes('<option value="1" selected>1.00× 真实比例</option>') && app.includes('verticalScale: 1'),
  accepted_release_marker: html.includes('data-release="guilin-v075-approved-aoi-terrain3d"'),
  interaction_controls: ['overview', 'north', 'low', 'guilin'].every(name => html.includes(`data-view="${name}"`)),
  responsive_mobile: css.includes('@media (max-width: 520px)'),
  browser_qa_surface: app.includes('window.__GUILIN_V075_QA__'),
  preview_disclosed: aoi.preview_stage.includes('preview') && read('README.md').includes('正式全分辨率裁切 TIFF'),
};
const failed = Object.entries(checks).filter(([, value]) => value !== true).map(([name]) => name);
const result = { schema: 'guilin-v075-static-contract-qa/v1', passed: failed.length === 0, failed, checks };
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exit(1);
