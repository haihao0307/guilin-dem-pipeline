import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const html = read('index.html');
const js = read('app.js');
const css = read('styles.css');

const checks = {
  release_marker: html.includes('guilin-v075-accepted-aoi-2048-hydrology'),
  exact_grid_label: html.includes('2048 × 2048'),
  accepted_aoi_label: html.includes('ACCEPTED AOI'),
  hydrology_panel: html.includes('HYDROLOGY SAMPLING'),
  no_external_runtime: !/(https?:\/\/|cdn\.|unpkg|jsdelivr)/i.test(html + js),
  webgl2_requested: js.includes("getContext('webgl2'"),
  integer_height_texture: js.includes('gl.R16UI') && js.includes('gl.RED_INTEGER'),
  exact_height_bytes: js.includes('EXPECTED_HEIGHT_BYTES = EXPECTED_GRID * EXPECTED_GRID * 2'),
  no_gap_fill_contract: js.includes('gap_fill_applied === false'),
  no_30m_contract: js.includes('fallback_30m_used === false'),
  immutable_centerline_contract: js.includes('centerline_coordinates_mutated === false'),
  water_triangle_runtime: js.includes('gl.drawArrays(gl.TRIANGLES'),
  responsive_layout: css.includes('@media (max-width: 780px)'),
};
const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
const payload = {
  schema: 'guilin-v075-2048-hydrology-source-contract/v1',
  passed: failed.length === 0,
  failed,
  checks,
};
console.log(JSON.stringify(payload, null, 2));
if (failed.length) process.exit(1);
